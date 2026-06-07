import React, { useState, useRef, useEffect } from "react";
import { Eye, Plus, X } from "lucide-react";
import { btn, PLAYER_COLORS } from "./constants";

// Press-and-hold reveal button: fills, shakes harder as it charges, ramps haptics,
// drains ~2.5x faster on early release, auto-fires + firm buzz at full charge.
export function HoldButton({ onComplete, onProgress, duration = 1600 }) {
  const [c, setC] = useState(0);
  const cRef = useRef(0), holding = useRef(false), done = useRef(false);
  const raf = useRef(0), last = useRef(0), vacc = useRef(0);

  const stop = () => { cancelAnimationFrame(raf.current); raf.current = 0; last.current = 0; };
  const buzz = (n) => { try { if (navigator.vibrate) navigator.vibrate(n); } catch (e) {} };

  const frame = (ts) => {
    const dt = last.current ? Math.min(48, ts - last.current) : 16; last.current = ts;
    let n = holding.current ? cRef.current + dt / duration : cRef.current - dt / (duration * 0.4);
    n = Math.max(0, Math.min(1, n));
    cRef.current = n; setC(n); onProgress && onProgress(n); // broadcast charge to spectators
    if (holding.current) { vacc.current += dt; if (vacc.current > 75) { vacc.current = 0; buzz(Math.round(4 + n * 42)); } }
    if (n >= 1 && !done.current) { done.current = true; holding.current = false; buzz(130); onComplete(); stop(); return; }
    if (holding.current || n > 0) raf.current = requestAnimationFrame(frame); else stop();
  };
  const start = (e) => { e.preventDefault(); if (done.current) return; holding.current = true; if (!raf.current) raf.current = requestAnimationFrame(frame); };
  const release = () => { holding.current = false; buzz(0); if (!raf.current && cRef.current > 0) raf.current = requestAnimationFrame(frame); };
  useEffect(() => () => { cancelAnimationFrame(raf.current); buzz(0); }, []);

  const jx = c > 0.04 ? (Math.random() - 0.5) * c * 7 : 0;
  const jy = c > 0.04 ? (Math.random() - 0.5) * c * 7 : 0;
  const near = c > 0.8;
  return (
    <button
      onPointerDown={start} onPointerUp={release} onPointerLeave={release} onPointerCancel={release}
      onContextMenu={(e) => e.preventDefault()}
      className="relative w-full py-4 rounded-xl overflow-hidden select-none touch-none font-bold"
      style={{
        transform: `translate(${jx}px, ${jy}px) scale(${1 + c * 0.03})`,
        background: "rgba(255,255,255,0.05)",
        border: `1px solid rgba(74,222,128,${0.25 + c * 0.6})`,
        boxShadow: c > 0.02 ? `0 0 ${c * 34}px rgba(74,222,128,${c * 0.55})` : "none",
        color: c > 0.5 ? "#06140f" : "#e7ecf3", fontSize: 16,
      }}>
      <span className="absolute inset-y-0 left-0" style={{ width: `${c * 100}%`, background: "linear-gradient(135deg,#4ade80,#22d3ee)", transition: "none" }} />
      <span className="relative flex items-center justify-center gap-2" style={{ zIndex: 1 }}>
        <Eye size={18} /> {near ? "Almost…" : c > 0.02 ? "Keep holding…" : "Hold to reveal"}
      </span>
    </button>
  );
}

// Read-only mirror of HoldButton — locked guessers watch the Master charge the reveal
// (same fill / glow / shake) but cannot interact with it.
export function RevealMeter({ charge = 0 }) {
  const c = Math.max(0, Math.min(1, charge));
  const jx = c > 0.04 ? (Math.random() - 0.5) * c * 7 : 0;
  const jy = c > 0.04 ? (Math.random() - 0.5) * c * 7 : 0;
  const near = c > 0.8;
  return (
    <div className="relative w-full py-4 rounded-xl overflow-hidden select-none font-bold"
      style={{
        transform: `translate(${jx}px, ${jy}px) scale(${1 + c * 0.03})`,
        background: "rgba(255,255,255,0.05)",
        border: `1px solid rgba(74,222,128,${0.25 + c * 0.6})`,
        boxShadow: c > 0.02 ? `0 0 ${c * 34}px rgba(74,222,128,${c * 0.55})` : "none",
        color: c > 0.5 ? "#06140f" : "#e7ecf3", fontSize: 16,
      }}>
      <span className="absolute inset-y-0 left-0" style={{ width: `${c * 100}%`, background: "linear-gradient(135deg,#4ade80,#22d3ee)", transition: "none" }} />
      <span className="relative flex items-center justify-center gap-2" style={{ zIndex: 1 }}>
        <Eye size={18} /> {near ? "Almost…" : c > 0.02 ? "Revealing…" : "Master is about to reveal…"}
      </span>
    </div>
  );
}

// Drives the suspenseful reveal: stage 0 = bands hidden (only needles), 1 = bullseye(4),
// 2 = the 3-bands, 3 = the 2-bands, 4 = show the scoreboard. Resets when inactive.
export function useRevealStage(active) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (!active) { setStage(0); return; }
    setStage(0);
    const timers = [
      setTimeout(() => setStage(1), 400),
      setTimeout(() => setStage(2), 850),
      setTimeout(() => setStage(3), 1300),
      setTimeout(() => setStage(4), 1850),
    ];
    return () => timers.forEach(clearTimeout);
  }, [active]);
  return stage;
}

export function Confetti() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = canvas.width = window.innerWidth * dpr, H = canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + "px"; canvas.style.height = window.innerHeight + "px";
    const colors = ["#4ade80", "#22d3ee", "#facc15", "#fb923c", "#a78bfa", "#f472b6"];
    const parts = Array.from({ length: 150 }, () => ({
      x: W * (0.3 + Math.random() * 0.4), y: H * 0.32,
      vx: (Math.random() - 0.5) * 24 * dpr, vy: (Math.random() * -17 - 5) * dpr,
      g: (0.34 + Math.random() * 0.26) * dpr, s: (6 + Math.random() * 7) * dpr,
      rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.45,
      c: colors[Math.floor(Math.random() * colors.length)],
    }));
    let raf, t0 = performance.now();
    const draw = (now) => {
      const t = now - t0; ctx.clearRect(0, 0, W, H);
      parts.forEach((p) => {
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, 1 - t / 2900); ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.5); ctx.restore();
      });
      if (t < 3100) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 50 }} />;
}

export function PlayerEditor({ players, setPlayers, min = 2 }) {
  return (
    <div className="space-y-2">
      {players.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span style={{ width: 8, height: 28, borderRadius: 4, background: PLAYER_COLORS[i % PLAYER_COLORS.length] }} />
          <input value={p.name} maxLength={16}
            onChange={(e) => setPlayers((pl) => pl.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
            className="flex-1 px-3 py-2.5 rounded-xl outline-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#e7ecf3", fontSize: 15 }} />
          {players.length > min && (
            <button onClick={() => setPlayers((pl) => pl.filter((_, j) => j !== i))} className="p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.04)" }}><X size={16} color="#8a94a6" /></button>
          )}
        </div>
      ))}
      {players.length < 8 && (
        <button onClick={() => setPlayers((pl) => [...pl, { name: `Player ${pl.length + 1}`, score: 0 }])}
          className={`${btn} w-full py-2.5 flex items-center justify-center gap-2`} style={{ background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.14)", color: "#9aa4b4" }}>
          <Plus size={16} /> Add player
        </button>
      )}
    </div>
  );
}
