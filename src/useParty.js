import { useCallback, useEffect, useRef, useState } from "react";
// Trystero strategy: nostr uses free public relays for signaling, then WebRTC
// connects phones directly. No backend, no keys. To swap reliability strategy
// just change this import to 'trystero/mqtt' or 'trystero/torrent' — same API.
import { joinRoom, selfId } from "trystero/nostr";
import { THEMES, shuffle, newTarget, scoreFor } from "./constants";

const APP_ID = "spectra-lr-game-v1";
// Curated, reliable public Nostr relays for signaling (avoids dead defaults).
// Trystero only uses these to introduce peers; gameplay is direct WebRTC.
const RELAY_URLS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.nostr.band",
  "wss://relay.snort.social",
  "wss://nostr.mom",
];
const ROOM_CONFIG = { appId: APP_ID, relayUrls: RELAY_URLS, relayRedundancy: 4 };
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1
export const genCode = () => Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");

// stable per-browser identity so a refresh/rejoin keeps your seat + score
function persistentPid() {
  try {
    let p = localStorage.getItem("spectra_pid");
    if (!p) { p = selfId + "-" + Math.random().toString(36).slice(2, 8); localStorage.setItem("spectra_pid", p); }
    return p;
  } catch (e) { return selfId; }
}
const savedName = () => { try { return localStorage.getItem("spectra_name") || ""; } catch (e) { return ""; } };
const saveName = (n) => { try { localStorage.setItem("spectra_name", n); } catch (e) {} };

const connectedPlayers = (room) => room.players.filter((p) => p.connected);

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

  const myPid = useRef(persistentPid()).current;
  const roomRef = useRef(null);          // host's authoritative copy
  const apiRef = useRef(null);           // { sendRoom, sendAct, sendGuess, leave }
  const isHostRef = useRef(false);
  const deckRef = useRef({ deck: [], ptr: 0 });
  const targetRef = useRef({ round: -1, value: null }); // master-only secret
  const guessRef = useRef({ round: -1, byPid: {} });     // master-only collected guesses
  const helloRef = useRef({ name: "" });

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
        if (ex) { ex.connected = true; ex.peerId = from; if (payload.name) ex.name = payload.name; }
        else if (r.players.length < 8) {
          r.players.push({ pid: payload.pid, name: payload.name || "Player", score: 0, connected: true, peerId: from });
        } else return; // room full
        broadcast();
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
        r.clue = String(payload.clue || "").slice(0, 40); r.status = "guessing"; r.lockedCount = 0;
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
    apiRef.current = { sendRoom, sendAct, sendGuess, leave: () => r.leave() };

    if (asHost) {
      roomRef.current = {
        code, hostPid: myPid, status: "lobby",
        players: [{ pid: myPid, name, score: 0, connected: true, peerId: selfId }],
        round: 1, masterId: myPid, theme: THEMES[0], clue: "", lockedCount: 0, results: [], target: null, version: 0,
      };
      deckRef.current = { deck: shuffle(THEMES.map((_, i) => i)), ptr: 0 };
      setRoom({ ...roomRef.current });
    }

    // everyone listens for room snapshots from the host
    getRoom((data) => { roomRef.current = isHostRef.current ? roomRef.current : data; setRoom(data); });
    // host handles actions from peers
    getAct((data, peer) => { if (isHostRef.current) applyAct(peer, data); });
    // master collects guesses sent directly to it
    getGuess((data) => {
      const r2 = roomRef.current;
      if (!data || typeof data.angle !== "number") return;
      if (guessRef.current.round !== curRoundRef.current) guessRef.current = { round: curRoundRef.current, byPid: {} };
      guessRef.current.byPid[data.pid] = Math.max(0, Math.min(180, data.angle));
      const locked = Object.keys(guessRef.current.byPid).length;
      dispatch("prog", { locked });
    });

    r.onPeerJoin(() => { sayHello(); });
    r.onPeerLeave((peer) => {
      if (!isHostRef.current) return;
      const rr = roomRef.current; if (!rr) return;
      const p = rr.players.find((x) => x.peerId === peer);
      if (p) { p.connected = false; broadcast(); }
    });

    setStatus("connected");
    // announce ourselves to the host (covers host connecting slightly later)
    const sayHello = () => { try { sendAct({ type: "hello", payload: { pid: myPid, name: helloRef.current.name } }); } catch (e) {} };
    helloRef.current.say = sayHello;
    sayHello();
    setTimeout(sayHello, 600);
    setTimeout(sayHello, 1500);
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
  // generate the secret when this device becomes master and the spin begins
  useEffect(() => {
    if (!room) return;
    if (amMaster && (room.status === "spin") && targetRef.current.round !== room.round) {
      targetRef.current = { round: room.round, value: newTarget() };
      guessRef.current = { round: room.round, byPid: {} };
    }
  }, [room?.status, room?.round, amMaster]);

  // ---------- public actions ----------
  const create = useCallback((name) => { connect(genCode(), (name || "Host").trim().slice(0, 16), true); }, [connect]);
  const createWithCode = useCallback((code, name) => { connect(code, (name || "Host").trim().slice(0, 16), true); }, [connect]);
  const join = useCallback((code, name) => { connect(code.toUpperCase().trim(), (name || "Player").trim().slice(0, 16), false); }, [connect]);

  const leave = useCallback(() => {
    try { apiRef.current && apiRef.current.leave(); } catch (e) {}
    apiRef.current = null; roomRef.current = null; isHostRef.current = false;
    targetRef.current = { round: -1, value: null }; guessRef.current = { round: -1, byPid: {} };
    setRoom(null); setStatus("idle");
  }, []);

  const startGame = useCallback(() => dispatch("start", {}), [dispatch]);
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

  // master: compute scores from collected guesses + secret target, then reveal
  const revealNow = useCallback(() => {
    const r = roomRef.current || room; if (!r) return;
    const tgt = targetRef.current.value;
    const guesses = guessRef.current.byPid || {};
    const results = Object.entries(guesses).map(([pid, guess]) => ({ pid, guess, pts: scoreFor(guess, tgt) }));
    dispatch("reveal", { target: tgt, results });
  }, [dispatch, room]);

  useEffect(() => () => { try { apiRef.current && apiRef.current.leave(); } catch (e) {} }, []);

  return {
    room, status, error, myPid, selfId,
    isHost: room ? room.hostPid === myPid : false,
    amMaster: !!amMaster,
    secretTarget: amMaster && targetRef.current.round === (room && room.round) ? targetRef.current.value : null,
    localLocked: guessRef.current.byPid ? Object.keys(guessRef.current.byPid).length : 0,
    savedName,
    create, createWithCode, join, leave,
    startGame, voteSkip, votePlay, finishSpin, submitClue, submitGuess,
    revealNow, nextRound, endGame, playAgain, reassignMaster,
  };
}
