import React, { useState, useEffect } from "react";
import { Target, Users, Wifi, ArrowRight, ArrowLeft, Lightbulb, Github, Send, List, Search, Eye, MoveHorizontal } from "lucide-react";
import { btn, suggestUrl, THEMES, clampA } from "./constants";
import { DialBoard } from "./Dial";

// Optional: a serverless Worker URL that creates the GitHub issue for the player.
// Set via the VITE_SUGGEST_ENDPOINT build var. If absent, we fall back to opening
// the GitHub issue form so the feature still works with zero setup.
// Normalize: a value without a scheme (e.g. "foo.workers.dev") would otherwise be
// treated as a relative URL and POST to GitHub Pages (405), not the Worker.
const rawSuggest = import.meta.env.VITE_SUGGEST_ENDPOINT;
const SUGGEST_ENDPOINT = rawSuggest
  ? (/^https?:\/\//i.test(rawSuggest) ? rawSuggest : `https://${rawSuggest}`)
  : rawSuggest;
import { ThemeBar } from "./ui";
import { useParty } from "./useParty";
import LocalGame from "./LocalGame";
import OnlineGame from "./OnlineGame";

// The brand mark — the gauge/needle motif from the favicon, drawn inline so the in-app
// logo and the favicon are identical. `dome` adds a soft glow for hero use.
function Logo({ size = 32, glow = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={glow ? { filter: "drop-shadow(0 4px 16px rgba(34,211,238,0.35))" } : undefined}>
      <defs>
        <linearGradient id="logoArc" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4ade80" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="7" fill="#0b0e13" />
      <path d="M4 22 A12 12 0 0 1 28 22" fill="none" stroke="url(#logoArc)" strokeWidth="3" strokeLinecap="round" />
      <line x1="16" y1="22" x2="23" y2="13" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="16" cy="22" r="2.6" fill="#e7ecf3" />
    </svg>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-2.5 mb-5">
      <Logo size={32} />
      <div>
        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 19, letterSpacing: "-0.02em", lineHeight: 1 }}>SPECTRUM</div>
        <div className="text-[10px] tracking-[0.22em] uppercase" style={{ color: "#6b7686" }}>read the master's mind</div>
      </div>
    </div>
  );
}

// Live, self-playing dial on the landing page: the needle sweeps and the spectrum pair
// cycles so visitors instantly see what they'll actually be playing.
const HERO_THEMES = [
  ["Underrated", "Overrated"],
  ["A white lie", "Unforgivable"],
  ["Cute", "Terrifying"],
  ["Casual", "Formal"],
  ["A toy", "A weapon"],
  ["Lukewarm", "Scorching"],
];

function HeroDial() {
  const [value, setValue] = useState(96);
  const [idx, setIdx] = useState(0);
  // a pleasant, deterministic bullseye position per theme
  const target = clampA(58 + ((idx * 41) % 74));

  useEffect(() => {
    const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setValue(target); return; }
    let raf, start;
    const loop = (t) => {
      if (start == null) start = t;
      const e = (t - start) / 1000;
      setValue(clampA(92 + 56 * Math.sin(e * (2 * Math.PI) / 6.5)));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % HERO_THEMES.length), 3800);
    return () => clearInterval(id);
  }, []);

  return <DialBoard theme={HERO_THEMES[idx]} value={value} target={target} forceNeedle revealStage={3} />;
}

const STEPS = [
  { Icon: Eye, color: "#facc15", title: "The Master gives one word", text: "They see a hidden spot on the spectrum and drop a single clue." },
  { Icon: MoveHorizontal, color: "#7dd3fc", title: "Everyone guesses", text: "Drag your needle to where you think that word lands." },
  { Icon: Target, color: "#4ade80", title: "Closer is more points", text: "Nail the bullseye to clean up. Read the room, win the round." },
];

