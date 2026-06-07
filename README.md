# SPECTRA — Left/Right spectrum guessing game

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
to guessers until the reveal — so a guesser can't peek at the answer in dev tools. Scores
are computed by the Master at reveal and broadcast by the host.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
```

## Build

```bash
npm run build      # outputs to dist/
npm run preview    # preview the production build
```

## Deploy (GitHub Pages)

A workflow at `.github/workflows/deploy.yml` builds and deploys on every push to `main`.
One-time setup: in the repo, go to **Settings → Pages → Build and deployment → Source**
and select **GitHub Actions**. After the next push the game is live at:

```
https://<your-user>.github.io/Spetral_Game/
```

Share that link (or `…/?room=CODE`) with friends to play online. The Vite `base` is set to
`/Spetral_Game/` for production in `vite.config.js` — change it if you rename the repo.

## End-to-end test

`smoke.mjs` drives a headless browser through a full local round **and** a real two-browser
online round (P2P connect → lobby sync → spin → clue → guess → reveal → score), and asserts
the guesser never receives the target. To run it:

```bash
npm i -D playwright && npx playwright install chromium
npm run dev -- --port 5174 &     # in one shell
node smoke.mjs                   # in another
```

## Tech

React + Vite + Tailwind · SVG dial · Canvas confetti · Web Vibration & Web Share APIs ·
Trystero (WebRTC) for online play.
