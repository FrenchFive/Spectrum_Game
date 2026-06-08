import { useCallback, useEffect, useRef, useState } from "react";
// Transport: all gameplay flows through our Firebase Realtime Database — no WebRTC.
// This works for every player on every browser and network (NordVPN, Firefox
// fingerprinting protection, locked-down Wi-Fi) because it's just HTTPS/WebSocket
// to Google, never a peer-to-peer connection. The host stays the authoritative
// writer of room state; peers send actions and read snapshots. It's still
// real-time — RTDB pushes updates over a socket in ~100-200ms.
import { initializeApp, getApps } from "firebase/app";
import {
  getDatabase, ref, onValue, onChildAdded, onChildRemoved,
  set, remove, push, onDisconnect,
} from "firebase/database";
import { THEMES, shuffle, newTarget, scoreFor, DEFAULT_DIFFICULTY, DIFFICULTIES } from "./constants";

const DB_URL = "https://spectrum-game-7006e-default-rtdb.europe-west1.firebasedatabase.app";
const fbApp = getApps().length ? getApps()[0] : initializeApp({ databaseURL: DB_URL });
const db = getDatabase(fbApp);

// random per-tab id — exposed for debugging + used as a fallback identity
export const selfId = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);

// Store game data under the __trystero__ namespace your existing DB security rules
// already permit (".read"/".write" true per room id) — so NO Firebase rules change
// is needed. Each room is its own node keyed by code.
const basePath = (code) => `__trystero__/sg-${code}`;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1
export const genCode = () => Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");

// stable per-browser identity so a refresh/rejoin keeps your seat + score
function persistentPid() {
  try {
    let p = localStorage.getItem("spectrum_pid");
    if (!p) { p = selfId + "-" + Math.random().toString(36).slice(2, 8); localStorage.setItem("spectrum_pid", p); }
    return p;
  } catch (e) { return selfId; }
}
const savedName = () => { try { return localStorage.getItem("spectrum_name") || ""; } catch (e) { return ""; } };
const saveName = (n) => { try { localStorage.setItem("spectrum_name", n); } catch (e) {} };

const connectedPlayers = (room) => room.players.filter((p) => p.connected);

// RTDB drops empty arrays/objects, so a snapshot can come back missing them —
// normalise the shape every peer reads so the UI never hits undefined.
const normRoom = (data) => ({ ...data, players: data.players || [], results: data.results || [] });