function HowItWorks() {
  return (
    <div className="space-y-2.5">
      {STEPS.map(({ Icon, color, title, text }, i) => (
        <div key={i} className="flex items-start gap-3 rounded-xl px-3.5 py-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="grid place-items-center rounded-lg shrink-0 mt-0.5" style={{ width: 30, height: 30, background: `${color}1f` }}>
            <Icon size={16} color={color} />
          </div>
          <div>
            <div className="text-[14px] font-semibold" style={{ color: "#e7ecf3" }}>{title}</div>
            <div className="text-[13px]" style={{ color: "#8a94a6", lineHeight: 1.45 }}>{text}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState("home"); // home | local | onlineEntry | online
  const party = useParty();

  // prefill join code from a shared link (?room=ABCD)
  const [myName, setMyName] = useState(party.savedName());
  const [joinCode, setJoinCode] = useState("");
  useEffect(() => {
    const code = new URLSearchParams(location.search).get("room");
    if (code) { setJoinCode(code.toUpperCase().slice(0, 4)); setMode("onlineEntry"); }
  }, []);

  // once connected, show the online game
  useEffect(() => {
    if (party.status === "connected" && mode === "onlineEntry") setMode("online");
    if (party.status === "idle" && mode === "online") setMode("home");
  }, [party.status, mode]);

  const leaveOnline = () => { party.leave(); setMode("home"); };

  return (
    <div className="min-h-screen w-full flex items-start justify-center" style={{ background: "radial-gradient(120% 80% at 50% 0%, #141a23 0%, #0b0e13 70%)", padding: "20px 14px 48px" }}>
      <div className="w-full" style={{ maxWidth: 480, fontFamily: "'DM Sans', sans-serif", color: "#e7ecf3" }}>
        <Header />

        {/* HOME */}
        {mode === "home" && (
          <div className="space-y-6">
            {/* HERO */}
            <div className="space-y-3">
              <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 30, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
                One word. <span style={{ background: "linear-gradient(135deg,#4ade80,#22d3ee)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>Where does it land?</span>
              </h1>
              <p style={{ color: "#9aa4b4", fontSize: 15, lineHeight: 1.55 }}>
                The wildly fun party game of reading minds. One clue, a hidden target, and everyone racing to guess the same wavelength.
              </p>
              <HeroDial />
              <div className="flex items-center justify-center gap-2 text-[12px]" style={{ color: "#6b7686" }}>
                <span>Free</span><span>·</span><span>No sign-up</span><span>·</span><span>2–8 players</span>
              </div>
            </div>

            {/* PRIMARY CTAs */}
            <div className="space-y-3">
              <button onClick={() => setMode("local")} className="w-full rounded-2xl p-5 flex items-center gap-4 active:scale-[0.99] transition-transform text-left" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="grid place-items-center rounded-xl shrink-0" style={{ width: 46, height: 46, background: "rgba(74,222,128,0.14)" }}><Users size={22} color="#86efac" /></div>
                <div className="flex-1">
                  <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 18 }}>Pass &amp; play</div>
                  <div className="text-sm" style={{ color: "#8a94a6" }}>One device, passed around the room</div>
                </div>
                <ArrowRight size={18} color="#6b7686" />
              </button>
              <button onClick={() => setMode("onlineEntry")} className="w-full rounded-2xl p-5 flex items-center gap-4 active:scale-[0.99] transition-transform text-left" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="grid place-items-center rounded-xl shrink-0" style={{ width: 46, height: 46, background: "rgba(34,211,238,0.14)" }}><Wifi size={22} color="#67e8f9" /></div>
                <div className="flex-1">
                  <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 18 }}>Play online</div>
                  <div className="text-sm" style={{ color: "#8a94a6" }}>Share a code, each on their own phone</div>
                </div>
                <ArrowRight size={18} color="#6b7686" />
              </button>
            </div>

            {/* HOW IT WORKS */}
            <div className="space-y-3">
              <div className="text-[11px] tracking-[0.22em] uppercase" style={{ color: "#6b7686" }}>How it works</div>
              <HowItWorks />
            </div>

            {/* COMMUNITY */}
            <div className="pt-1 space-y-1">
              <button onClick={() => setMode("browse")} className="w-full flex items-center justify-center gap-2 py-2 text-sm" style={{ color: "#8a94a6" }}>
                <List size={15} color="#7dd3fc" /> Browse the spectrum deck ({THEMES.length})
              </button>
              <button onClick={() => setMode("suggest")} className="w-full flex items-center justify-center gap-2 pb-1 text-sm" style={{ color: "#8a94a6" }}>
                <Lightbulb size={15} color="#facc15" /> Suggest a Left/Right spectrum
              </button>
            </div>
          </div>
        )}

        {/* SUGGEST A SPECTRUM */}
        {mode === "suggest" && <SuggestSpectrum onBack={() => setMode("home")} onBrowse={() => setMode("browse")} />}

        {/* BROWSE THE DECK */}
        {mode === "browse" && <BrowseDeck onBack={() => setMode("home")} onSuggest={() => setMode("suggest")} />}

        {/* LOCAL */}
        {mode === "local" && <LocalGame onExit={() => setMode("home")} />}

        {/* ONLINE ENTRY */}
        {mode === "onlineEntry" && (
          <div className="space-y-5">
            <button onClick={() => { setMode("home"); }} className="flex items-center gap-1.5 text-sm" style={{ color: "#8a94a6" }}><ArrowLeft size={15} /> Back</button>
            <div>
              <label className="text-[11px] tracking-[0.18em] uppercase" style={{ color: "#6b7686" }}>Your name</label>
              <input value={myName} maxLength={16} onChange={(e) => setMyName(e.target.value)} placeholder="e.g. Five"
                className="mt-2 w-full px-4 py-3 rounded-xl outline-none" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#e7ecf3", fontSize: 15 }} />
            </div>
            <button onClick={() => party.create(myName)} disabled={party.status === "connecting" || !myName.trim()}
              className={`${btn} w-full py-4 flex items-center justify-center gap-2`} style={{ background: "linear-gradient(135deg,#4ade80,#22d3ee)", color: "#06140f", fontWeight: 700, fontSize: 16 }}>
              <Users size={18} /> {party.status === "connecting" ? "Connecting…" : "Create a party"}
            </button>
            <div className="flex items-center gap-3"><div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} /><span className="text-[11px] uppercase tracking-[0.2em]" style={{ color: "#5b6675" }}>or join</span><div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} /></div>
            <div className="flex gap-2">
              <input value={joinCode} maxLength={4} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="CODE"
                className="flex-1 px-4 py-3 rounded-xl outline-none text-center" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#e7ecf3", fontSize: 20, letterSpacing: "0.3em", fontFamily: "'Space Mono', monospace" }} />
              <button onClick={() => party.join(joinCode, myName)} disabled={joinCode.trim().length < 4 || party.status === "connecting" || !myName.trim()}
                className={`${btn} px-6 flex items-center justify-center gap-2`} style={{ background: "rgba(255,255,255,0.07)", color: "#e7ecf3", fontWeight: 700 }}>Join</button>
            </div>
            {!myName.trim() && <p className="text-center text-[12px]" style={{ color: "#8a94a6" }}>Enter your name to create or join.</p>}
            {party.error && <p className="text-center text-[13px]" style={{ color: "#fca5a5" }}>{party.error}</p>}
            <p className="text-center text-[12px]" style={{ color: "#5b6675" }}>Peer-to-peer · no account · share the code or link and play from anywhere.</p>
          </div>
        )}

        {/* ONLINE GAME */}
        {mode === "online" && <OnlineGame party={party} onExit={leaveOnline} />}
      </div>
    </div>
  );
}

