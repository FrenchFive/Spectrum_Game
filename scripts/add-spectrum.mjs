// Parses a "Suggest a spectrum" issue body, sanitizes the Left/Right poles, and
// inserts the pair into the THEMES deck in src/constants.js.
// Communicates the result back to the workflow via $GITHUB_OUTPUT:
//   status = ok | duplicate | invalid, plus left / right (sanitized).
// Always exits 0 so the workflow can comment appropriately.
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";

const TARGET = process.env.TARGET || "src/constants.js";
const body = process.env.ISSUE_BODY || "";

// ---- parse the issue-form body into { heading: value } ----
const sections = {};
for (const part of body.split(/^###\s+/m).slice(1)) {
  const nl = part.indexOf("\n");
  if (nl < 0) continue;
  const head = part.slice(0, nl).trim().toLowerCase();
  let val = part.slice(nl + 1).trim();
  if (/^_no response_$/i.test(val)) val = "";
  sections[head] = val;
}
let left = sections["left pole"] ?? sections["left"] ?? null;
let right = sections["right pole"] ?? sections["right"] ?? null;
if (left == null || right == null) {
  const vals = Object.values(sections);
  left = left ?? vals[0] ?? "";
  right = right ?? vals[1] ?? "";
}

// ---- sanitize: keep a safe charset, strip anything that could break the JS string ----
const clean = (s) =>
  String(s || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/[^\p{L}\p{N} '’\-&!?.,()/:]/gu, "") // letters/digits/space + light punctuation
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);

left = clean(left);
right = clean(right);

const out = process.env.GITHUB_OUTPUT;
const setOut = (k, v) => { if (out) appendFileSync(out, `${k}=${v}\n`); };
const finish = (status) => {
  setOut("status", status);
  setOut("left", left);
  setOut("right", right);
  console.log(`status=${status} left="${left}" right="${right}"`);
  process.exit(0);
};

const hasLetter = (s) => /\p{L}/u.test(s);
if (!left || !right || !hasLetter(left) || !hasLetter(right)) finish("invalid");

// ---- locate the THEMES array ----
const src = readFileSync(TARGET, "utf8");
const start = src.indexOf("export const THEMES = [");
const close = src.indexOf("\n];", start);
if (start < 0 || close < 0) finish("invalid");
const arrayBody = src.slice(start, close);

// ---- duplicate check (case-insensitive, either orientation) ----
const norm = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();
const existing = [...arrayBody.matchAll(/\[\s*"([^"]*)"\s*,\s*"([^"]*)"\s*\]/g)].map((m) => [norm(m[1]), norm(m[2])]);
const nl = norm(left), nr = norm(right);
if (existing.some(([a, b]) => (a === nl && b === nr) || (a === nr && b === nl))) finish("duplicate");

// ---- insert the new pair right before the closing bracket ----
const line = `\n  [${JSON.stringify(left)}, ${JSON.stringify(right)}],`;
writeFileSync(TARGET, src.slice(0, close) + line + src.slice(close));
finish("ok");