// guarantee a name not already used by another player in the room (case-insensitive),
// appending " (2)", " (3)", … on collision. Excludes the player's own pid (reconnect).
function uniqueName(room, desired, selfPid) {
  const base = (desired || "").trim().slice(0, 16) || "Player";
  const taken = new Set(room.players.filter((p) => p.pid !== selfPid).map((p) => p.name.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  let n = 2;
  while (taken.has(`${base} (${n})`.toLowerCase())) n++;
  return `${base} (${n})`;
}

// rotate master to the next connected player after the current one
function nextMasterId(room) {
  const conn = connectedPlayers(room);
  if (!conn.length) return room.masterId;
  const idx = conn.findIndex((p) => p.pid === room.masterId);
  return conn[(idx + 1) % conn.length].pid;
}

export function useParty() {
  const [room, setRoom] = useState(null);     // public state, mirrored on every device
  const [status, setStatus] = useState("idle"); // idle | connecting | connected
  const [error, setError] = useState(null);
  const [secretTarget, setSecretTarget] = useState(null); // master-only, drives the spin render
  const [liveNeedles, setLiveNeedles] = useState({});      // pid -> angle, shown to master + locked guessers
  const [revealCharge, setRevealCharge] = useState(0);     // locked guessers mirror the master's hold charge

  const myPid = useRef(persistentPid()).current;
  const roomRef = useRef(null);          // host's authoritative copy
  const apiRef = useRef(null);           // { writeState, sendAction, setLive, setGuess, setCharge, leave }
  const isHostRef = useRef(false);
  const deckRef = useRef({ deck: [], ptr: 0 });
  const targetRef = useRef({ round: -1, value: null }); // master-only secret
  const guessRef = useRef({ round: -1, byPid: {} });     // master-only collected guesses
  const liveRef = useRef({ round: -1, map: {} });        // master-only live needle map
  const amMasterRef = useRef(false);                     // mirror of amMaster for stable handlers
  const iLockedRef = useRef(false);                      // this guesser has locked → may see others' needles
  const listenersRef = useRef([]);                       // RTDB unsubscribe fns
  const lastLiveSent = useRef(0);                        // throttle outgoing live updates
  const lastChargeSent = useRef(0);                      // throttle outgoing reveal charge
  const helloRef = useRef({ name: "" });
  const joinTimerRef = useRef(null);                     // joiner: fails the connect if no room snapshot arrives

  // ---- host: draw a fresh theme without repeats ----
  const drawTheme = useCallback(() => {
    let { deck, ptr } = deckRef.current;
    if (ptr >= deck.length) { deck = shuffle(THEMES.map((_, i) => i)); ptr = 0; }
    const theme = THEMES[deck[ptr]];
    deckRef.current = { deck, ptr: ptr + 1 };
    return theme;
  }, []);

  // host: publish the authoritative room state to the DB (everyone reads it)
  const broadcast = useCallback(() => {
    const r = roomRef.current; if (!r || !apiRef.current) return;
    r.version = (r.version || 0) + 1;
    setRoom({ ...r });                 // host sees it too
    apiRef.current.writeState(r);      // everyone else reads it from the DB
  }, []);

  // ---- host: apply an action from any peer (or itself) ----
  const applyAct = useCallback((from, msg) => {
    const r = roomRef.current; if (!r) return;
    const { type, payload } = msg || {};
    switch (type) {
      case "hello": {
        const ex = r.players.find((p) => p.pid === payload.pid);
        if (ex) { ex.connected = true; if (payload.name) ex.name = uniqueName(r, payload.name, payload.pid); }
        else if (r.players.length < 8) {
          r.players.push({ pid: payload.pid, name: uniqueName(r, payload.name || "Player", payload.pid), score: 0, connected: true });
        } else return; // room full
        broadcast();
        break;
      }
      case "setDiff": {
        // host picks difficulty in the lobby; ignored once the game is underway
        if (from !== r.hostPid && from !== "self") return;
        if (r.status !== "lobby") return;
        if (DIFFICULTIES.some((d) => d.id === payload.difficulty)) { r.difficulty = payload.difficulty; broadcast(); }
        break;
      }
      case "setCheat": {
        // host toggles cheat (Master places the target) in the lobby only
        if (from !== r.hostPid && from !== "self") return;
        if (r.status !== "lobby") return;
        r.cheat = !!payload.cheat; broadcast();
        break;
      }
      case "start": {
        if (from !== r.hostPid && from !== "self") return;
        if (connectedPlayers(r).length < 2) return;
        r.status = "themeVote"; r.round = 1; r.masterId = connectedPlayers(r)[0].pid;
        r.theme = drawTheme(); r.clue = ""; r.results = []; r.target = null; r.lockedCount = 0;
        broadcast();
        break;
      }
      case "voteSkip": {
        if (r.status !== "themeVote") return;
        r.theme = drawTheme(); broadcast();
        break;
      }
      case "votePlay": {
        if (r.status !== "themeVote") return;
        r.status = "spin"; r.clue = ""; r.results = []; r.target = null; r.lockedCount = 0;
        broadcast();
        break;
      }
      case "clue": {
        if (from !== r.masterId && from !== "self") return;
        if (r.status !== "clue" && r.status !== "spin") return;
        r.clue = String(payload.clue || "").slice(0, 140); r.status = "guessing"; r.lockedCount = 0;
        broadcast();
        break;
      }
      case "spundone": { // master signals spin finished -> open clue entry
        if (r.status === "spin") { r.status = "clue"; broadcast(); }
        break;
      }
      case "prog": {
        if (r.status !== "guessing") return;
        r.lockedCount = Math.max(0, Math.min(payload.locked | 0, connectedPlayers(r).length - 1));
        broadcast();
        break;
      }
      case "reveal": {
        if (r.status !== "guessing" && r.status !== "clue") return;
        const results = Array.isArray(payload.results) ? payload.results : [];
        const needed = Math.max(0, connectedPlayers(r).length - 1);
        if (results.length < needed) return; // every connected guesser must have locked
        results.forEach((res) => {
          const p = r.players.find((x) => x.pid === res.pid);
          if (p && p.pid !== r.masterId) p.score += res.pts | 0;
        });
        r.results = results; r.target = typeof payload.target === "number" ? payload.target : null;
        r.status = "reveal";
        broadcast();
        break;
      }
      case "next": {
        if (r.status !== "reveal") return;
        r.round += 1; r.masterId = nextMasterId(r); r.theme = drawTheme();
        r.status = "themeVote"; r.clue = ""; r.results = []; r.target = null; r.lockedCount = 0;
        broadcast();
        break;
      }
      case "reassign": {
        r.masterId = nextMasterId(r);
        r.status = "themeVote"; r.theme = drawTheme(); r.clue = ""; r.results = []; r.target = null; r.lockedCount = 0;
        broadcast();
        break;
      }
      case "end": { r.status = "gameover"; broadcast(); break; }
      case "again": {
        r.players.forEach((p) => (p.score = 0));
        r.status = "lobby"; r.round = 1; r.clue = ""; r.results = []; r.target = null; r.lockedCount = 0;
        broadcast();
        break;
      }
      default: break;
    }
  }, [broadcast, drawTheme]);

  // ---- wire up a Firebase-backed room ----
  const connect = useCallback((code, name, asHost) => {
    setError(null); setStatus(asHost ? "connected" : "connecting"); saveName(name); helloRef.current.name = name;
    isHostRef.current = asHost;
    const base = basePath(code);
    const subs = [];

    // master: merge still-choosing live needles with frozen locked guesses, then
    // publish the shared map. Locked guessers + the master render it; still-choosing
    // guessers ignore it (gated below + in the UI) so they can't peek.
    const writeLiveMap = () => {
      const round = curRoundRef.current;
      const map = { ...(liveRef.current.map || {}) };
      Object.entries(guessRef.current.byPid || {}).forEach(([pid, a]) => { map[pid] = a; });
      try { set(ref(db, `${base}/livemap/${round}`), map); } catch (e) {}
    };

    apiRef.current = {
      writeState: (r) => { try { set(ref(db, `${base}/state`), r); } catch (e) {} },
      sendAction: (msg) => { try { push(ref(db, `${base}/actions`), msg); } catch (e) {} },
      setLive: (round, pid, a) => { try { set(ref(db, `${base}/live/${round}/${pid}`), a); } catch (e) {} },
      setGuess: (round, pid, a) => { try { set(ref(db, `${base}/guesses/${round}/${pid}`), a); } catch (e) {} },
      setCharge: (round, c) => { try { set(ref(db, `${base}/charge/${round}`), c); } catch (e) {} },
      leave: () => {
        subs.forEach((u) => { try { u(); } catch (e) {} });
        try { remove(ref(db, `${base}/presence/${myPid}`)); } catch (e) {}
        if (asHost) { try { remove(ref(db, base)); } catch (e) {} } // host owns the room; clean it up
      },
    };

    if (asHost) {
      // start clean in case a stale room with this code lingered, then publish state
      try { remove(ref(db, base)); } catch (e) {}
      roomRef.current = {
        code, hostPid: myPid, status: "lobby",
        players: [{ pid: myPid, name, score: 0, connected: true }],
        round: 1, masterId: myPid, theme: THEMES[0], clue: "", lockedCount: 0, results: [], target: null,
        difficulty: DEFAULT_DIFFICULTY, cheat: false, version: 0,
      };
      deckRef.current = { deck: shuffle(THEMES.map((_, i) => i)), ptr: 0 };
      apiRef.current.writeState(roomRef.current);
      setRoom({ ...roomRef.current });
      onDisconnect(ref(db, base)).remove();        // tidy up if the host drops
      // host consumes actions from peers, one at a time
      subs.push(onChildAdded(ref(db, `${base}/actions`), (snap) => {
        const msg = snap.val(); try { remove(snap.ref); } catch (e) {}
        if (msg && msg.type) applyAct(msg.from || "peer", msg);
      }));
      // host detects departures via presence removal
      subs.push(onChildRemoved(ref(db, `${base}/presence`), (snap) => {
        const rr = roomRef.current; if (!rr) return;
        const pl = rr.players.find((p) => p.pid === snap.key);
        if (pl && pl.connected) { pl.connected = false; broadcast(); }
      }));
    }

    // everyone (except the authoritative host) mirrors the room state
    subs.push(onValue(ref(db, `${base}/state`), (snap) => {
      if (isHostRef.current) return;
      const data = snap.val(); if (!data) return;
      const r = normRoom(data);
      roomRef.current = r; setRoom(r);
      if (joinTimerRef.current) { clearTimeout(joinTimerRef.current); joinTimerRef.current = null; setStatus("connected"); }
    }));

    // master only: collect live needles + locked guesses, then republish the map
    subs.push(onValue(ref(db, `${base}/live`), (snap) => {
      if (!amMasterRef.current) return;
      const round = curRoundRef.current;
      liveRef.current = { round, map: { ...((snap.val() || {})[round] || {}) } };
      writeLiveMap();
    }));
    subs.push(onValue(ref(db, `${base}/guesses`), (snap) => {
      if (!amMasterRef.current) return;
      const round = curRoundRef.current;
      guessRef.current = { round, byPid: { ...((snap.val() || {})[round] || {}) } };
      dispatch("prog", { locked: Object.keys(guessRef.current.byPid).length });
      writeLiveMap();
    }));

    // the shared needle map + reveal charge — master & locked guessers render these
    subs.push(onValue(ref(db, `${base}/livemap`), (snap) => {
      if (!amMasterRef.current && !iLockedRef.current) return; // anti-peek for still-choosing guessers
      setLiveNeedles(((snap.val() || {})[curRoundRef.current]) || {});
    }));
    subs.push(onValue(ref(db, `${base}/charge`), (snap) => {
      const c = (snap.val() || {})[curRoundRef.current];
      if (typeof c === "number") setRevealCharge(Math.max(0, Math.min(1, c)));
    }));

    // announce our presence; auto-removed when the tab/connection goes away
    try { set(ref(db, `${base}/presence/${myPid}`), true); onDisconnect(ref(db, `${base}/presence/${myPid}`)).remove(); } catch (e) {}

    listenersRef.current = subs;

    // a joiner stays "connecting" until the host's first snapshot lands (see state
    // listener). If it never lands in 25s, fail loudly instead of hanging blank.
    if (!asHost) {
      apiRef.current.sendAction({ from: myPid, type: "hello", payload: { pid: myPid, name } });
      joinTimerRef.current = setTimeout(() => {
        joinTimerRef.current = null;
        if (!roomRef.current) {
          try { apiRef.current && apiRef.current.leave(); } catch (e) {}
          apiRef.current = null;
          setError("Couldn't reach the host. Double-check the code, make sure they're still in the lobby, and try again.");
          setStatus("idle");
        }
      }, 25000);
    }
  }, [applyAct, broadcast, myPid]);

  // dispatch: host applies locally, others send to host
  const dispatch = useCallback((type, payload) => {
    if (isHostRef.current) applyAct("self", { type, payload });
    else if (apiRef.current) apiRef.current.sendAction({ from: myPid, type, payload });
  }, [applyAct, myPid]);

  // track current round for guess bucketing
  const curRoundRef = useRef(1);
  useEffect(() => { if (room) curRoundRef.current = room.round; }, [room?.round]);

  // ---- master-only secret target lifecycle ----
  const amMaster = room && room.masterId === myPid;
  useEffect(() => { amMasterRef.current = !!amMaster; }, [amMaster]);
  // clear the secret whenever the round turns over (or we're no longer master)
  useEffect(() => { setSecretTarget(null); }, [room?.round, amMaster]);
  // a fresh round means this device hasn't locked yet
  useEffect(() => { iLockedRef.current = false; }, [room?.round]);
  // live needles only exist during guessing — clear them otherwise / per round
  useEffect(() => {
    if (!room || room.status !== "guessing") {
      setLiveNeedles({});
      liveRef.current = { round: -1, map: {} };
      setRevealCharge(0);
      iLockedRef.current = false;
    }
  }, [room?.status, room?.round]);
  // generate the secret when this device becomes master and the spin begins.
  // Stored in BOTH a ref (for revealNow scoring) and state (so the spin re-renders).
  useEffect(() => {
    if (!room) return;
    if (amMaster && room.status === "spin" && targetRef.current.round !== room.round) {
      const value = newTarget();
      targetRef.current = { round: room.round, value };
      guessRef.current = { round: room.round, byPid: {} };
      setSecretTarget(value);
    }
  }, [room?.status, room?.round, amMaster]);

  // ---------- public actions ----------
  const create = useCallback((name) => { connect(genCode(), (name || "Host").trim().slice(0, 16), true); }, [connect]);
  const createWithCode = useCallback((code, name) => { connect(code, (name || "Host").trim().slice(0, 16), true); }, [connect]);
  const join = useCallback((code, name) => { connect(code.toUpperCase().trim(), (name || "Player").trim().slice(0, 16), false); }, [connect]);

  const leave = useCallback(() => {
    if (joinTimerRef.current) { clearTimeout(joinTimerRef.current); joinTimerRef.current = null; }
    try { apiRef.current && apiRef.current.leave(); } catch (e) {}
    apiRef.current = null; roomRef.current = null; isHostRef.current = false;
    listenersRef.current = [];
    targetRef.current = { round: -1, value: null }; guessRef.current = { round: -1, byPid: {} };
    setRoom(null); setStatus("idle");
  }, []);

  const startGame = useCallback(() => dispatch("start", {}), [dispatch]);
  const setDifficulty = useCallback((difficulty) => dispatch("setDiff", { difficulty }), [dispatch]);
  const setCheat = useCallback((cheat) => dispatch("setCheat", { cheat }), [dispatch]);

  // cheat mode: master drags the secret target to a spot of their choosing.
  // Updates the scoring ref (read by revealNow) + the render state (the dial).
  const setMasterTarget = useCallback((angle) => {
    if (!amMasterRef.current) return;
    const a = Math.max(0, Math.min(180, angle));
    targetRef.current = { round: curRoundRef.current, value: a };
    setSecretTarget(a);
  }, []);
  const voteSkip = useCallback(() => dispatch("voteSkip", {}), [dispatch]);
  const votePlay = useCallback(() => dispatch("votePlay", {}), [dispatch]);
  const finishSpin = useCallback(() => dispatch("spundone", {}), [dispatch]);
  const submitClue = useCallback((clue) => dispatch("clue", { clue }), [dispatch]);
  const nextRound = useCallback(() => dispatch("next", {}), [dispatch]);
  const endGame = useCallback(() => dispatch("end", {}), [dispatch]);
  const playAgain = useCallback(() => dispatch("again", {}), [dispatch]);
  const reassignMaster = useCallback(() => dispatch("reassign", {}), [dispatch]);

  // guesser: write my locked guess to the DB (master reads it for scoring + lock count)
  const submitGuess = useCallback((angle) => {
    const r = roomRef.current || room; if (!r || !apiRef.current) return;
    if (r.masterId === myPid) return; // master doesn't guess
    const a = Math.max(0, Math.min(180, angle));
    iLockedRef.current = true;                 // I'm locked → I may now see everyone's needles
    apiRef.current.setGuess(r.round, myPid, a);
    apiRef.current.setLive(r.round, myPid, a); // freeze my needle at the locked spot
  }, [room, myPid]);

  // guesser: stream my live needle while still choosing (throttled to keep DB writes sane)
  const pushLive = useCallback((angle) => {
    const r = roomRef.current || room; if (!r || !apiRef.current || r.masterId === myPid) return;
    const now = Date.now();
    if (now - lastLiveSent.current < 90) return;
    lastLiveSent.current = now;
    apiRef.current.setLive(r.round, myPid, Math.max(0, Math.min(180, angle)));
  }, [room, myPid]);

  // master: stream the reveal-charge so locked guessers feel the tension build.
  // Always send the 0 and 1 endpoints so their meter starts/finishes cleanly.
  const pushCharge = useCallback((c) => {
    const r = roomRef.current || room; if (!r || !apiRef.current) return;
    const now = Date.now();
    const edge = c <= 0.001 || c >= 0.999;
    if (!edge && now - lastChargeSent.current < 80) return;
    lastChargeSent.current = now;
    apiRef.current.setCharge(r.round, c);
  }, [room]);

  // master: compute scores from collected guesses + secret target, then reveal
  const revealNow = useCallback(() => {
    const r = roomRef.current || room; if (!r) return;
    const tgt = targetRef.current.value;
    const guesses = guessRef.current.byPid || {};
    const diff = r.difficulty || DEFAULT_DIFFICULTY;
    const results = Object.entries(guesses).map(([pid, guess]) => ({ pid, guess, pts: scoreFor(guess, tgt, diff) }));
    dispatch("reveal", { target: tgt, results });
  }, [dispatch, room]);

  useEffect(() => () => { try { apiRef.current && apiRef.current.leave(); } catch (e) {} }, []);

  return {
    room, status, error, myPid, selfId,
    isHost: room ? room.hostPid === myPid : false,
    amMaster: !!amMaster,
    secretTarget: amMaster ? secretTarget : null,
    liveNeedles, revealCharge,
    lockedPids: guessRef.current.byPid ? Object.keys(guessRef.current.byPid) : [],
    localLocked: guessRef.current.byPid ? Object.keys(guessRef.current.byPid).length : 0,
    savedName,
    create, createWithCode, join, leave,
    startGame, setDifficulty, setCheat, setMasterTarget, voteSkip, votePlay, finishSpin, submitClue, submitGuess, pushLive, pushCharge,
    revealNow, nextRound, endGame, playAgain, reassignMaster,
  };
}
