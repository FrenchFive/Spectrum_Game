import React, { useState, useEffect } from "react";
import { Target, Users, Wifi, ArrowRight, ArrowLeft, Lightbulb, Github } from "lucide-react";
import { btn, suggestUrl } from "./constants";
import { ThemeBar } from "./ui";
import { useParty } from "./useParty";
import LocalGame from "./LocalGame";
import OnlineGame from "./OnlineGame";

function Header() {
  return (
    <div className="flex items-center gap-2 mb-5">
      <div className="grid place-items-center rounded-lg" style={{ width: 30, height: 30, background: "linear-gradient(135deg,#4ade80,#22d3ee)" }}>
        <Target size={17} color="#0b0e13" strokeWidth={2.6} />
      </div>
      <div>
        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 19, letterSpacing: "-0.02em", lineHeight: 1 }}>SPECTRA</div>
        <div className="text-[10px] tracking-[0.22em] uppercase" style={{ color: "#6b7686" }}>read the master's mind</div>
      </div>
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
          <div className="space-y-4">
            <p style={{ color: "#9aa4b4", fontSize: 14, lineHeight: 1.55 }}>
              One <b style={{ color: "#e7ecf3" }}>Master</b> sees a hidden angle on the spectrum and gives a one-word clue. Everyone else drags the needle to guess where it landed. Closer to the bullseye = more points.
            </p>
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
            <button onClick={() => setMode("suggest")} className="w-full flex items-center justify-center gap-2 py-2 text-sm" style={{ color: "#8a94a6" }}>
              <Lightbulb size={15} color="#facc15" /> Suggest a Left/Right spectrum
            </button>
          </div>
        )}

        {/* SUGGEST A SPECTRUM */}
        {mode === "suggest" && <SuggestSpectrum onBack={() => setMode("home")} />}

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

function SuggestSpectrum({ onBack }) {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [sent, setSent] = useState(false);
  const ready = left.trim() && right.trim();
  const submit = () => {
    if (!ready) return;
    window.open(suggestUrl(left.trim(), right.trim()), "_blank", "noopener");
    setSent(true);
  };
  const field = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#e7ecf3", fontSize: 15 };
  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm" style={{ color: "#8a94a6" }}><ArrowLeft size={15} /> Back</button>
      <div>
        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 22 }}>Suggest a spectrum</div>
        <p className="text-sm mt-1" style={{ color: "#9aa4b4", lineHeight: 1.5 }}>
          Two opposing poles for a new round. Submitting opens a pull request on GitHub automatically — a maintainer just reviews and merges it into the deck.
        </p>
      </div>
      <div className="space-y-2">
        <label className="text-[11px] tracking-[0.18em] uppercase" style={{ color: "#7dd3fc" }}>Left pole</label>
        <input value={left} maxLength={40} onChange={(e) => setLeft(e.target.value)} placeholder="e.g. White lie"
          className="w-full px-4 py-3 rounded-xl outline-none" style={field} />
        <label className="text-[11px] tracking-[0.18em] uppercase block pt-1" style={{ color: "#fdba74" }}>Right pole</label>
        <input value={right} maxLength={40} onChange={(e) => setRight(e.target.value)} placeholder="e.g. Unforgivable lie"
          className="w-full px-4 py-3 rounded-xl outline-none" style={field} />
      </div>
      {ready && <ThemeBar theme={[left.trim(), right.trim()]} />}
      <button onClick={submit} disabled={!ready}
        className={`${btn} w-full py-4 flex items-center justify-center gap-2`} style={{ background: "linear-gradient(135deg,#4ade80,#22d3ee)", color: "#06140f", fontWeight: 700, fontSize: 16 }}>
        <Github size={18} /> Open suggestion on GitHub
      </button>
      {sent && (
        <p className="text-center text-[13px]" style={{ color: "#86efac" }}>
          A GitHub tab opened — submit the issue there and a pull request is created automatically. Thanks for contributing!
        </p>
      )}
      <p className="text-center text-[12px]" style={{ color: "#5b6675" }}>Opens GitHub in a new tab · no account data leaves this app.</p>
    </div>
  );
}