function BrowseDeck({ onBack, onSuggest }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const list = query
    ? THEMES.filter(([l, r]) => l.toLowerCase().includes(query) || r.toLowerCase().includes(query))
    : THEMES;
  const field = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#e7ecf3", fontSize: 15 };
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm" style={{ color: "#8a94a6" }}><ArrowLeft size={15} /> Back</button>
      <div>
        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 22 }}>The spectrum deck</div>
        <p className="text-sm mt-1" style={{ color: "#9aa4b4", lineHeight: 1.5 }}>
          Every pair of opposites you might play — {THEMES.length} and growing as people suggest more.
        </p>
      </div>
      <div className="relative">
        <Search size={15} color="#6b7686" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the deck…"
          className="w-full pl-9 pr-4 py-3 rounded-xl outline-none" style={field} />
      </div>
      <div className="text-[11px] tracking-[0.16em] uppercase" style={{ color: "#6b7686" }}>
        {list.length} {list.length === 1 ? "spectrum" : "spectrums"}{query && ` matching “${q.trim()}”`}
      </div>
      <div className="space-y-2">
        {list.map(([l, r], i) => (
          <div key={i} className="rounded-xl px-3 py-2.5 flex items-center justify-between gap-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <span className="flex-1 text-right text-[13px] font-semibold leading-tight" style={{ color: "#7dd3fc" }}>{l}</span>
            <span className="shrink-0 text-xs" style={{ color: "#5b6675" }}>↔</span>
            <span className="flex-1 text-left text-[13px] font-semibold leading-tight" style={{ color: "#fdba74" }}>{r}</span>
          </div>
        ))}
        {list.length === 0 && (
          <p className="text-center text-sm py-4" style={{ color: "#8a94a6" }}>No match — want to be the one to add it?</p>
        )}
      </div>
      <button onClick={onSuggest} className={`${btn} w-full py-3.5 flex items-center justify-center gap-2`} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#e7ecf3", fontWeight: 700 }}>
        <Lightbulb size={16} color="#facc15" /> Suggest a new spectrum
      </button>
    </div>
  );
}

