<div align="center">

<img src="public/spectrum.svg" width="92" height="92" alt="Spectrum logo" />

# SPECTRUM

**The free party game of reading minds.**
One word, a hidden target, and everyone racing to guess the same wavelength.

<br />

[![▶ Play Now](https://img.shields.io/badge/▶_Play_Now-22d3ee?style=for-the-badge&labelColor=0b0e13)](https://frenchfive.github.io/Spectrum_Game/)
&nbsp;
[![📖 How to Play](https://img.shields.io/badge/📖_How_to_Play-4ade80?style=for-the-badge&labelColor=0b0e13)](#-how-to-play)
&nbsp;
[![💡 Suggest a Spectrum](https://img.shields.io/badge/💡_Suggest_a_Spectrum-facc15?style=for-the-badge&labelColor=0b0e13)](https://frenchfive.github.io/Spectrum_Game/)

<br />

[![Deploy](https://github.com/FrenchFive/Spectrum_Game/actions/workflows/deploy.yml/badge.svg)](https://github.com/FrenchFive/Spectrum_Game/actions/workflows/deploy.yml)
![React](https://img.shields.io/badge/React-149eca?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646cff?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-38bdf8?logo=tailwindcss&logoColor=white)
![No backend](https://img.shields.io/badge/backend-none-success)

</div>

---

## ✨ What is it?

A *Wavelength*-style party game. One **Master** secretly sees a point on a spectrum (say,
somewhere between **Underrated ↔ Overrated**) and gives a single one-word clue. Everyone
else drags a needle on a half-circle dial to guess where it landed. Closer to the bullseye
= more points.

- 🆓 **Free, no account, no install** — runs in any browser.
- 📱 **2–8 players** — on one phone or each on their own.
- 🌐 **No server to run or pay for** — online play is peer-to-peer.
- 🃏 **Community deck** — players suggest new spectra that become one-click pull requests.

## 🎮 How to play

1. **The Master gets one word.** They see a hidden spot on the spectrum and give a single clue.
2. **Everyone guesses.** Players drag their needle to where they think that word lands.
3. **Closer is more points.** Nail the bullseye to clean up — read the room, win the round.

The secret target is generated and held **only on the Master's device** and is never sent
to guessers until the reveal, so a guesser can't peek at the answer in dev tools.

## 🕹️ Play modes

| Mode | How | Connectivity |
| --- | --- | --- |
| **Pass & play** | One device, passed around the room | Fully offline |
| **Play online** | Share a 4-letter code or link; each player on their own phone | Peer-to-peer over WebRTC |

Online play uses **[Trystero](https://github.com/dmotz/trystero)** — public Nostr relays
only introduce the phones, then all gameplay flows directly device-to-device. No backend,
no accounts, nothing to host.

## 🛠️ Develop

```bash
npm install
npm run dev        # http://localhost:5173
```

## 🚀 Build & deploy

`npm run build` outputs to `dist/`. The [`deploy.yml`](.github/workflows/deploy.yml) workflow
builds and deploys to GitHub Pages on every push to `main`.

- **One-time setup:** Settings → Pages → Source → **GitHub Actions**.
- The Vite `base` is `/Spectrum_Game/` for production ([`vite.config.js`](vite.config.js)) —
  keep it in sync with the repo name.

Live at **<https://frenchfive.github.io/Spectrum_Game/>**.

## 💡 Community suggestions

Players can suggest new Left/Right spectra from inside the game (**Home → Suggest a
Left/Right spectrum**). Each suggestion becomes a **pull request labelled `new-spectrum`**
that appends the pair to the deck — you just review and merge it to ship.

| Setup | What players experience | Mechanism |
| --- | --- | --- |
| **Zero setup** | Button opens a prefilled GitHub issue | A [GitHub Action](.github/workflows/spectrum-suggestion.yml) turns the issue into the PR |
| **Frictionless** *(recommended)* | Button submits silently, no GitHub | A tiny [Cloudflare Worker](worker/README.md) opens the PR directly (~5 min, no CLI) |

For the frictionless path, set the repo variable `SUGGEST_ENDPOINT` to the Worker URL
(**full URL, including `https://`**) and redeploy. Also enable **Settings → Actions →
General → "Allow GitHub Actions to create and approve pull requests"** so suggestion PRs
can open automatically.

## 🧪 End-to-end test

[`smoke.mjs`](smoke.mjs) drives a headless browser through a full local round, the
suggestion flow, and a real two-browser online round (P2P connect → lobby → spin → clue →
live guessing → spectator reveal charge → staged reveal → scores), asserting the guesser
never receives the target.

```bash
npm i -D playwright && npx playwright install chromium
npm run dev -- --port 5174 &
node smoke.mjs
```

## 🧰 Tech

React + Vite + Tailwind · SVG dial · Canvas confetti · Web Vibration & Web Share APIs ·
Trystero (WebRTC) for online play · optional Cloudflare Worker for suggestions.
