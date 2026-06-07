import React, { useState, useRef, useEffect } from "react";
import { Eye, Lock, ArrowRight, Crown, RotateCcw, SkipForward, Flag, ArrowLeft, Copy, Check, Share2, Users, Wifi, WifiOff } from "lucide-react";
import { PLAYER_COLORS, btn } from "./constants";
import { DialBoard } from "./Dial";
import { HoldButton, Confetti, RevealMeter, useRevealStage, ClueThinking, ThemeBar } from "./ui";

// master-only: spin the needle ~3 loops, decelerate, land on the secret target
function SpinDial({ theme, target, onDone }) {
  const [angle, setAngle] = useState(90);
  const raf = useRef(0);
  useEffect(() => {
    const T = 2800, travel = 3 * 360 + target;
    const tri = (x) => { const m = ((x % 360) + 360) % 360; return m <= 180 ? m : 360 - m; };
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / T);
      const ease = 1 - Math.pow(1 - p, 3);
      setAngle(tri(ease * travel));
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else { setAngle(target); setTimeout(onDone, 650); }
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target]);
  return <DialBoard theme={theme} value={angle} target={null} forceNeedle onChange={undefined} markers={[]} />;
}

function Waiting({ title, sub }) {
  return (
    <div className="rounded-2xl flex flex-col items-center justify-center text-center" style={{ minHeight: 320, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", padding: 28 }}>
      <div className="flex gap-1.5 mb-5">
        {[0, 1, 2].map((i) => <span key={i} className="rounded-full animate-pulse" style={{ width: 9, height: 9, background: "#4ade80", animationDelay: `${i * 0.18}s` }} />)}
      </div>
      <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 21 }}>{title}</div>
      {sub && <div className="mt-2 text-sm" style={{ color: "#8a94a6" }}>{sub}</div>}
    </div>
  );
}

