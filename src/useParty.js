import { useCallback, useEffect, useRef, useState } from "react";
// Trystero strategy: firebase uses our own Realtime Database for signaling (peer
// introduction), then WebRTC connects players directly. We control the DB, so —
// unlike the public Nostr relays — it can't vanish under us. Gameplay is P2P.
import { joinRoom, selfId } from "trystero/firebase";
import { THEMES, shuffle, newTarget, scoreFor, DEFAULT_DIFFICULTY, DIFFICULTIES } from "./constants";

// For the firebase strategy, appId MUST be the Realtime Database URL.
const APP_ID = "https://spectrum-game-7006e-default-rtdb.europe-west1.firebasedatabase.app";
// STUN finds public IPs; TURN relays traffic when no direct path exists (WiFi
// client isolation, symmetric NAT, Firefox resistFingerprinting). Without TURN,
// peers on the same network often can't connect at all. Multiple transports
// (UDP :80, TCP :80, UDP :443, TLS/TCP :443) maximize traversal of locked-down
// networks. Credentials are Metered's free tier (50 GB/mo).
const TURN_USER = "d201079d6ff5ad65f11444b4";
const TURN_CRED = "7L/0DoWyo+e2FtBw";
const ICE_SERVERS = [
  { urls: "stun:stun.relay.metered.ca:80" },
  { urls: "turn:global.relay.metered.ca:80", username: TURN_USER, credential: TURN_CRED },
  { urls: "turn:global.relay.metered.ca:80?transport=tcp", username: TURN_USER, credential: TURN_CRED },
  { urls: "turn:global.relay.metered.ca:443", username: TURN_USER, credential: TURN_CRED },
  { urls: "turns:global.relay.metered.ca:443?transport=tcp", username: TURN_USER, credential: TURN_CRED },
];
const ROOM_CONFIG = {
  appId: APP_ID,
  rtcConfig: { iceServers: ICE_SERVERS },
};
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
  const apiRef = useRef(null);           // { sendRoom, sendAct, sendGuess, leave }
  const isHostRef = useRef(false);
  const deckRef = useRef({ deck: [], ptr: 0 });
  const targetRef = useRef({ round: -1, value: null }); // master-only secret
  const guessRef = useRef({ round: -1, byPid: {} });     // master-only collected guesses
  const liveRef = useRef({ round: -1, map: {} });        // master-only live needle map
  const amMasterRef = useRef(false);                     // mirror of amMaster for stable handlers
  const broadcastMapRef = useRef(null);                  // master's live-map broadcaster
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

  const broadcast = useCallback(() => {
    const r = roomRef.current; if (!r || !apiRef.current) return;
    r.version = (r.version || 0) + 1;
    setRoom({ ...r });                 // host sees it too
    apiRef.current.sendRoom(r);        // everyone else
  }, []);

  // ---- host: apply an action from any peer (or itself) ----
  const applyAct = useCallback((from, msg) => {
    const r = roomRef.current; if (!r) return;
    const { type, payload } = msg || {};
    switch (type) {
      case "hello": {
        const ex = r.players.find((p) => p.pid === payload.pid);
        if (ex) { ex.connected = true; ex.peerId = from; if (payload.name) ex.name = uniqueName(r, payload.name, payload.pid); }
        else if (r.players.length < 8) {
          r.players.push({ pid: payload.pid, name: uniqueName(r, payload.name || "Player", payload.pid), score: 0, connected: true, peerId: from });
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
        if (from !== masterPeerId(r) && from !== "self") return;
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

  const masterPeerId = (r) => r.players.find((p) => p.pid === r.masterId)?.peerId;

  // ---- wire up a Trystero room ----
  const connect = useCallback((code, name, asHost) => {
    setError(null); setStatus("connecting"); saveName(name); helloRef.current.name = name;
    isHostRef.current = asHost;
    let r;
    try { r = joinRoom(ROOM_CONFIG, code); }
    catch (e) { setError("Could not connect. Try again."); setStatus("idle"); return; }

    const [sendRoom, getRoom] = r.makeAction("room");
    const [sendAct, getAct] = r.makeAction("act");
    const [sendGuess, getGuess] = r.makeAction("guess");
    const [sendLive, getLive] = r.makeAction("live");      // guesser -> master: live needle
    const [sendMap, getMap] = r.makeAction("livemap");      // master -> locked guessers: all needles
    const [sendCharge, getCharge] = r.makeAction("charge"); // master -> locked guessers: reveal charge
    apiRef.current = { sendRoom, sendAct, sendGuess, sendLive, sendMap, sendCharge, leave: () => r.leave() };

    // master forwards the aggregate live-needle map ONLY to players who have locked
    // (still-choosing guessers must never see others' needles)
    const broadcastLiveMap = () => {
      const rr = roomRef.current; if (!rr || !apiRef.current) return;
      const map = liveRef.current.map;
      Object.keys(guessRef.current.byPid || {}).forEach((pid) => {
        const peer = rr.players.find((p) => p.pid === pid)?.peerId;
        if (peer) { try { apiRef.current.sendMap({ map }, peer); } catch (e) {} }
      });
      setLiveNeedles({ ...map }); // master renders locally
    };
    broadcastMapRef.current = broadcastLiveMap;

    if (asHost) {
      roomRef.current = {
        code, hostPid: myPid, status: "lobby",
        players: [{ pid: myPid, name, score: 0, connected: true, peerId: selfId }],
        round: 1, masterId: myPid, theme: THEMES[0], clue: "", lockedCount: 0, results: [], target: null,
        difficulty: DEFAULT_DIFFICULTY, cheat: false, version: 0,
      };
      deckRef.current = { deck: shuffle(THEMES.map((_, i) => i)), ptr: 0 };
      setRoom({ ...roomRef.current });
    }

    // everyone listens for room snapshots from the host. The FIRST snapshot a
    // joiner receives is proof the P2P data channel is live — only now do we flip
    // to "connected" (and drop the connecting screen / cancel the failure timer).
    getRoom((data) => {
      roomRef.current = isHostRef.current ? roomRef.current : data;
      setRoom(data);
      if (!isHostRef.current && joinTimerRef.current) {
        clearTimeout(joinTimerRef.current); joinTimerRef.current = null;
        setStatus("connected");
      }
    });
    // host handles actions from peers
    getAct((data, peer) => { if (isHostRef.current) applyAct(peer, data); });
    const ensureLiveRound = () => {
      if (liveRef.current.round !== curRoundRef.current) liveRef.current = { round: curRoundRef.current, map: {} };
    };
    // master collects guesses sent directly to it
    getGuess((data) => {
      if (!data || typeof data.angle !== "number") return;
      if (guessRef.current.round !== curRoundRef.current) guessRef.current = { round: curRoundRef.current, byPid: {} };
      const a = Math.max(0, Math.min(180, data.angle));
      guessRef.current.byPid[data.pid] = a;
      ensureLiveRound(); liveRef.current.map[data.pid] = a; // freeze their needle at the locked spot
      const locked = Object.keys(guessRef.current.byPid).length;
      dispatch("prog", { locked });
      broadcastLiveMap();
    });
    // master receives a still-choosing guesser's live needle position
    getLive((data) => {
      if (!amMasterRef.current || !data || typeof data.angle !== "number") return;
      ensureLiveRound();
      liveRef.current.map[data.pid] = Math.max(0, Math.min(180, data.angle));
      broadcastLiveMap();
    });
    // locked guessers receive the aggregate map and render everyone's needles
    getMap((data) => { if (data && data.map) setLiveNeedles(data.map); });
    // locked guessers watch the master's reveal charge build up (read-only)
    getCharge((data) => { if (data && typeof data.c === "number") setRevealCharge(Math.max(0, Math.min(1, data.c))); });

    r.onPeerJoin(() => { sayHello(); });
    r.onPeerLeave((peer) => {
      if (!isHostRef.current) return;
      const rr = roomRef.current; if (!rr) return;
      const p = rr.players.find((x) => x.peerId === peer);
      if (p) { p.connected = false; broadcast(); }
    });

    // The host's room is ready instantly. A joiner stays "connecting" until the
    // host's first snapshot lands over WebRTC (see getRoom) — that's what keeps
    // the joiner on a "Connecting…" screen instead of a blank page during the
    // multi-second cross-network handshake. If it never lands, fail loudly.
    if (asHost) {
      setStatus("connected");
    } else {
      joinTimerRef.current = setTimeout(() => {
        joinTimerRef.current = null;
        if (!roomRef.current) {
          try { r.leave(); } catch (e) {}
          apiRef.current = null;
          setError("Couldn't reach the host. Double-check the code, make sure they're still in the lobby, and try again.");
          setStatus("idle");
        }
      }, 25000);
    }
    // announce ourselves to the host (covers host connecting slightly later)
    const sayHello = () => { try { sendAct({ type: "hello", payload: { pid: myPid, name: helloRef.current.name } }); } catch (e) {} };
    helloRef.current.say = sayHello;
    sayHello();
    setTimeout(sayHello, 600);
    setTimeout(sayHello, 1500);
    setTimeout(sayHello, 3500);
  }, [applyAct, broadcast, myPid]);

  // dispatch: host applies locally, others send to host
  const dispatch = useCallback((type, payload) => {
    if (isHostRef.current) applyAct("self", { type, payload });
    else if (apiRef.current) { try { apiRef.current.sendAct({ type, payload }); } catch (e) {} }
  }, [applyAct]);

  // track current round for guess bucketing
  const curRoundRef = useRef(1);
  useEffect(() => { if (room) curRoundRef.current = room.round; }, [room?.round]);

  // ---- master-only secret target lifecycle ----
  const amMaster = room && room.masterId === myPid;
  useEffect(() => { amMasterRef.current = !!amMaster; }, [amMaster]);
  // clear the secret whenever the round turns over (or we're no longer master)
  useEffect(() => { setSecretTarget(null); }, [room?.round, amMaster]);
  // live needles only exist during guessing — clear them otherwise / per round
  useEffect(() => {
    if (!room || room.status !== "guessing") {
      setLiveNeedles({});
      liveRef.current = { round: -1, map: {} };
      setRevealCharge(0);
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

  // guesser: send my guess straight to the master (never to others)
  const submitGuess = useCallback((angle) => {
    const r = roomRef.current || room; if (!r) return;
    const mp = r.players.find((p) => p.pid === r.masterId)?.peerId;
    const payload = { pid: myPid, angle };
    if (r.masterId === myPid) return; // master doesn't guess
    if (apiRef.current && mp) { try { apiRef.current.sendGuess(payload, mp); } catch (e) {} }
    // if master happens to be host, the guess still routes via peer id above
  }, [room, myPid]);

  // guesser: stream my live needle to the master while still choosing (throttled).
  // The master is the only recipient; it relays to locked players only.
  const pushLive = useCallback((angle) => {
    const r = roomRef.current || room; if (!r || r.masterId === myPid) return;
    const now = Date.now();
    if (now - lastLiveSent.current < 55) return;
    lastLiveSent.current = now;
    const mp = r.players.find((p) => p.pid === r.masterId)?.peerId;
    if (apiRef.current && mp) { try { apiRef.current.sendLive({ pid: myPid, angle }, mp); } catch (e) {} }
  }, [room, myPid]);

  // master: stream the reveal-charge to locked guessers so they feel the tension build.
  // Always send the 0 and 1 endpoints so their meter starts/finishes cleanly.
  const pushCharge = useCallback((c) => {
    const r = roomRef.current || room; if (!r || !apiRef.current) return;
    const now = Date.now();
    const edge = c <= 0.001 || c >= 0.999;
    if (!edge && now - lastChargeSent.current < 45) return;
    lastChargeSent.current = now;
    Object.keys(guessRef.current.byPid || {}).forEach((pid) => {
      const peer = r.players.find((p) => p.pid === pid)?.peerId;
      if (peer) { try { apiRef.current.sendCharge({ c }, peer); } catch (e) {} }
    });
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
