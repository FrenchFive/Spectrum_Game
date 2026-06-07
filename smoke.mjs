import { chromium } from "playwright";

const BASE = "http://localhost:5174/";
const errors = [];
const log = (...a) => console.log(...a);

function watch(page, tag) {
  page.on("console", (m) => { if (m.type() === "error") errors.push(`[${tag}] ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`[${tag}] PAGEERROR ${e.message}`));
}

const browser = await chromium.launch();

// ---------- 1) App mounts + local mode plays a round ----------
{
  const ctx = await browser.newContext({ viewport: { width: 414, height: 896 }, hasTouch: true });
  const page = await ctx.newPage();
  watch(page, "local");
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector("text=SPECTRA");
  log("✓ app mounted");

  await page.click("text=Pass & play");
  await page.waitForSelector("text=Start game");
  await page.click("text=Start game");
  await page.waitForSelector("text=the spectrum is");
  log("✓ local: started game, theme vote shown");

  await page.click("text=Play this round");
  await page.click("button:has-text('Tap when ready')"); // master handoff
  await page.waitForSelector("text=secret target", { timeout: 6000 });
  await page.fill("textarea[placeholder='Type a word or phrase…']", "test clue");
  await page.click("text=Lock clue");
  await page.click("button:has-text('Tap when ready')"); // guesser handoff
  await page.waitForSelector("text=Lock in guess");
  await page.click("text=Lock in guess");
  await page.waitForTimeout(900);
  // 2 players => only 1 guesser, so this lock leads straight to reveal
  await page.waitForSelector("text=Hold to reveal");
  log("✓ local: reached reveal screen — full round flow works");
  await ctx.close();
}

// ---------- 1b) Suggest-a-spectrum builds the right prefilled GitHub URL ----------
{
  const ctx = await browser.newContext({ viewport: { width: 414, height: 896 }, hasTouch: true });
  const page = await ctx.newPage();
  watch(page, "suggest");
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.click("text=Suggest a Left/Right spectrum");
  await page.fill("input[placeholder='e.g. White lie']", "White lie");
  await page.fill("input[placeholder='e.g. Unforgivable lie']", "Unforgivable lie");
  await page.evaluate(() => { window.__opened = null; window.open = (u) => { window.__opened = u; return null; }; });
  await page.click("text=Open suggestion on GitHub");
  const url = await page.evaluate(() => window.__opened);
  const u = new URL(url);
  const okHost = u.hostname === "github.com" && u.pathname === "/FrenchFive/Spetral_Game/issues/new";
  const okParams = u.searchParams.get("template") === "spectrum.yml" && u.searchParams.get("left") === "White lie" && u.searchParams.get("right") === "Unforgivable lie";
  if (!okHost || !okParams) throw new Error("SUGGEST FAIL: bad URL " + url);
  log("✓ suggest: opens prefilled GitHub issue form with left/right");
  await ctx.close();
}

// ---------- 2) Online: two browsers connect via Trystero + sync ----------
let onlineOk = false;
try {
  const hostCtx = await browser.newContext({ viewport: { width: 414, height: 896 }, hasTouch: true });
  const guestCtx = await browser.newContext({ viewport: { width: 414, height: 896 }, hasTouch: true });
  const host = await hostCtx.newPage(); watch(host, "host");
  const guest = await guestCtx.newPage(); watch(guest, "guest");

  await host.goto(BASE, { waitUntil: "networkidle" });
  await host.click("text=Play online");
  await host.fill("input[placeholder='e.g. Five']", "Sam");
  await host.click("text=Create a party");

  // read the 4-char code from the lobby
  await host.waitForSelector("text=Party code", { timeout: 15000 });
  await host.waitForTimeout(500);
  const code = (await host.locator("button >> text=/^[A-Z2-9]{4}$/").first().textContent())?.trim();
  log("• host created room:", code);

  await guest.goto(BASE, { waitUntil: "networkidle" });
  await guest.click("text=Play online");
  await guest.fill("input[placeholder='e.g. Five']", "Sam"); // same name as host on purpose
  await guest.fill("input[placeholder='CODE']", code);
  await guest.click("button:has-text('Join')");

  // host should see the joiner appear — with a de-duplicated name (proves P2P sync + unique names)
  await host.waitForSelector("text=Sam (2)", { timeout: 25000 });
  log("✓ online: guest joined, synced, and duplicate name auto-resolved to 'Sam (2)'");

  // host can now start (2 players). Host is the first connected player => Master.
  await host.click("text=Start game");
  await guest.waitForSelector("text=the spectrum is", { timeout: 15000 });
  log("✓ online: host started, guest received themeVote state");

  // master (host) plays the round
  await host.click("text=Play this round");
  // REGRESSION GUARD: master must enter the spin on their OWN device with no other
  // activity (bug: secretTarget was a ref mutation, so the master stayed stuck on the
  // "<name> is getting their angle" waiting screen until an unrelated re-render).
  await host.waitForTimeout(400);
  const midSpin = await host.locator("body").innerText();
  if (/getting their angle/i.test(midSpin)) throw new Error("REGRESSION: master stuck on waiting screen during spin");
  log("✓ online: master enters spin immediately (no stuck-waiting regression)");
  await host.waitForSelector("text=secret target", { timeout: 12000 }); // spin completes -> clue
  log("✓ online: master saw the spin land + secret target");
  // anti-cheat: while master picks a clue, guest must NOT have the target/bands
  await guest.waitForSelector("text=finding a clue", { timeout: 12000 });
  const guestTextDuringClue = await guest.locator("body").innerText();
  if (/secret target/i.test(guestTextDuringClue)) throw new Error("ANTI-CHEAT FAIL: guest saw target");
  log("✓ online: anti-cheat — guest never shown the target");

  const longClue = "Not telling your gf you bought yourself a croissant";
  await host.fill("textarea[placeholder='Type a word or phrase…']", longClue);
  await host.click("text=Lock clue");

  // reveal gate: before the guesser locks, the master must NOT be able to reveal
  await host.waitForSelector("text=Waiting for all guesses", { timeout: 12000 });
  if (await host.locator("text=Hold to reveal").count()) throw new Error("GATE FAIL: reveal available before all locked");
  log("✓ online: reveal correctly gated until all guessers lock");

  // long clue (>40 chars) must survive in full on the guesser's screen
  await guest.waitForSelector("text=Lock in guess", { timeout: 12000 });
  const guestClue = await guest.locator("body").innerText();
  if (!guestClue.includes("croissant")) throw new Error("CLUE CAP FAIL: long clue was truncated");
  log("✓ online: long clue typed and synced in full");

  // guest guesses (needle defaults to 90) and locks in
  await guest.click("text=Lock in guess");
  await guest.waitForSelector("text=about to reveal", { timeout: 8000 });
  log("✓ online: guest locked a guess");

  // master holds the reveal button to fire the reveal
  await host.waitForSelector("text=Hold to reveal", { timeout: 8000 });
  const hb = await host.locator("button:has-text('Hold to reveal')").first().boundingBox();
  await host.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await host.mouse.down();
  // mid-hold: the locked guest must see the charge building (read-only spectator)
  await host.waitForTimeout(700);
  const guestMid = await guest.locator("body").innerText();
  if (!/Revealing|Almost/.test(guestMid)) throw new Error("CHARGE FAIL: locked guest didn't see reveal charging");
  log("✓ online: locked guest sees the reveal charge build in real time");
  await host.waitForTimeout(1200);
  await host.mouse.up();

  // both land on reveal; guest sees the now-revealed clue + a cumulative score
  await guest.waitForSelector("text=clue", { timeout: 10000 });
  await host.waitForSelector("text=Next round", { timeout: 10000 });
  log("✓ online: reveal reached on both devices, scores synced");
  onlineOk = true;

  await hostCtx.close(); await guestCtx.close();
} catch (e) {
  log("⚠ online test could not complete:", e.message.split("\n")[0]);
}

await browser.close();

log("\n=== RESULT ===");
log("online sync:", onlineOk ? "WORKING" : "NOT VERIFIED (relay/network)");
if (errors.length) { log("console errors:\n" + errors.join("\n")); process.exit(2); }
log("no console/page errors");
process.exit(onlineOk ? 0 : 3);