export default function OnlineGame({ party, onExit }) {
  const { room, myPid, isHost, amMaster, secretTarget, localLocked } = party;
  const [needle, setNeedle] = useState(90);
  const [locking, setLocking] = useState(false);
  const [locked, setLocked] = useState(false);
  const [copied, setCopied] = useState(null);
  const lastRound = useRef(-1);

  // reset per-round local state
  useEffect(() => {
    if (!room) return;
    if (room.round !== lastRound.current || room.status === "themeVote" || room.status === "lobby") {
      if (room.status !== "guessing" && room.status !== "reveal") { setLocked(false); setNeedle(90); }
    }
    if (room.status === "guessing" && lastRound.current !== room.round) { setLocked(false); setNeedle(90); }
    lastRound.current = room.round;
  }, [room?.status, room?.round]);

  // suspenseful staged reveal (bands 4→3→2, then scoreboard)
  const revealStage = useRevealStage(!!(room && room.status === "reveal"));

  if (!room) return null;

  const players = room.players;
  const connected = players.filter((p) => p.connected);
  const master = players.find((p) => p.pid === room.masterId);
  const me = players.find((p) => p.pid === myPid);
  const guesserCount = Math.max(0, connected.length - 1);
  const link = `${location.origin}${location.pathname}?room=${room.code}`;

  const copy = (what, text) => {
    try { navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(null), 1400); } catch (e) {}
  };
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: "Spectra", text: `Join my Spectra game — code ${room.code}`, url: link });
      else copy("link", link);
    } catch (e) {}
  };

  const doLock = () => {
    if (locking || locked) return;
    setLocking(true);
    try { if (navigator.vibrate) navigator.vibrate([0, 35, 45, 30]); } catch (e) {}
    party.submitGuess(needle);
    setTimeout(() => { setLocking(false); setLocked(true); }, 680);
  };

  const Header = (
    <div className="flex items-center justify-between mb-1">
      <div className="flex items-center gap-2 text-[12px]" style={{ color: "#8a94a6", fontFamily: "'Space Mono',monospace" }}>
        <span className="px-2 py-1 rounded-md" style={{ background: "rgba(34,211,238,0.12)", color: "#67e8f9", letterSpacing: "0.15em" }}>{room.code}</span>
        {room.status !== "lobby" && <span>RND {room.round}</span>}
      </div>
      <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "#6b7686" }}>
        <Users size={13} /> {connected.length}
      </div>
    </div>
  );

  // ---------------- LOBBY ----------------
  if (room.status === "lobby") {
    return (
      <div className="space-y-5">
        <button onClick={onExit} className="flex items-center gap-1.5 text-sm" style={{ color: "#8a94a6" }}><ArrowLeft size={15} /> Leave</button>
        <div className="rounded-2xl px-5 py-6 text-center" style={{ background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.22)" }}>
          <div className="text-[11px] tracking-[0.22em] uppercase" style={{ color: "#6b7686" }}>Party code</div>
          <button onClick={() => copy("code", room.code)} className="mt-2 inline-flex items-center gap-3 active:scale-95 transition-transform">
            <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 44, letterSpacing: "0.18em", color: "#67e8f9" }}>{room.code}</span>
            <span className="grid place-items-center rounded-lg" style={{ width: 34, height: 34, background: "rgba(255,255,255,0.06)" }}>{copied === "code" ? <Check size={17} color="#86efac" /> : <Copy size={16} color="#9aa4b4" />}</span>
          </button>
          <div className="flex gap-2 mt-4">
            <button onClick={() => copy("link", link)} className={`${btn} flex-1 py-2.5 flex items-center justify-center gap-2 text-sm`} style={{ background: "rgba(255,255,255,0.06)", color: "#cdd5e0" }}>
              {copied === "link" ? <Check size={15} color="#86efac" /> : <Copy size={15} />} {copied === "link" ? "Copied" : "Copy link"}
            </button>
            <button onClick={share} className={`${btn} flex-1 py-2.5 flex items-center justify-center gap-2 text-sm`} style={{ background: "rgba(255,255,255,0.06)", color: "#cdd5e0" }}>
              <Share2 size={15} /> Share
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[11px] tracking-[0.18em] uppercase" style={{ color: "#6b7686" }}>In the lobby</span>
            <span className="text-[11px]" style={{ color: "#6b7686", fontFamily: "'Space Mono',monospace" }}>{connected.length} player{connected.length > 1 ? "s" : ""}</span>
          </div>
          <div className="space-y-1.5">
            {players.map((p, i) => (
              <div key={p.pid} className="flex items-center justify-between rounded-lg px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", opacity: p.connected ? 1 : 0.4 }}>
                <span className="flex items-center gap-2.5 text-sm">
                  <span style={{ width: 9, height: 9, borderRadius: 9, background: PLAYER_COLORS[i % PLAYER_COLORS.length] }} />
                  <span className="font-semibold">{p.name}</span>
                  {p.pid === room.hostPid && <span className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide" style={{ background: "rgba(250,204,21,0.14)", color: "#facc15" }}>host</span>}
                  {p.pid === myPid && <span style={{ color: "#6b7686" }}>(you)</span>}
                </span>
                {p.connected ? <Wifi size={14} color="#4ade80" /> : <WifiOff size={14} color="#5b6675" />}
              </div>
            ))}
          </div>
        </div>

        {isHost ? (
          <button onClick={party.startGame} disabled={connected.length < 2}
            className={`${btn} w-full py-4 flex items-center justify-center gap-2`} style={{ background: "linear-gradient(135deg,#4ade80,#22d3ee)", color: "#06140f", fontSize: 16, fontWeight: 700 }}>
            {connected.length < 2 ? "Waiting for players…" : "Start game"} <ArrowRight size={18} />
          </button>
        ) : (
          <Waiting title="Waiting for the host" sub="They'll start the game once everyone's in." />
        )}
      </div>
    );
  }

  // ---------------- THEME VOTE ----------------
  if (room.status === "themeVote") {
    return (
      <div className="space-y-5">
        {Header}
        <div className="text-center text-[11px] tracking-[0.22em] uppercase" style={{ color: "#6b7686" }}>Round {room.round} · the spectrum is</div>
        <div className="rounded-2xl px-4 py-9 flex items-center justify-between gap-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="flex-1 text-center px-3 py-3 rounded-lg font-bold text-[15px] uppercase tracking-[0.06em] leading-tight" style={{ color: "#7dd3fc", background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.3)", fontFamily: "'Space Mono', monospace" }}>{room.theme[0]}</span>
          <span className="text-zinc-600 text-sm shrink-0">↔</span>
          <span className="flex-1 text-center px-3 py-3 rounded-lg font-bold text-[15px] uppercase tracking-[0.06em] leading-tight" style={{ color: "#fdba74", background: "rgba(251,146,60,0.12)", border: "1px solid rgba(251,146,60,0.3)", fontFamily: "'Space Mono', monospace" }}>{room.theme[1]}</span>
        </div>
        <div className="text-center text-sm" style={{ color: "#8a94a6" }}>
          <Crown size={14} color="#facc15" className="inline mb-0.5" /> <b>{master?.name}</b> is the Master this round.
        </div>
        {amMaster ? (
          <div className="flex gap-2">
            <button onClick={party.voteSkip} className={`${btn} flex-1 px-4 py-3.5 flex items-center justify-center gap-2`} style={{ background: "rgba(255,255,255,0.05)", color: "#9aa4b4" }}>
              <SkipForward size={16} /> Skip
            </button>
            <button onClick={party.votePlay} className={`${btn} flex-[1.6] px-5 py-3.5 flex items-center justify-center gap-2`} style={{ background: "linear-gradient(135deg,#4ade80,#22d3ee)", color: "#06140f", fontWeight: 700 }}>
              Play this round <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          <p className="text-center text-sm" style={{ color: "#6b7686" }}>Waiting for {master?.name} to start the round…</p>
        )}
        {isHost && master && !master.connected && (
          <button onClick={party.reassignMaster} className={`${btn} w-full py-2.5 text-sm`} style={{ background: "rgba(248,113,113,0.12)", color: "#fca5a5" }}>Master left — pass to next player</button>
        )}
      </div>
    );
  }

  // ---------------- SPIN ----------------
  if (room.status === "spin") {
    return (
      <div className="space-y-4">
        {Header}
        {amMaster && secretTarget != null ? (
          <>
            <SpinDial theme={room.theme} target={secretTarget} onDone={party.finishSpin} />
            <p className="text-center text-sm animate-pulse" style={{ color: "#67e8f9" }}>Spinning up your secret angle…</p>
          </>
        ) : (
          <>
            {/* show the board + its two poles so guessers can already size up the spectrum */}
            <DialBoard theme={room.theme} value={90} target={null} onChange={undefined} markers={[]} />
            <div className="flex flex-col items-center gap-2">
              <div className="flex gap-1.5">
                {[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ width: 8, height: 8, borderRadius: 8, background: "#4ade80", animation: `thinkdot 1.1s ease-in-out ${i * 0.12}s infinite` }} />)}
              </div>
              <p className="text-center" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 18 }}>{master?.name} is getting their angle</p>
              <p className="text-center text-sm" style={{ color: "#8a94a6" }}>Here's the spectrum you'll be reading.</p>
            </div>
          </>
        )}
      </div>
    );
  }

  // ---------------- CLUE (master types) ----------------
  if (room.status === "clue") {
    if (amMaster) return <MasterClue party={party} />;
    return <div className="space-y-4">{Header}<ThemeBar theme={room.theme} /><ClueThinking masterName={master?.name} /></div>;
  }

  // ---------------- GUESSING ----------------
  if (room.status === "guessing") {
    const idxOf = (pid) => players.findIndex((p) => p.pid === pid);
    const liveMarkers = Object.entries(party.liveNeedles || {}).map(([pid, a]) => ({ angle: a, color: PLAYER_COLORS[idxOf(pid) % PLAYER_COLORS.length] }));
    const lockedSet = new Set(party.lockedPids || []);
    const clueCard = (
      <div className="rounded-xl px-4 py-3 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="text-[10px] tracking-[0.2em] uppercase" style={{ color: "#6b7686" }}>{master?.name}'s clue</div>
        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 22, marginTop: 2 }}>“{room.clue}”</div>
      </div>
    );
    const Legend = ({ showLock }) => (
      <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center">
        {players.filter((p) => p.pid !== room.masterId && p.connected).map((p) => (
          <span key={p.pid} className="flex items-center gap-1.5 text-[12px]" style={{ color: "#9aa4b4" }}>
            <span style={{ width: 8, height: 8, borderRadius: 8, background: PLAYER_COLORS[idxOf(p.pid) % PLAYER_COLORS.length] }} />
            {p.name}{p.pid === myPid ? " (you)" : ""}
            {showLock && lockedSet.has(p.pid) && <Lock size={11} color="#4ade80" />}
          </span>
        ))}
      </div>
    );

    if (amMaster) {
      const allLocked = guesserCount === 0 || localLocked >= guesserCount;
      return (
        <div className="space-y-4">
          {Header}{clueCard}
          <DialBoard theme={room.theme} value={secretTarget ?? 90} target={secretTarget} markers={liveMarkers} onChange={undefined} />
          <Legend showLock />
          {allLocked ? (
            <>
              <div className="rounded-xl px-4 py-3 flex items-center justify-center gap-2 spinpop" style={{ background: "rgba(74,222,128,0.14)", border: "1px solid rgba(74,222,128,0.45)", boxShadow: "0 0 22px rgba(74,222,128,0.25)" }}>
                <Check size={18} color="#4ade80" />
                <span style={{ color: "#86efac", fontWeight: 700 }}>Everyone's locked in — reveal unlocked!</span>
              </div>
              <HoldButton onComplete={party.revealNow} onProgress={party.pushCharge} />
              <p className="text-center text-[12px] -mt-1" style={{ color: "#5b6675" }}>hold to reveal</p>
            </>
          ) : (
            <>
              <p className="text-center text-sm" style={{ color: "#8a94a6" }}>
                Watching guesses land — <b style={{ color: "#67e8f9", fontFamily: "'Space Mono',monospace" }}>{localLocked}/{guesserCount}</b> locked in.
              </p>
              <div className="w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#5b6675", fontSize: 16 }}>
                <Lock size={17} /> Waiting for all guesses…
              </div>
              <p className="text-center text-[12px] -mt-1" style={{ color: "#5b6675" }}>reveal unlocks once everyone has locked in</p>
            </>
          )}
        </div>
      );
    }
    // guesser who has locked → shared "master-style" view: everyone's live needles, no bands
    if (locked) {
      return (
        <div className="space-y-4">
          {Header}{clueCard}
          <DialBoard theme={room.theme} value={needle} target={null} markers={liveMarkers} onChange={undefined} />
          <Legend />
          <p className="text-center text-sm" style={{ color: "#86efac" }}>
            {room.lockedCount >= guesserCount ? "Everyone's in — get ready!" : `Locked in! Watch the others — ${room.lockedCount}/${guesserCount} in`}
          </p>
          <RevealMeter charge={party.revealCharge} />
        </div>
      );
    }
    // guesser still choosing → only their own needle (can't see others yet)
    return (
      <div className="space-y-4">
        {Header}{clueCard}
        <DialBoard theme={room.theme} value={needle} onChange={locking ? undefined : (a) => { setNeedle(a); party.pushLive(a); }} forceNeedle={locking} pulseAt={locking ? needle : null} markers={[]} />
        <p className="text-center text-sm" style={{ color: "#8a94a6" }}>Drag the needle to where you think the target is, then lock it in.</p>
        <button onClick={doLock} disabled={locking}
          className={`${btn} w-full py-4 flex items-center justify-center gap-2 ${locking ? "lockpop" : ""}`}
          style={{ background: locking ? "linear-gradient(135deg,#86efac,#67e8f9)" : "linear-gradient(135deg,#4ade80,#22d3ee)", color: "#06140f", fontWeight: 700, fontSize: 16, boxShadow: locking ? "0 0 28px rgba(74,222,128,0.6)" : "none" }}>
          <Lock size={17} /> {locking ? "Locked!" : "Lock in guess"}
        </button>
        <p className="text-center text-[12px]" style={{ color: "#5b6675" }}>{room.lockedCount}/{guesserCount} locked in</p>
      </div>
    );
  }

  // ---------------- REVEAL ----------------
  if (room.status === "reveal") {
    const idxOf = (pid) => players.findIndex((p) => p.pid === pid);
    const gotBullseye = room.results.some((r) => r.pts === 4);
    const showScores = revealStage >= 4;
    return (
      <div className="space-y-4">
        {Header}
        <div className="rounded-xl px-4 py-2.5 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "#6b7686" }}>clue </span>
          <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 17 }}>“{room.clue}”</span>
        </div>
        <DialBoard theme={room.theme} value={room.target ?? 90} target={room.target} showNumbers revealStage={revealStage}
          markers={room.results.map((r) => ({ angle: r.guess, color: PLAYER_COLORS[idxOf(r.pid) % PLAYER_COLORS.length] }))} onChange={undefined} />
        {!showScores ? (
          <p className="text-center text-sm animate-pulse" style={{ color: "#67e8f9" }}>
            {revealStage === 0 ? "Here come the guesses…" : revealStage < 3 ? "Scoring zones appearing…" : "Tallying the round…"}
          </p>
        ) : (
          <>
            {gotBullseye && <Confetti />}
            <div className="space-y-1.5">
              {players.map((p) => ({ ...p, i: idxOf(p.pid) })).sort((a, b) => b.score - a.score).map((p, rank) => {
                const isMaster = p.pid === room.masterId;
                const gained = isMaster ? null : (room.results.find((r) => r.pid === p.pid)?.pts ?? 0);
                return (
                  <div key={p.pid} className="fadeup flex items-center justify-between rounded-lg px-3 py-2.5" style={{ animationDelay: `${rank * 70}ms`, background: isMaster ? "rgba(250,204,21,0.07)" : "rgba(255,255,255,0.03)", border: isMaster ? "1px solid rgba(250,204,21,0.18)" : "1px solid transparent", opacity: p.connected ? 1 : 0.5 }}>
                    <span className="flex items-center gap-2 text-sm">
                      <span style={{ fontFamily: "'Space Mono',monospace", color: "#5b6675", width: 14, fontSize: 12 }}>{rank + 1}</span>
                      {isMaster ? <Crown size={15} color="#facc15" /> : <span style={{ width: 9, height: 9, borderRadius: 9, background: PLAYER_COLORS[p.i % PLAYER_COLORS.length] }} />}
                      <span className="font-semibold">{p.name}</span>
                      {p.pid === myPid && <span style={{ color: "#6b7686", fontWeight: 400 }}>(you)</span>}
                      {isMaster && <span style={{ color: "#8a94a6", fontWeight: 400 }}>(master)</span>}
                    </span>
                    <span className="flex items-center gap-2.5">
                      {gained != null && (
                        <span className="text-[12px] px-1.5 py-0.5 rounded" style={{ fontFamily: "'Space Mono', monospace", color: gained === 4 ? "#4ade80" : gained ? "#86efac" : "#5b6675", background: gained ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.04)" }}>+{gained}</span>
                      )}
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, color: "#e7ecf3", width: 26, textAlign: "right" }}>{p.score}</span>
                    </span>
                  </div>
                );
              })}
            </div>
            {amMaster ? (
              <div className="flex gap-2">
                <button onClick={party.endGame} className={`${btn} flex-1 px-4 py-3.5 flex items-center justify-center gap-2 whitespace-nowrap`} style={{ background: "rgba(255,255,255,0.05)", color: "#9aa4b4" }}>
                  <Flag size={15} /> End game
                </button>
                <button onClick={party.nextRound} className={`${btn} flex-[1.6] px-5 py-3.5 flex items-center justify-center gap-2 whitespace-nowrap`} style={{ background: "linear-gradient(135deg,#4ade80,#22d3ee)", color: "#06140f", fontWeight: 700 }}>
                  Next round <ArrowRight size={17} />
                </button>
              </div>
            ) : (
              <p className="text-center text-sm" style={{ color: "#6b7686" }}>Waiting for {master?.name} to continue…</p>
            )}
          </>
        )}
      </div>
    );
  }

  // ---------------- GAME OVER ----------------
  if (room.status === "gameover") {
    return (
      <div className="space-y-4">
        <div className="text-center" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 26 }}>Final scores</div>
        <div className="space-y-2">
          {[...players].sort((a, b) => b.score - a.score).map((p, i) => (
            <div key={p.pid} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: i === 0 ? "linear-gradient(135deg,rgba(74,222,128,0.16),rgba(34,211,238,0.10))" : "rgba(255,255,255,0.03)", border: i === 0 ? "1px solid rgba(74,222,128,0.35)" : "1px solid rgba(255,255,255,0.06)" }}>
              <span className="flex items-center gap-3">
                <span style={{ fontFamily: "'Space Mono', monospace", color: "#6b7686", width: 18 }}>{i + 1}</span>
                {i === 0 && <Crown size={17} color="#facc15" />}
                <span style={{ fontWeight: i === 0 ? 700 : 500, fontSize: 16 }}>{p.name}{p.pid === myPid && <span style={{ color: "#6b7686", fontWeight: 400 }}> (you)</span>}</span>
              </span>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, color: i === 0 ? "#4ade80" : "#9aa4b4" }}>{p.score}</span>
            </div>
          ))}
        </div>
        {isHost ? (
          <button onClick={party.playAgain} className={`${btn} w-full py-4 flex items-center justify-center gap-2`} style={{ background: "linear-gradient(135deg,#4ade80,#22d3ee)", color: "#06140f", fontWeight: 700, fontSize: 16 }}>
            <RotateCcw size={17} /> Play again
          </button>
        ) : (
          <Waiting title="Thanks for playing!" sub="Waiting for the host to start a rematch." />
        )}
        <button onClick={onExit} className="w-full text-center text-sm py-2" style={{ color: "#8a94a6" }}>Leave party</button>
      </div>
    );
  }

  return null;
}

