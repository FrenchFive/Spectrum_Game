# SPECTRUM — Left/Right spectrum guessing game

A *Wavelength*-style party game. One **Master** secretly sees a point on a spectrum and
gives a one-word clue; everyone else drags a needle on a half-circle dial to guess where
it landed. Closer to the bullseye = more points.

Two ways to play:

- **Pass & play** — one device, passed around the room. Fully offline.
- **Play online** — share a 4-letter code or link; everyone plays from their own phone,
  anywhere. **Peer-to-peer over WebRTC ([Trystero](https://github.com/dmotz/trystero)) —
  no backend, no accounts, no server to run or pay for.** Public Nostr relays are used
  only to introduce the phones; all gameplay flows directly device-to-device.

### Anti-cheat
The secret target is generated and held **only on the Master's device** and is never sent
to guessers until the reveal — so a guesser can't peek at the answer in dev tools.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
```

## Build & deploy

`npm run build` outputs to `dist/`. A workflow at `.github/workflows/deploy.yml` builds
and deploys to GitHub Pages on every push to `main`. One-time setup: **Settings → Pages →
Source → GitHub Actions**. The game then lives at:

```
https://<your-user>.github.io/Spectrum_Game/
```

The Vite `base` is `/Spectrum_Game/` for production (`vite.config.js`) — keep it in sync
with the repo name.

## Community suggestions

Players can suggest new Left/Right spectra from inside the game (Home → *Suggest a
Left/Right spectrum*). A GitHub Action turns each suggestion into a **pull request labelled
`new-spectrum`** (distinct from code PRs) that adds the pair to the deck — review and merge
to ship it.

- **Zero setup:** out of the box, the in-app button opens a prefilled GitHub issue.
- **Frictionless (recommended):** deploy the tiny Worker in [`worker/`](./worker/README.md)
  (~5 min, no CLI) so players submit silently without ever touching GitHub. Set the repo
  variable `SUGGEST_ENDPOINT` to the Worker URL and redeploy.

Also enable **Settings → Actions → General → "Allow GitHub Actions to create and approve
pull requests"** so the suggestion PRs can be opened automatically.

## End-to-end test

`smoke.mjs` drives a headless browser through a full local round, the suggestion flow, and
a real two-browser online round (P2P connect → lobby → spin → clue → live guessing →
spectator reveal charge → staged reveal → scores), asserting the guesser never receives the
target. To run it:

```bash
npm i -D playwright && npx playwright install chromium
npm run dev -- --port 5174 &
node smoke.mjs
```

## Tech

React + Vite + Tailwind · SVG dial · Canvas confetti · Web Vibration & Web Share APIs ·
Trystero (WebRTC) for online play · optional Cloudflare Worker for suggestions.