function SuggestSpectrum({ onBack, onBrowse }) {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const ready = left.trim() && right.trim();
  const edit = (set) => (e) => { set(e.target.value); setState("idle"); };

  const submit = async () => {
    if (!ready || state === "sending") return;
    if (SUGGEST_ENDPOINT) {
      setState("sending");
      try {
        const res = await fetch(SUGGEST_ENDPOINT, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ left: left.trim(), right: right.trim() }),
        });
        if (!res.ok) throw new Error();
        setState("sent"); setLeft(""); setRight("");
      } catch { setState("error"); }
    } else {
      // no worker configured → fall back to the GitHub issue form (still works)
      window.open(suggestUrl(left.trim(), right.trim()), "_blank", "noopener");
      setState("sent");
    }
  };

  const field = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#e7ecf3", fontSize: 15 };
  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm" style={{ color: "#8a94a6" }}><ArrowLeft size={15} /> Back</button>
      <div>
        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 22 }}>Suggest a spectrum</div>
        <p className="text-sm mt-1" style={{ color: "#9aa4b4", lineHeight: 1.5 }}>
          Two opposing poles for a new round. Good ones get added to the deck for everyone.
        </p>
        {onBrowse && (
          <button onClick={onBrowse} className="mt-2 flex items-center gap-1.5 text-sm" style={{ color: "#7dd3fc" }}>
            <List size={14} /> Browse the {THEMES.length} already in the deck
          </button>
        )}
      </div>
      <div className="space-y-2">
        <label className="text-[11px] tracking-[0.18em] uppercase" style={{ color: "#7dd3fc" }}>Left pole</label>
        <input value={left} maxLength={40} onChange={edit(setLeft)} placeholder="e.g. White lie"
          className="w-full px-4 py-3 rounded-xl outline-none" style={field} />
        <label className="text-[11px] tracking-[0.18em] uppercase block pt-1" style={{ color: "#fdba74" }}>Right pole</label>
        <input value={right} maxLength={40} onChange={edit(setRight)} placeholder="e.g. Unforgivable lie"
          className="w-full px-4 py-3 rounded-xl outline-none" style={field} />
      </div>
      {ready && <ThemeBar theme={[left.trim(), right.trim()]} />}
      <button onClick={submit} disabled={!ready || state === "sending"}
        className={`${btn} w-full py-4 flex items-center justify-center gap-2`} style={{ background: "linear-gradient(135deg,#4ade80,#22d3ee)", color: "#06140f", fontWeight: 700, fontSize: 16 }}>
        {SUGGEST_ENDPOINT ? <Send size={18} /> : <Github size={18} />}
        {state === "sending" ? "Sending…" : SUGGEST_ENDPOINT ? "Send suggestion" : "Suggest on GitHub"}
      </button>
      {state === "sent" && (
        <p className="text-center text-[13px]" style={{ color: "#86efac" }}>
          {SUGGEST_ENDPOINT ? "Sent! Your spectrum is queued for the deck — thanks! 🎯" : "A GitHub tab opened — submit it there to finish."}
        </p>
      )}
      {state === "error" && <p className="text-center text-[13px]" style={{ color: "#fca5a5" }}>Couldn't send just now — please try again.</p>}
      <p className="text-center text-[12px]" style={{ color: "#5b6675" }}>
        {SUGGEST_ENDPOINT ? "No account needed — sent straight from the app." : "Opens GitHub in a new tab · no account data leaves this app."}
      </p>
    </div>
  );
}