// master's clue entry shows the target + bands (they already saw the spin land)
function MasterClue({ party }) {
  const { room, secretTarget } = party;
  const [clue, setClue] = useState("");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-1 text-[12px]" style={{ color: "#8a94a6", fontFamily: "'Space Mono',monospace" }}>
        <span className="px-2 py-1 rounded-md" style={{ background: "rgba(34,211,238,0.12)", color: "#67e8f9", letterSpacing: "0.15em" }}>{room.code}</span>
        <span>RND {room.round}</span>
      </div>
      <DialBoard theme={room.theme} value={secretTarget ?? 90} target={secretTarget} showNumbers onChange={undefined} markers={[]} />
      <p className="text-center text-sm" style={{ color: "#86efac" }}>This is your secret target. Give a clue that lands the guessers on the bullseye.</p>
      <textarea value={clue} maxLength={140} rows={2} onChange={(e) => setClue(e.target.value)} placeholder="Type a word or phrase…"
        className="w-full px-4 py-3 rounded-xl outline-none text-center resize-none"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(74,222,128,0.3)", color: "#e7ecf3", fontSize: 17, fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 600, lineHeight: 1.35 }} />
      <button onClick={() => clue.trim() && party.submitClue(clue.trim())} disabled={!clue.trim()}
        className={`${btn} w-full py-3.5 flex items-center justify-center gap-2`} style={{ background: "linear-gradient(135deg,#4ade80,#22d3ee)", color: "#06140f", fontWeight: 700, fontSize: 16 }}>
        Lock clue <ArrowRight size={16} />
      </button>
    </div>
  );
}
