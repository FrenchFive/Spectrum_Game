// ---------- THEME DECK (spectrum pairs) ----------
export const THEMES = [
  ["Politically Left", "Politically Right"],
  ["Beautiful", "Ugly"],
  ["Clean", "Dirty"],
  ["Overrated", "Underrated"],
  ["Normal", "Weird"],
  ["Wholesome", "Cursed"],
  ["Guilty pleasure", "Genuinely good"],
  ["Forgivable", "Unforgivable"],
  ["Cheap", "Expensive"],
  ["Safe", "Dangerous"],
  ["Cute", "Terrifying"],
  ["Boring", "Exciting"],
  ["Tacky", "Classy"],
  ["Childish", "Mature"],
  ["Low effort", "High effort"],
  ["Forgettable", "Iconic"],
  ["Mainstream", "Niche"],
  ["Common", "Rare"],
  ["Quiet", "Loud"],
  ["Cold", "Hot"],
  ["Round", "Pointy"],
  ["Healthy", "Unhealthy"],
  ["Modern", "Ancient"],
  ["Comfortable", "Painful"],
  ["Casual", "Formal"],
  ["Calm", "Unhinged"],
  ["Underhyped", "Overhyped"],
  ["A toy", "A weapon"],
  ["Could date", "Run away"],
  ["Snack", "Full meal"],
  ["Cringe", "Based"],
  ["Whispered", "Shouted"],
  ["Useless", "Essential"],
  ["A want", "A need"],
  ["Guilty", "Innocent"],
  ["Soft", "Hardcore"],
  ["Basic", "Elite"],
  ["Optional", "Mandatory"],
  ["A trend", "Timeless"],
  ["A fad", "A classic"],
  ["Minimalist", "Maximalist"],
  ["Plain", "Flashy"],
  ["Cozy", "Sterile"],
  ["Vintage", "Futuristic"],
  ["Subtle", "Over the top"],
  ["Harmless", "Evil"],
  ["Petty", "Serious"],
  ["A sin", "A virtue"],
  ["Polite", "Rude"],
  ["Selfless", "Selfish"],
  ["Honest", "Manipulative"],
  ["Cautious", "Reckless"],
  ["Trustworthy", "Sketchy"],
  ["Stable", "Chaotic"],
  ["A treat", "A punishment"],
  ["Refreshing", "Heavy"],
  ["Bland", "Spicy"],
  ["A drink", "A meal"],
  ["Overcooked", "Raw"],
  ["Comfort food", "Fancy food"],
  ["Sweet", "Savory"],
  ["Everyday", "Special occasion"],
  ["Smooth", "Rough"],
  ["Light", "Heavy"],
  ["Dim", "Blinding"],
  ["Slow", "Fast"],
  ["Weak", "Strong"],
  ["Empty", "Full"],
  ["Tiny", "Massive"],
  ["Fragile", "Indestructible"],
  ["Ick", "Hot"],
  ["Would ghost", "Would marry"],
  ["Red flag", "Green flag"],
  ["Friend material", "Soulmate"],
  ["Worst date ever", "Best date ever"],
  ["A turn-off", "A turn-on"],
  ["Awkward", "Smooth"],
  ["Introvert heaven", "Extrovert heaven"],
  ["Vibe killer", "Life of the party"],
  ["Beige flag", "Bold move"],
  ["Lazy", "Driven"],
  ["Shy", "Confident"],
  ["Humble", "Arrogant"],
  ["A follower", "A leader"],
  ["Predictable", "Unpredictable"],
  ["Logical", "Emotional"],
  ["Optimist", "Pessimist"],
  ["Half-baked", "Polished"],
  ["Amateur", "Professional"],
  ["A rough draft", "A masterpiece"],
  ["Analog", "Digital"],
  ["Low-tech", "High-tech"],
  ["A bug", "A feature"],
  ["Manual", "Automated"],
  ["A waste of time", "Productive"],
  ["A hobby", "A career"],
  ["Side quest", "Main quest"],
  ["Procrastination", "Deep focus"],
  ["A liquid", "A solid"],
  ["A circle", "A line"],
  ["A cold take", "A hot take"],
  ["A beginning", "An end"],
  ["Order", "Chaos"],
  ["Science", "Magic"],
  ["Reality", "Fantasy"],
  ["A question", "An answer"],
  ["A means", "An end"],
  ["Logic", "Vibes"],
  ["Nature", "Technology"],
  ["Free", "Priceless"],
  ["A choice", "Fate"],
  ["Old school", "New school"],
  ["The past", "The future"],
  ["Yesterday's news", "Breaking news"],
  ["Retro", "Cutting-edge"],
  ["Prey", "Predator"],
  ["Domesticated", "Wild"],
  ["A pet", "A pest"],
  ["House cat energy", "Tiger energy"],
  ["Broke", "Rich"],
  ["A scam", "A steal"],
  ["Worthless", "Priceless"],
  ["An expense", "An investment"],
  ["A saver", "A spender"],
  ["Mildly annoying", "Rage-inducing"],
  ["A minor inconvenience", "A disaster"],
  ["No big deal", "A full crisis"],
  ["Underdressed", "Overdressed"],
  ["Tame", "Feral"],
  ["PG", "R-rated"],
  ["Holy", "Sinful"],
  ["Angelic", "Demonic"],
  ["Sus", "Trustworthy"],
  ["A tourist trap", "A hidden gem"],
  ["A staycation", "An adventure"],
  ["City energy", "Nature energy"],
  ["A drizzle", "A hurricane"],
  ["Mild", "Extreme"],
  ["Easy", "Impossible"],
  ["A breeze", "A nightmare"],
  ["Beginner", "Expert"],
  ["A meme", "High art"],
  ["A casual fling", "A serious commitment"],
  ["Comedy", "Tragedy"],
  ["A snooze", "A thriller"],
  ["Vanilla", "Wild"],
  ["Background noise", "Main event"],
  ["A sketch", "A finished piece"],
  ["A nap", "An all-nighter"],
  ["Lowbrow", "Highbrow"],
  ["A flop", "A hit"],
  ["A white lie", "An unforgivable lie"],
  ["A hint of garlic", "Way too much garlic"],
  ["Slightly chilly", "Volcanic"],
  ["A gentle suggestion", "A direct order"],
  ["A dad joke", "Actually hilarious"],
  ["Lukewarm", "Scorching"],
  ["A side character", "The main character"],
  ["A flicker", "An inferno"],
  ["Quietly judging", "Openly hating"],
  ["Princess Treatment", "Bare Minimum Submitted from the game."],
];

