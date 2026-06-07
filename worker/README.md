# Suggestion Worker — easiest setup (~5 min, no CLI)

This optional Worker lets players submit spectrum suggestions **without ever touching
GitHub**. Until you set it up, the in-app button gracefully falls back to opening a
GitHub issue, so the game works fine with zero setup.

The Worker holds a GitHub token and creates the suggestion issue for the player. The
repo's Action then opens a labelled pull request automatically.

## 1. Create a token (1 min)
GitHub → **Settings → Developer settings → Fine-grained tokens → Generate new token**
- Repository access: **Only select repositories → `FrenchFive/Spectrum_Game`**
- Permissions: **Issues → Read and write**
- Generate, copy the token (`github_pat_…`).

## 2. Create the Worker (2 min, all in the browser)
Cloudflare dashboard → **Workers & Pages → Create**.
- On **"Select a method", choose "Start with Hello World!"** (the code-editor option).
  ⚠️ Do **NOT** pick *Upload assets* / *Import a repository* — those are for static sites
  and will reject the `.js` file ("does not support projects that require a build process").
- Name it (e.g. `spectrum-suggest`) → **Deploy**, then **Edit code**.
- Select-all and delete the starter code, paste the contents of
  [`spectrum-suggest.js`](./spectrum-suggest.js), then **Deploy**.
- **Settings → Variables and Secrets → Add**:
  - `GITHUB_TOKEN` = the token from step 1 — **mark it as a Secret (Encrypt)**.
  - *(optional)* `ALLOW_ORIGIN` = your game origin, e.g. `https://chanchanou.github.io` (defaults to `*`).
- Copy the Worker URL (e.g. `https://spectrum-suggest.chanchanou.workers.dev`).

## 3. Point the game at it (1 min, no code edit)
GitHub repo → **Settings → Secrets and variables → Actions → Variables → New variable**:
- `SUGGEST_ENDPOINT` = your Worker URL.

Re-run the Pages deploy (push any commit or trigger the workflow). Done — the in-app
"Suggest a spectrum" button now submits silently and a PR appears for you to merge.

## Prefer the CLI?
`wrangler.toml` is included. Run `npx wrangler deploy` then
`npx wrangler secret put GITHUB_TOKEN`.
