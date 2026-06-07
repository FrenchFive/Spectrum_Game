import React, { useRef, useCallback, useEffect } from "react";
import { VBW, VBH, cx, cy, B4, B3, B2, clampA, pt, domePath, sectorPath } from "./constants";

// ---------- DIAL ----------
export function Dial({ value, onChange, target = null, markers = [], showNumbers = false, forceNeedle = false, pulseAt = null }) {
  const svgRef = useRef(null);
  const dragging = useRef(false);

  const setFromEvent = useCallback((clientX, clientY) => {
    const svg = svgRef.current; if (!svg) return;
    const r = svg.getBoundingClientRect();
    const vx = ((clientX - r.left) / r.width) * VBW;
    const vy = ((clientY - r.top) / r.height) * VBH;
    const dx = vx - cx, dy = cy - vy;
    let phi = (Math.atan2(dy, dx) * 180) / Math.PI;
    onChange && onChange(clampA(180 - phi));
  }, [onChange]);

  useEffect(() => {
    if (!onChange) return;
    const move = (e) => { if (!dragging.current) return; const t = e.touches ? e.touches[0] : e; setFromEvent(t.clientX, t.clientY); };
    const up = () => { dragging.current = false; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [onChange, setFromEvent]);

  const np = pt(value);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VBW} ${VBH}`}
      className="w-full select-none touch-none"
      style={{ cursor: onChange ? "grab" : "default", overflow: "visible" }}
      onPointerDown={(e) => { if (!onChange) return; dragging.current = true; setFromEvent(e.clientX, e.clientY); }}
    >
      <defs>
        <radialGradient id="domeGrad" cx="50%" cy="100%" r="100%">
          <stop offset="0%" stopColor="#2b3340" />
          <stop offset="100%" stopColor="#1a212c" />
        </radialGradient>
        <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <path d={domePath()} fill="url(#domeGrad)" stroke="rgba(255,255,255,0.10)" strokeWidth="1.5" />

      {target !== null && (
        <g opacity="0.96">
          <path d={sectorPath(target - B2, target - B3)} fill="#16463d" />
          <path d={sectorPath(target - B3, target - B4)} fill="#2f9c79" />
          <path d={sectorPath(target - B4, target + B4)} fill="#4ade80" />
          <path d={sectorPath(target + B4, target + B3)} fill="#2f9c79" />
          <path d={sectorPath(target + B3, target + B2)} fill="#16463d" />
          {showNumbers && [
            { a: target, n: 4 }, { a: target - 10, n: 3 }, { a: target + 10, n: 3 },
            { a: target - 20, n: 2 }, { a: target + 20, n: 2 },
          ].map((m, i) => {
            const p = pt(clampA(m.a)); const f = 0.74;
            return <text key={i} x={cx + (p.x - cx) * f} y={cy + (p.y - cy) * f} fontSize="12" fontWeight="700"
              fill="rgba(7,12,16,0.85)" textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: "'Space Mono', monospace" }}>{m.n}</text>;
          })}
        </g>
      )}

      {/* tick marks */}
      {Array.from({ length: 19 }).map((_, i) => {
        const a = i * 10; const o = pt(a); const inr = { x: cx + (o.x - cx) * 0.955, y: cy + (o.y - cy) * 0.955 };
        return <line key={i} x1={o.x} y1={o.y} x2={inr.x} y2={inr.y} stroke="rgba(255,255,255,0.18)" strokeWidth={i % 9 === 0 ? 0 : 1} />;
      })}

      {/* reveal markers */}
      {markers.map((m, i) => {
        const p = pt(m.angle);
        return (
          <g key={i}>
            <line x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={m.color} strokeWidth="2.5" strokeLinecap="round" opacity="0.92" />
            <circle cx={p.x} cy={p.y} r="5.5" fill={m.color} stroke="#0b0e13" strokeWidth="1.5" />
          </g>
        );
      })}

      {/* live needle */}
      {(onChange !== undefined || forceNeedle) && (
        <g filter="url(#glow)">
          <line x1={cx} y1={cy} x2={np.x} y2={np.y} stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          <circle cx={np.x} cy={np.y} r="6.5" fill="#fff" />
        </g>
      )}
      <circle cx={cx} cy={cy} r="9" fill="#e7ecf3" />
      <circle cx={cx} cy={cy} r="9" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="2" />

      {pulseAt != null && (
        <g>
          <circle cx={pt(pulseAt).x} cy={pt(pulseAt).y} r="6" fill="none" stroke="#fff" strokeWidth="3" className="lockpulse" />
          <circle cx={pt(pulseAt).x} cy={pt(pulseAt).y} r="6" fill="none" stroke="#4ade80" strokeWidth="2" className="lockpulse2" />
        </g>
      )}
    </svg>
  );
}

function PoleTag({ side, label }) {
  const sky = side === "left";
  return (
    <span className="absolute bottom-3 px-2.5 py-1 rounded-md font-bold text-[11px] uppercase tracking-[0.1em] max-w-[44%] truncate"
      style={{
        [sky ? "left" : "right"]: 10,
        color: sky ? "#7dd3fc" : "#fdba74",
        background: sky ? "rgba(56,189,248,0.12)" : "rgba(251,146,60,0.12)",
        border: `1px solid ${sky ? "rgba(56,189,248,0.3)" : "rgba(251,146,60,0.3)"}`,
        fontFamily: "'Space Mono', monospace",
      }}>{label}</span>
  );
}

export function DialBoard({ theme, ...dialProps }) {
  return (
    <div className="relative rounded-2xl p-2 pb-10" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <Dial {...dialProps} />
      <PoleTag side="left" label={theme[0]} />
      <PoleTag side="right" label={theme[1]} />
    </div>
  );
}
