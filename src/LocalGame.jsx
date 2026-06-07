import React, { useState, useRef, useEffect } from "react";
import { EyeOff, Eye, SkipForward, Lock, ArrowRight, Crown, RotateCcw, Flag, ArrowLeft } from "lucide-react";
import { THEMES, PLAYER_COLORS, btn, shuffle, newTarget, scoreFor } from "./constants";
import { DialBoard } from "./Dial";
import { HoldButton, Confetti, PlayerEditor } from "./ui";

export default function LocalGame({ onExit }) {
  const [phase, setPhase] = useState("setup");
  const [players, setPlayers] = useState([{ name: "Player 1", score: 0 }, { name: "Player 2", score: 0 }]);
  const [round, setRound] = useState(1);
  const [masterIdx, setMasterIdx] = useState(0);

  const [deck, setDeck] = useState([]);
  const [deckPtr, setDeckPtr] = useState(0);
  const [theme, setTheme] = useState(THEMES[0]);
  const [target, setTarget] = useState(90);
  const [clue, setClue] = useState("");

  const [needle, setNeedle] = useState(90);
  const [guessOrder, setGuessOrder] = useState([]);
  const [guessPtr, setGuessPtr] = useState(0);
  const [results, setResults] = useState([]);
  const [revealed, setRevealed] = useState(false);

  const [spinning, setSpinning] = useState(false);
  const [spinAngle, setSpinAngle] = useState(90);
  const spinRaf = useRef(0);
  const [locking, setLocking] = useState(false);

  const drawTheme = (d, p) => {
    let dk = d, ptr = p;
    if (ptr >= dk.length) { dk = shuffle(THEMES.map((_, i) => i)); ptr = 0; setDeck(dk); }
    setTheme(THEMES[dk[ptr]]); setDeckPtr(ptr + 1);
  };

  const startGame = () => {
    const valid = players.filter((p) => p.name.trim());
    if (valid.length < 2) return;
    setPlayers(valid.map((p) => ({ name: p.name.trim(), score: 0 })));
    const dk = shuffle(THEMES.map((_, i) => i));
    setDeck(dk); setTheme(THEMES[dk[0]]); setDeckPtr(1);
    setTarget(newTarget()); setMasterIdx(0); setRound(1); setClue("");
    setPhase("themeVote");
  };

  const voteSkip = () => { setTarget(newTarget()); drawTheme(deck, deckPtr); };
  const voteStart = () => setPhase("masterHandoff");

  const confirmClue = () => {
    if (!clue.trim()) return;
    const order = players.map((_, i) => i).filter((i) => i !== masterIdx);
    setGuessOrder(order); setGuessPtr(0); setResults([]); setNeedle(90);
    setPhase("guessHandoff");
  };

  const lockGuess = () => {
    const idx = guessOrder[guessPtr];
    const pts = scoreFor(needle, target);
    const next = [...results, { idx, guess: needle, pts }];
    setResults(next);
    if (guessPtr + 1 < guessOrder.length) { setGuessPtr(guessPtr + 1); setNeedle(90); setPhase("guessHandoff"); }
    else {
      setPlayers((prev) => prev.map((p, i) => {
        const r = next.find((x) => x.idx === i);
        return r ? { ...p, score: p.score + r.pts } : p;
      }));
      setRevealed(false); setPhase("reveal");
    }
  };

  const doLock = () => {
    if (locking) return;
    setLocking(true);
    try { if (navigator.vibrate) navigator.vibrate([0, 35, 45, 30]); } catch (e) {}
    setTimeout(() => { setLocking(false); lockGuess(); }, 680);
  };

  const nextRound = () => {
    setRound(round + 1);
    setMasterIdx((masterIdx + 1) % players.length);
    setTarget(newTarget()); setClue(""); drawTheme(deck, deckPtr);
    setPhase("themeVote");
  };

  const playAgain = () => { setPlayers((p) => p.map((x) => ({ ...x, score: 0 }))); onExit(); };

  const master = players[masterIdx];
  const curGuesser = players[guessOrder[guessPtr]];

  useEffect(() => {
    if (phase !== "master") return;
    setSpinning(true);
    const T = 2800;
    const travel = 3 * 360 + target;
    const tri = (x) => { const m = ((x % 360) + 360) % 360; return m <= 180 ? m : 360 - m; };
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / T);
      const ease = 1 - Math.pow(1 - p, 3);
      setSpinAngle(tri(ease * travel));
      if (p < 1) spinRaf.current = requestAnimationFrame(tick);
      else { setSpinAngle(target); setSpinning(false); }
    };
    spinRaf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(spinRaf.current);
  }, [phase, round, target]);

  return (
    <>
      {phase === "setup" && (
        <div className="space-y-5">
          <button onClick={onExit} className="flex items-center gap-1.5 text-sm" style={{ color: "#8a94a6" }}><ArrowLeft size={15} /> Back</button>
          <PlayerEditor players={players} setPlayers={setPlayers} min={2} />
          <button onClick={startGame} disabled={players.filter((p) => p.name.trim()).length < 2}
            className={`${btn} w-full py-4 flex items-center justify-center gap-2`} style={{ background: "linear-gradient(135deg,#4ade80,#22d3ee)", color: "#06140f", fontSize: 16, fontWeight: 700 }}>
            Start game <ArrowRight size={18} />
          </button>
        </div>
      )}

      {phase === "themeVote" && (
        <div className="space-y-5">
          <div className="text-center text-[11px] tracking-[0.22em] uppercase" style={{ color: "#6b7686" }}>Round {round} · the spectrum is</div>
          <div className="rounded-2xl px-4 py-9 flex items-center justify-between gap-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="flex-1 text-center px-3 py-3 rounded-lg font-bold text-[15px] uppercase tracking-[0.06em] leading-tight" style={{ color: "#7dd3fc", background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.3)", fontFamily: "'Space Mono', monospace" }}>{theme[0]}</span>
            <span className="text-zinc-600 text-sm shrink-0">↔</span>
            <span className="flex-1 text-center px-3 py-3 rounded-lg font-bold text-[15px] uppercase tracking-[0.06em] leading-tight" style={{ color: "#fdba74", background: "rgba(251,146,60,0.12)", border: "1px solid rgba(251,146,60,0.3)", fontFamily: "'Space Mono', monospace" }}>{theme[1]}</span>
          </div>
          <p className="text-center text-sm" style={{ color: "#8a94a6" }}>Everyone happy with this one? Play it, or vote to skip for a fresh spectrum.</p>
          <div className="flex gap-2">
            <button onClick={voteSkip} className={`${btn} flex-1 px-4 py-3.5 flex items-center justify-center gap-2 whitespace-nowrap`} style={{ background: "rgba(255,255,255,0.05)", color: "#9aa4b4" }}>
              <SkipForward size={16} /> Skip
            </button>
            <button onClick={voteStart} className={`${btn} flex-[1.6] px-5 py-3.5 flex items-center justify-center gap-2 whitespace-nowrap`} style={{ background: "linear-gradient(135deg,#4ade80,#22d3ee)", color: "#06140f", fontWeight: 700 }}>
              Play this round <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {(phase === "masterHandoff" || phase === "guessHandoff") && (
        <button onClick={() => setPhase(phase === "masterHandoff" ? "master" : "guess")}
          className="w-full rounded-2xl flex flex-col items-center justify-center text-center active:scale-[0.99] transition-transform"
          style={{ minHeight: 360, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", padding: 24 }}>
          <EyeOff size={34} color="#6b7686" />
          <div className="mt-5 text-[11px] tracking-[0.22em] uppercase" style={{ color: "#6b7686" }}>Pass the device to</div>
          <div className="mt-1 flex items-center gap-2" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 30 }}>
            {phase === "masterHandoff" && <Crown size={22} color="#facc15" />}
            {phase === "masterHandoff" ? master.name : curGuesser.name}
          </div>
          <div className="mt-1 text-sm" style={{ color: "#8a94a6" }}>{phase === "masterHandoff" ? "you are the Master" : "you are guessing"}</div>
          <div className="mt-8 px-5 py-2.5 rounded-full flex items-center gap-2" style={{ background: "rgba(74,222,128,0.12)", color: "#86efac", fontSize: 14, fontWeight: 600 }}>
            <Eye size={16} /> Tap when ready
          </div>
          <div className="mt-3 text-[11px]" style={{ color: "#5b6675" }}>everyone else, look away</div>
        </button>
      )}

      {phase === "master" && (
        <div className="space-y-4">
          <DialBoard theme={theme} value={spinning ? spinAngle : target} target={spinning ? null : target}
            showNumbers={!spinning} forceNeedle={spinning} onChange={undefined} markers={[]} />
          {spinning ? (
            <p className="text-center text-sm animate-pulse" style={{ color: "#67e8f9" }}>Spinning up a random angle…</p>
          ) : (
            <>
              <p className="text-center text-sm" style={{ color: "#86efac" }}>This is the secret target. Give a clue that lands the guessers on the bullseye.</p>
              <input value={clue} maxLength={40} onChange={(e) => setClue(e.target.value)} placeholder="Type a word or phrase…"
                className="w-full px-4 py-3.5 rounded-xl outline-none text-center"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(74,222,128,0.3)", color: "#e7ecf3", fontSize: 17, fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 600 }} />
              <button onClick={confirmClue} disabled={!clue.trim()}
                className={`${btn} w-full py-3.5 flex items-center justify-center gap-2`} style={{ background: "linear-gradient(135deg,#4ade80,#22d3ee)", color: "#06140f", fontWeight: 700, fontSize: 16 }}>
                Lock clue <ArrowRight size={16} />
              </button>
            </>
          )}
        </div>
      )}

      {phase === "guess" && (
        <div className="space-y-4">
          <div className="rounded-xl px-4 py-3 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-[10px] tracking-[0.2em] uppercase" style={{ color: "#6b7686" }}>{master.name}'s clue</div>
            <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 22, marginTop: 2 }}>“{clue}”</div>
          </div>
          <DialBoard theme={theme} value={needle} onChange={locking ? undefined : setNeedle} forceNeedle={locking} pulseAt={locking ? needle : null} markers={[]} />
          <p className="text-center text-sm" style={{ color: "#8a94a6" }}>
            <b style={{ color: PLAYER_COLORS[guessOrder[guessPtr] % PLAYER_COLORS.length] }}>{curGuesser.name}</b> — drag the needle, then lock it in.
          </p>
          <button onClick={doLock} disabled={locking}
            className={`${btn} w-full py-4 flex items-center justify-center gap-2 ${locking ? "lockpop" : ""}`}
            style={{ background: locking ? "linear-gradient(135deg,#86efac,#67e8f9)" : "linear-gradient(135deg,#4ade80,#22d3ee)", color: "#06140f", fontWeight: 700, fontSize: 16, boxShadow: locking ? "0 0 28px rgba(74,222,128,0.6)" : "none" }}>
            <Lock size={17} /> {locking ? "Locked!" : "Lock in guess"}
          </button>
        </div>
      )}

      {phase === "reveal" && (
        <div className="space-y-4">
          <div className="rounded-xl px-4 py-2.5 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "#6b7686" }}>clue </span>
            <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 17 }}>“{clue}”</span>
          </div>
          <DialBoard theme={theme} value={target} target={revealed ? target : null}
            markers={revealed ? results.map((r) => ({ angle: r.guess, color: PLAYER_COLORS[r.idx % PLAYER_COLORS.length] })) : []} onChange={undefined} />
          {!revealed ? (
            <>
              <HoldButton onComplete={() => setRevealed(true)} />
              <p className="text-center text-[12px] -mt-1" style={{ color: "#5b6675" }}>press &amp; hold — let go to stop</p>
            </>
          ) : (
            <>
              {results.some((r) => r.pts === 4) && <Confetti />}
              <div className="space-y-1.5">
                {players.map((p, i) => ({ ...p, i })).sort((a, b) => b.score - a.score).map((p) => {
                  const isMaster = p.i === masterIdx;
                  const gained = isMaster ? null : (results.find((r) => r.idx === p.i)?.pts ?? 0);
                  return (
                    <div key={p.i} className="flex items-center justify-between rounded-lg px-3 py-2.5"
                      style={{ background: isMaster ? "rgba(250,204,21,0.07)" : "rgba(255,255,255,0.03)", border: isMaster ? "1px solid rgba(250,204,21,0.18)" : "1px solid transparent" }}>
                      <span className="flex items-center gap-2 text-sm">
                        {isMaster ? <Crown size={15} color="#facc15" /> : <span style={{ width: 9, height: 9, borderRadius: 9, background: PLAYER_COLORS[p.i % PLAYER_COLORS.length] }} />}
                        <span className="font-semibold">{p.name}</span>
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
              <div className="flex gap-2">
                <button onClick={() => setPhase("gameover")} className={`${btn} flex-1 px-4 py-3.5 flex items-center justify-center gap-2 whitespace-nowrap`} style={{ background: "rgba(255,255,255,0.05)", color: "#9aa4b4" }}>
                  <Flag size={15} /> End game
                </button>
                <button onClick={nextRound} className={`${btn} flex-[1.6] px-5 py-3.5 flex items-center justify-center gap-2 whitespace-nowrap`} style={{ background: "linear-gradient(135deg,#4ade80,#22d3ee)", color: "#06140f", fontWeight: 700 }}>
                  Next round <ArrowRight size={17} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {phase === "gameover" && (
        <div className="space-y-4">
          <div className="text-center" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 26 }}>Final scores</div>
          <div className="space-y-2">
            {[...players].sort((a, b) => b.score - a.score).map((p, i) => (
              <div key={p.name + i} className="flex items-center justify-between rounded-xl px-4 py-3"
                style={{ background: i === 0 ? "linear-gradient(135deg,rgba(74,222,128,0.16),rgba(34,211,238,0.10))" : "rgba(255,255,255,0.03)", border: i === 0 ? "1px solid rgba(74,222,128,0.35)" : "1px solid rgba(255,255,255,0.06)" }}>
                <span className="flex items-center gap-3">
                  <span style={{ fontFamily: "'Space Mono', monospace", color: "#6b7686", width: 18 }}>{i + 1}</span>
                  {i === 0 && <Crown size={17} color="#facc15" />}
                  <span style={{ fontWeight: i === 0 ? 700 : 500, fontSize: 16 }}>{p.name}</span>
                </span>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, color: i === 0 ? "#4ade80" : "#9aa4b4" }}>{p.score}</span>
              </div>
            ))}
          </div>
          <button onClick={playAgain} className={`${btn} w-full py-4 flex items-center justify-center gap-2`} style={{ background: "linear-gradient(135deg,#4ade80,#22d3ee)", color: "#06140f", fontWeight: 700, fontSize: 16 }}>
            <RotateCcw size={17} /> Back to menu
          </button>
        </div>
      )}
    </>
  );
}