export const PLAYER_COLORS = ["#38bdf8", "#fb923c", "#a78bfa", "#f472b6", "#facc15", "#4ade80", "#f87171", "#2dd4bf"];

// ---------- GEOMETRY ----------
export const VBW = 440, VBH = 244;
export const cx = 220, cy = 214, R = 188;
export const B4 = 5, B3 = 15, B2 = 25; // five equal 10° bands: 2-3-4-3-2

export const clampA = (a) => Math.max(0, Math.min(180, a));
const rad = (d) => (d * Math.PI) / 180;

export function pt(a) {
  const phi = rad(180 - a);
  return { x: cx + R * Math.cos(phi), y: cy - R * Math.sin(phi) };
}

export function scoreFor(guess, target) {
  const d = Math.abs(guess - target);
  if (d <= B4) return 4;
  if (d <= B3) return 3;
  if (d <= B2) return 2;
  return 0;
}

export function domePath() {
  let d = `M ${cx - R} ${cy}`;
  for (let a = 0; a <= 180; a += 2) { const p = pt(a); d += ` L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`; }
  return d + " Z";
}

export function sectorPath(a1, a2) {
  a1 = clampA(a1); a2 = clampA(a2);
  let d = `M ${cx} ${cy}`;
  for (let a = a1; a <= a2; a += 1) { const p = pt(a); d += ` L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`; }
  const pe = pt(a2); d += ` L ${pe.x.toFixed(2)} ${pe.y.toFixed(2)} Z`;
  return d;
}

// ---------- DECK + TARGET HELPERS ----------
export const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
export const newTarget = () => clampA(5 + Math.random() * 170);

export const btn = "rounded-xl font-semibold transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed";

// ---------- COMMUNITY SUGGESTIONS ----------
// Suggesting a spectrum opens a prefilled GitHub issue form; a workflow turns it into a
// labelled PR automatically. No tokens in the client — the user authenticates on GitHub.
export const REPO = "FrenchFive/Spectrum_Game";
export const suggestUrl = (left, right) => {
  const params = new URLSearchParams({
    template: "spectrum.yml",
    title: `[Spectrum] ${left} ↔ ${right}`.slice(0, 90),
    left,
    right,
  });
  return `https://github.com/${REPO}/issues/new?${params.toString()}`;
};
