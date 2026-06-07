// Spectrum — suggestion Worker
// Receives { left, right } from the game and opens a GitHub issue, which the repo's
// "Spectrum suggestion → PR" Action turns into a labelled pull request. Players never
// touch GitHub. Paste this into a Cloudflare Worker (dashboard → Quick Edit), then add
// one secret: GITHUB_TOKEN (a fine-grained PAT with Issues: Read & Write on the repo).
//
// Optional var: ALLOW_ORIGIN (your game's origin, e.g. https://frenchfive.github.io).
// Defaults to "*".

const REPO = "FrenchFive/Spectrum_Game";

const clean = (s) =>
  String(s || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/[^\p{L}\p{N} '’\-&!?.,()/:]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOW_ORIGIN || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...cors } });

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return json({ error: "POST only" }, 405);
    if (!env.GITHUB_TOKEN) return json({ error: "server not configured" }, 500);

    let data;
    try { data = await request.json(); } catch { return json({ error: "bad json" }, 400); }
    const left = clean(data.left), right = clean(data.right);
    if (!left || !right || !/\p{L}/u.test(left) || !/\p{L}/u.test(right)) return json({ error: "invalid" }, 422);

    const issue = {
      title: `[Spectrum] ${left} ↔ ${right}`.slice(0, 90),
      body: `### Left pole\n\n${left}\n\n### Right pole\n\n${right}\n\n_Submitted from the game._`,
    };
    const r = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "spectrum-suggest-worker",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(issue),
    });
    if (!r.ok) return json({ error: "github", status: r.status }, 502);
    const created = await r.json();
    return json({ ok: true, issueUrl: created.html_url });
  },
};
