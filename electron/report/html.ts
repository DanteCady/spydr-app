import type { Report } from '../../shared/report/model'

/**
 * Turns a report model into a self-contained printable document.
 *
 * Pagination happens in the page rather than in CSS: Chrome's print engine can break a page, but it
 * cannot tell us which page a finding landed on, and "Page 3 of 9" in the footer needs exactly that.
 * So the document lays itself out into fixed Letter-sized sheets, measuring as it goes, and the main
 * process waits for that to finish before printing. The result is also more predictable — a finding
 * card is never sliced through the middle of a row.
 */
const PAPER = {
  Letter: { w: '8.5in', h: '11in' },
  A4: { w: '210mm', h: '297mm' }
}

export function renderReportHtml(report: Report, fontCss: string, paper: 'Letter' | 'A4' = 'Letter'): string {
  const size = PAPER[paper] ?? PAPER.Letter
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>SPYDIR — ${escapeHtml(report.title)}</title>
<style>
${fontCss}
${STYLE}
@page { size: ${size.w} ${size.h}; margin: 0; }
.sheet { width: ${size.w}; height: ${size.h}; }
</style>
</head>
<body>
<div id="sheets"></div>
<script>
const REPORT = ${JSON.stringify(report).replace(/</g, '\\u003c')};
${SCRIPT}
</script>
</body>
</html>`
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)
}

const STYLE = `
:root {
  --ink: #14181d;
  --ink-soft: #4a545f;
  --ink-faint: #8a939d;
  --paper: #f7f5f1;
  --card: #ffffff;
  --line: #e2ddd5;
  --accent: #0f766e;
  --accent-bright: #2dd4bf;
  --cover: #0b0d10;
  --critical: #b3261e;
  --high: #c2410c;
  --medium: #a16207;
  --low: #52616f;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
@page { size: 8.5in 11in; margin: 0; }
html, body { background: var(--paper); }
body {
  font-family: 'Plex Report', -apple-system, system-ui, sans-serif;
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
  font-variant-ligatures: none;
}
.sheet {
  position: relative;
  width: 8.5in;
  height: 11in;
  padding: 0.62in 0.7in 0.55in;
  background: var(--paper);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  page-break-after: always;
  break-after: page;
}
.sheet:last-child { page-break-after: auto; break-after: auto; }

/* ---- running header ---- */
.head { display: flex; align-items: flex-start; justify-content: space-between; flex: none; }
.mark { display: flex; align-items: center; gap: 7px; }
.mark svg { width: 17px; height: 17px; display: block; }
.mark .word { font-size: 15.5px; font-weight: 700; letter-spacing: 0.1em; color: var(--ink); }
.mark .word em { font-style: normal; color: var(--accent); }
.rule-under { height: 2.5px; width: 62px; background: var(--accent); margin-top: 7px; }
.head-label { font-size: 8px; font-weight: 600; letter-spacing: 0.17em; text-transform: uppercase; color: var(--ink-faint); padding-top: 4px; }
.head-line { flex: none; height: 1px; background: var(--line); margin: 0 0 22px; }

/* ---- flowing body ---- */
.body { flex: 1 1 auto; overflow: hidden; min-height: 0; }
h2.section { font-size: 25px; font-weight: 700; letter-spacing: -0.021em; line-height: 1.12; margin-bottom: 11px; }
h2.section.later { margin-top: 26px; }
h2.section.cont { font-size: 15px; color: var(--ink-soft); font-weight: 600; letter-spacing: -0.005em; margin-bottom: 10px; }
p.para { font-size: 10.2px; line-height: 1.62; color: var(--ink-soft); max-width: 6.6in; margin-bottom: 15px; }

/* ---- stat cards ---- */
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 9px; margin-bottom: 15px; }
.stat {
  background: var(--card);
  border: 1px solid var(--line);
  border-top: 2.5px solid var(--accent);
  border-radius: 6px;
  padding: 12px 11px 11px;
}
.stat .v { font-size: 26px; font-weight: 700; letter-spacing: -0.03em; line-height: 1; margin-bottom: 7px; }
.stat .l { font-size: 8.6px; font-weight: 600; line-height: 1.35; margin-bottom: 6px; }
.stat .n { font-size: 7.2px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-faint); }

/* ---- severity bars ---- */
.bars { background: var(--card); border: 1px solid var(--line); border-radius: 6px; padding: 13px 14px 11px; margin-bottom: 15px; }
.bars .bar { display: grid; grid-template-columns: 62px 1fr 26px; align-items: center; gap: 10px; margin-bottom: 7px; }
.bars .bar:last-child { margin-bottom: 0; }
.bars .bl { font-size: 8.6px; font-weight: 600; letter-spacing: 0.02em; }
.bars .track { display: block; height: 7px; background: #eeeae4; border-radius: 4px; overflow: hidden; }
.bars .fill { display: block; height: 100%; border-radius: 4px; }
.bars .bn { font-size: 9.6px; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }

/* ---- callout ---- */
.callout {
  background: #efeee9;
  border-left: 3px solid var(--accent);
  border-radius: 0 6px 6px 0;
  padding: 11px 13px;
  font-size: 9.6px;
  line-height: 1.6;
  color: var(--ink-soft);
  margin-bottom: 15px;
}
.callout b { color: var(--accent); font-weight: 700; }

/* ---- tables ---- */
table.kv { width: 100%; border-collapse: collapse; background: var(--card); border: 1px solid var(--line); border-radius: 6px; margin-bottom: 15px; overflow: hidden; }
table.kv th { font-size: 7.4px; letter-spacing: 0.13em; text-transform: uppercase; color: var(--ink-faint); text-align: left; padding: 9px 12px; border-bottom: 1px solid var(--line); font-weight: 600; }
table.kv td { font-size: 9.2px; line-height: 1.5; padding: 7px 12px; border-bottom: 1px solid #f0ece6; vertical-align: top; color: var(--ink-soft); }
table.kv tr:last-child td { border-bottom: none; }
table.kv td:first-child { font-weight: 600; color: var(--ink); width: 34%; }

/* ---- finding cards ---- */
.card { background: var(--card); border: 1px solid var(--line); border-radius: 7px; padding: 13px 15px 5px; margin-bottom: 14px; }
.card .row:first-child { padding-top: 2px; }
.card .ch { font-size: 12.5px; font-weight: 700; letter-spacing: -0.01em; padding-bottom: 9px; border-bottom: 1px solid var(--line); margin-bottom: 10px; }
.row { display: grid; grid-template-columns: 54px 1fr; gap: 10px; padding-bottom: 10px; margin-bottom: 9px; border-bottom: 1px solid #f2efea; }
.row:last-child { border-bottom: none; }
.sev {
  display: block; align-self: start; justify-self: start; width: 54px;
  font-size: 6.6px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
  padding: 3.5px 0; text-align: center; border-radius: 3px; color: #fff; margin-top: 2px;
}
.sev-critical { background: var(--critical); }
.sev-high { background: var(--high); }
.sev-medium { background: var(--medium); }
.sev-low { background: var(--low); }
.rt { font-size: 10px; font-weight: 700; margin-bottom: 3px; }
.rd { font-size: 8.8px; line-height: 1.5; color: var(--ink-soft); margin-bottom: 4px; }
.rf { font-size: 8.8px; line-height: 1.5; color: var(--ink-soft); }
.rf b { color: var(--accent); font-weight: 600; }
.ro { font-size: 7.4px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-faint); margin-top: 4px; }
.more { font-size: 8.6px; color: var(--ink-faint); padding-bottom: 9px; }

/* ---- footer ---- */
.foot { flex: none; display: flex; justify-content: space-between; align-items: baseline; padding-top: 12px; font-size: 7.6px; color: var(--ink-faint); letter-spacing: 0.04em; }

/* ---- cover ---- */
.sheet.cover { background: var(--cover); color: #f3f5f7; padding: 0.78in 0.8in 0.62in; }
.cover .glow {
  position: absolute; top: -3.2in; right: -3in; width: 8in; height: 8in; border-radius: 50%;
  background: radial-gradient(circle, rgba(45,212,191,0.20) 0%, rgba(45,212,191,0.07) 38%, rgba(45,212,191,0) 68%);
}
.cover .cmark { display: flex; align-items: center; gap: 10px; position: relative; }
.cover .cmark svg { width: 30px; height: 30px; color: var(--accent-bright); }
.cover .cmark .word { font-size: 27px; font-weight: 700; letter-spacing: 0.12em; color: #fff; }
.cover .cmark .word em { font-style: normal; color: var(--accent-bright); }
.cover .mid { position: relative; margin-top: 2.5in; }
.cover .eyebrow { font-size: 10px; font-weight: 700; letter-spacing: 0.24em; color: var(--accent-bright); margin-bottom: 20px; }
.cover h1 { font-size: 58px; font-weight: 700; letter-spacing: -0.035em; line-height: 1.02; color: #fff; word-break: break-word; }
.cover h1.long { font-size: 42px; }
.cover h1.longer { font-size: 32px; }
.cover .lede { margin-top: 26px; font-size: 13px; line-height: 1.68; color: #9aa6b2; max-width: 4.6in; }
.cover .vrule { position: absolute; left: 0.8in; bottom: 2.1in; width: 2px; height: 1.6in; background: var(--accent-bright); opacity: 0.85; }
.cover .cfoot { position: absolute; left: 0.8in; right: 0.8in; bottom: 0.62in; display: flex; justify-content: space-between; align-items: flex-end; }
.cover .cfoot .meta { font-size: 8.8px; line-height: 1.8; color: #75808c; }
.cover .cfoot .meta b { color: #9aa6b2; font-weight: 600; }
.cover .cfoot .url { font-size: 9px; font-weight: 700; letter-spacing: 0.06em; color: var(--accent-bright); }
`

/** Runs inside the document. Builds the sheets, then reports how many there are. */
const SCRIPT = String.raw`
const MARK_PATH = 'M7220 12790 c0 -64 246 -623 668 -1520 316 -671 320 -680 335 -680 9 0 12 -9 9 -30 -2 -17 1 -49 6 -73 10 -38 -5 -123 -157 -882 -101 -506 -173 -841 -180 -843 -23 -8 -72 -55 -87 -84 -8 -16 -21 -60 -28 -96 -12 -64 -30 -92 -400 -647 -214 -319 -385 -569 -382 -555 79 362 74 833 -15 1185 -168 667 -558 1109 -1016 1154 -236 23 -472 -65 -681 -254 -383 -348 -612 -1069 -551 -1735 27 -307 111 -625 219 -839 l31 -63 -33 7 c-18 4 -34 8 -34 9 -1 0 -144 323 -318 716 -175 393 -324 720 -332 726 -8 6 -14 24 -14 40 0 16 -9 49 -21 73 -11 26 -16 47 -10 50 9 6 -41 280 -259 1411 -109 565 -109 563 -50 1105 22 209 54 504 70 655 16 151 48 446 70 655 23 209 44 409 47 445 l6 65 -112 -223 c-112 -225 -145 -309 -180 -462 -61 -268 -123 -754 -167 -1314 -16 -201 -17 -211 -44 -248 -38 -53 -53 -123 -39 -188 10 -47 32 -82 87 -137 12 -12 22 -29 22 -37 0 -13 43 -314 199 -1384 41 -275 59 -427 55 -456 -12 -87 55 -205 125 -221 26 -5 60 -66 389 -691 353 -670 360 -685 350 -721 -21 -75 23 -188 82 -215 37 -16 39 -28 5 -28 -21 0 -1468 435 -1703 511 -62 21 -63 21 -57 53 5 24 2 36 -12 49 -17 15 -31 16 -119 7 -109 -10 -784 -11 -1102 -1 -112 3 -206 4 -208 1 -3 -2 -38 -4 -79 -5 -73 0 -75 1 -86 28 -7 15 -17 26 -24 23 -12 -4 -1444 -1114 -1475 -1142 -12 -12 -12 -16 0 -28 13 -12 117 43 775 415 620 350 767 429 797 429 20 0 48 4 62 10 19 7 37 5 68 -8 39 -15 98 -17 608 -17 432 0 570 -3 587 -13 30 -17 78 -15 115 4 35 18 20 21 248 -39 96 -24 220 -55 275 -67 55 -12 147 -38 205 -58 124 -41 574 -216 848 -330 174 -72 196 -84 232 -125 23 -26 53 -48 69 -52 28 -6 459 -180 468 -188 2 -3 -30 -34 -71 -71 -87 -78 -395 -407 -414 -442 l-13 -25 -30 21 c-16 12 -33 20 -38 18 -4 -2 -79 -84 -167 -183 -219 -249 -408 -457 -548 -604 -128 -135 -171 -193 -187 -256 -10 -40 -11 -40 -49 -37 -83 8 -170 -62 -170 -136 0 -29 -25 -60 -213 -260 -255 -270 -498 -508 -622 -607 -107 -85 -119 -99 -112 -124 4 -15 -1 -21 -23 -26 -15 -3 -42 -21 -61 -41 -25 -26 -33 -43 -33 -72 0 -20 3 -44 7 -52 5 -10 -46 -107 -149 -285 -178 -309 -361 -615 -414 -695 -20 -30 -40 -62 -44 -70 -9 -17 -17 -27 299 345 127 148 306 357 398 464 92 107 167 198 167 202 0 5 -4 9 -9 9 -5 0 0 17 11 38 18 36 19 57 3 96 -8 17 -5 19 32 13 l41 -7 437 458 c252 263 448 461 464 466 70 24 83 31 112 63 26 30 30 42 28 84 l-3 49 494 475 c430 413 498 475 525 475 88 0 162 56 172 129 4 28 10 40 18 37 7 -2 48 18 90 45 67 43 76 47 61 24 -84 -128 -208 -372 -201 -395 7 -24 -4 -45 -25 -45 -10 0 -64 -114 -167 -355 -162 -377 -223 -503 -311 -640 -57 -90 -147 -200 -188 -232 -29 -23 -31 -38 -4 -38 18 0 18 -2 -6 -37 -14 -21 -28 -51 -31 -66 -4 -21 -11 -27 -25 -25 -22 3 -4 63 -247 -807 -73 -258 -146 -510 -162 -560 -42 -124 -127 -285 -214 -407 -50 -72 -68 -104 -58 -106 8 -2 12 -10 9 -19 -3 -8 -6 -26 -6 -39 0 -17 -6 -24 -19 -24 -16 0 -23 -17 -45 -107 -45 -190 -346 -1499 -346 -1505 0 -3 8 -8 18 -10 17 -5 56 91 311 755 232 603 298 766 322 789 34 35 43 65 36 119 -5 36 -3 39 18 39 13 0 26 8 30 18 3 9 136 366 295 792 158 426 298 800 309 830 15 39 31 62 56 79 49 33 79 99 73 162 -5 47 -4 50 16 45 20 -5 31 23 165 387 308 843 288 792 325 809 31 15 66 68 66 100 0 8 27 54 60 102 33 48 82 124 109 170 l47 84 -4 -53 c-5 -67 12 -145 48 -213 27 -50 28 -57 23 -147 -7 -110 2 -132 68 -166 72 -36 102 -10 111 96 2 24 7 29 23 27 92 -12 126 -12 173 1 60 16 57 18 67 -55 11 -82 50 -98 123 -51 58 38 69 79 49 187 -13 74 -13 82 4 110 40 68 58 213 34 279 -3 6 3 22 13 35 l18 23 39 -70 c30 -55 41 -68 51 -60 10 8 20 4 39 -19 14 -17 35 -34 46 -37 13 -4 18 -12 15 -22 -4 -8 20 -56 55 -111 99 -158 132 -239 233 -577 111 -374 192 -657 201 -709 4 -20 15 -41 24 -46 26 -14 -6 123 362 -1520 55 -245 102 -453 105 -462 3 -10 14 -18 25 -18 15 0 19 -7 19 -31 0 -34 13 -64 43 -97 13 -14 88 -237 212 -635 171 -547 194 -612 211 -609 10 2 20 5 20 5 1 1 -2 31 -7 67 -9 71 -59 481 -114 943 -48 401 -39 361 -85 353 -32 -5 -38 -3 -43 14 -3 11 -1 36 4 56 19 68 -21 223 -119 461 -99 240 -193 596 -328 1241 -24 117 -44 225 -44 240 0 15 -9 42 -20 60 -11 18 -20 39 -20 46 0 7 -11 38 -24 67 -34 78 -235 666 -366 1074 -69 214 -121 359 -134 373 -32 36 -72 53 -127 54 l-49 0 20 29 c29 40 37 43 66 24 25 -16 27 -16 41 5 15 21 15 21 58 -19 24 -22 63 -49 87 -61 23 -13 262 -159 531 -327 268 -167 493 -303 500 -300 6 2 17 -9 24 -24 6 -15 28 -38 48 -51 32 -20 71 -91 358 -648 295 -573 324 -625 349 -628 25 -3 26 -5 17 -35 -5 -18 -9 -48 -8 -67 1 -55 242 -942 257 -948 7 -2 17 -1 22 4 10 10 -33 1000 -44 1026 -5 11 -2 17 8 20 20 4 -763 1328 -794 1343 -12 6 -20 20 -20 33 0 36 -61 92 -99 92 -24 0 -31 4 -29 17 2 12 -132 113 -467 354 -358 258 -475 347 -492 376 -31 53 -61 73 -112 73 -36 0 -41 2 -32 14 10 11 1 21 -46 49 -74 44 -207 111 -256 128 -51 18 -48 50 6 61 51 11 111 42 179 94 66 52 158 151 158 173 0 9 18 24 39 34 21 10 50 35 64 55 24 36 31 40 143 70 66 18 182 50 259 71 77 21 298 82 490 136 193 53 431 119 530 147 99 27 248 68 330 90 83 22 162 48 178 59 27 19 27 19 27 0 0 -11 6 -23 13 -28 6 -4 331 -155 722 -336 646 -298 711 -326 722 -311 14 20 17 19 35 -17 7 -14 161 -219 342 -456 284 -373 331 -431 347 -422 16 8 10 24 -64 167 -45 86 -167 322 -272 524 -104 202 -194 366 -200 365 -5 -1 -22 7 -38 17 -15 10 -36 16 -48 13 -16 -4 -19 -1 -17 15 3 24 88 -14 -956 424 -308 130 -573 243 -589 252 -69 39 -80 44 -112 44 -17 0 -47 -8 -66 -18 -19 -10 -41 -19 -49 -20 -14 -1 -575 -173 -795 -244 -49 -16 -252 -79 -450 -140 -198 -61 -416 -129 -484 -151 -68 -21 -131 -39 -140 -39 -9 0 -28 -8 -42 -18 -15 -9 -88 -59 -162 -109 l-136 -93 -8 53 c-4 28 -8 55 -8 58 0 3 50 46 110 96 106 87 255 234 255 252 0 4 21 11 46 14 59 6 106 50 136 128 13 32 223 365 467 741 351 541 450 686 475 699 21 10 41 35 61 73 24 49 30 72 32 140 2 69 39 231 236 1019 129 515 231 937 227 937 -4 0 -10 28 -13 63 -3 34 -13 78 -21 98 -8 20 -11 40 -7 45 5 5 -71 141 -170 304 -132 217 -221 380 -337 615 -277 561 -425 809 -612 1030 -70 83 -150 154 -150 135z';
const MARK = '<svg viewBox="0 0 1114 1280" fill="currentColor"><use href="#spydir-mark"/></svg>';
const WORD = '<span class="word">SPY<em>DR</em></span>';
const host = document.getElementById('sheets');
document.body.insertAdjacentHTML('afterbegin',
  '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><symbol id="spydir-mark" viewBox="0 0 1114 1280">' +
  '<g transform="translate(0 1280) scale(0.1 -0.1)"><path d="' + MARK_PATH + '"/></g></symbol></svg>');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function cover() {
  const m = REPORT.meta;
  const cls = REPORT.title.length > 26 ? 'longer' : REPORT.title.length > 17 ? 'long' : '';
  const s = el('<section class="sheet cover"></section>');
  s.innerHTML =
    '<div class="glow"></div>' +
    '<div class="cmark">' + MARK + WORD + '</div>' +
    '<div class="mid">' +
      '<div class="eyebrow">' + esc(REPORT.eyebrow) + '</div>' +
      '<h1 class="' + cls + '">' + esc(REPORT.title) + '</h1>' +
      '<p class="lede">' + esc(REPORT.lede) + '</p>' +
    '</div>' +
    '<div class="vrule"></div>' +
    '<div class="cfoot">' +
      '<div class="meta">' +
        '<div><b>Directory read</b> ' + esc(new Date(m.ingestedAt).toLocaleString()) + ' · ' + esc(m.protocol) + ' · ' + esc(m.host) + '</div>' +
        '<div><b>Report generated</b> ' + esc(new Date(m.generatedAt).toLocaleString()) + ' · bound as ' + esc(m.boundAs) + '</div>' +
        '<div><b>Scope</b> ' + esc(m.baseDn) + '</div>' +
      '</div>' +
      '<div class="url">READ-ONLY</div>' +
    '</div>';
  host.appendChild(s);
}

let sheets = [];

function sheet(label, continued) {
  const s = el('<section class="sheet"></section>');
  s.innerHTML =
    '<div class="head">' +
      '<div><div class="mark">' + MARK + WORD + '</div><div class="rule-under"></div></div>' +
      '<div class="head-label">' + esc(label) + (continued ? ' · cont.' : '') + '</div>' +
    '</div>' +
    '<div class="head-line" style="margin-top:14px"></div>' +
    '<div class="body"></div>' +
    '<div class="foot"><span></span><span></span></div>';
  host.appendChild(s);
  sheets.push(s);
  return s;
}

function overflows(body) {
  return body.scrollHeight > body.clientHeight + 1;
}

/**
 * Space left on the page, in px. scrollHeight is no help here — it never drops below clientHeight,
 * so an underfull page reports zero room. The bottom of the last block is the real high-water mark.
 */
function roomLeft(body) {
  const box = body.getBoundingClientRect();
  const last = body.lastElementChild;
  return box.bottom - (last ? last.getBoundingClientRect().bottom : box.top);
}

function statBlock(b) {
  return el('<div class="stats">' + b.items.map((i) =>
    '<div class="stat"><div class="v">' + esc(i.value) + '</div><div class="l">' + esc(i.label) + '</div><div class="n">' + esc(i.note) + '</div></div>'
  ).join('') + '</div>');
}

function barBlock(b) {
  return el('<div class="bars">' + b.items.map((i) =>
    '<div class="bar"><span class="bl">' + esc(i.label) + '</span>' +
    '<span class="track"><span class="fill" style="width:' + Math.round(Math.max(i.count ? 3 : 0, i.share * 100)) + '%;background:var(--' + i.severity + ')"></span></span>' +
    '<span class="bn">' + i.count + '</span></div>'
  ).join('') + '</div>');
}

function tableShell(b) {
  return el('<table class="kv"><thead><tr><th>' + esc(b.head[0]) + '</th><th>' + esc(b.head[1]) + '</th></tr></thead><tbody></tbody></table>');
}

function tableRow(r) {
  return el('<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>');
}

function rowEl(f) {
  return el('<div class="row">' +
    '<span class="sev sev-' + f.severity + '">' + f.severity + '</span>' +
    '<div><div class="rt">' + esc(f.title) + '</div>' +
    (f.detail ? '<div class="rd">' + esc(f.detail) + '</div>' : '') +
    (f.fix ? '<div class="rf"><b>Suggested</b> ' + esc(f.fix) + '</div>' : '') +
    (f.objects.length ? '<div class="ro">' + esc(f.objects.join(' · ')) + '</div>' : '') +
    '</div></div>');
}

function layout() {
  cover();
  // A section starts on a fresh page only when there is too little room left to begin it here —
  // otherwise short rule sections each burn a mostly empty page.
  const MIN_ROOM = 200;
  let s = null;
  let body = null;

  for (const section of REPORT.sections) {
    let fresh = false;
    if (!body || roomLeft(body) < MIN_ROOM) {
      s = sheet(section.label, false);
      body = s.querySelector('.body');
      fresh = true;
    } else {
      const label = s.querySelector('.head-label');
      const seen = label.textContent.split(' · ');
      if (!seen.includes(section.label)) label.textContent = seen.concat(section.label).join(' · ');
    }
    let justStarted = true;
    // The heading and its intro, while nothing substantial has followed them on this page yet. If
    // the next block has to break, these travel with it rather than being left dangling.
    let carry = [];

    const nextSheet = (carried) => {
      s = sheet(section.label, !carried);
      body = s.querySelector('.body');
      if (!carried) {
        const h = el('<h2 class="section cont"></h2>');
        h.textContent = section.heading + ' (continued)';
        body.appendChild(h);
      }
      justStarted = true;
      return body;
    };

    const breakPage = () => {
      const moving = carry.slice();
      for (const n of moving) n.remove();
      body = nextSheet(moving.length > 0);
      for (const n of moving) {
        n.classList.remove('later');
        body.appendChild(n);
      }
      return body;
    };

    const place = (node, substantial) => {
      body.appendChild(node);
      // A block taller than a whole page is left where it is rather than bounced forever.
      if (overflows(body) && !justStarted) {
        body.removeChild(node);
        body = breakPage();
        body.appendChild(node);
      }
      justStarted = false;
      if (substantial) carry = [];
      else carry.push(node);
    };

    const heading = el('<h2 class="section' + (fresh ? '' : ' later') + '"></h2>');
    heading.textContent = section.heading;
    body.appendChild(heading);
    carry = [heading];
    justStarted = false;

    for (const block of section.blocks) {
      if (block.kind === 'para') {
        const p = el('<p class="para"></p>');
        p.textContent = block.text;
        place(p, false);
      } else if (block.kind === 'stats') {
        place(statBlock(block), true);
      } else if (block.kind === 'bars') {
        place(barBlock(block), true);
      } else if (block.kind === 'table') {
        // Split row by row, like a findings card, so a long table does not strand half a page.
        let table = tableShell(block);
        place(table, false);
        for (const r of block.rows) {
          const row = tableRow(r);
          table.querySelector('tbody').appendChild(row);
          if (overflows(body)) {
            row.remove();
            const empty = !table.querySelector('tbody tr');
            if (empty) {
              table.remove();
              carry = carry.filter((n) => n !== table);
              body = breakPage();
            } else {
              body = nextSheet(false);
            }
            table = tableShell(block);
            body.appendChild(table);
            table.querySelector('tbody').appendChild(row);
            justStarted = false;
          }
          carry = [];
        }
      } else if (block.kind === 'callout') {
        place(el('<div class="callout"><b>' + esc(block.lead) + '</b> ' + esc(block.body) + '</div>'), true);
      } else if (block.kind === 'findings') {
        const head = block.title ? '<div class="ch">' + esc(block.title) + '</div>' : '';
        let card = el('<div class="card">' + head + '</div>');
        // Not substantial yet: an empty card fits almost anywhere, and only its first row proves
        // the section actually starts on this page.
        place(card, false);
        for (const f of block.items) {
          const row = rowEl(f);
          card.appendChild(row);
          if (overflows(body)) {
            card.removeChild(row);
            const empty = !card.querySelector('.row');
            // A card head stranded at the foot of a page moves with its first row; so does the
            // section heading, if this card was all that followed it.
            if (empty) {
              card.remove();
              carry = carry.filter((n) => n !== card);
              body = breakPage();
              card = el('<div class="card">' + head + '</div>');
            } else {
              carry = [];
              body = nextSheet(false);
              card = el('<div class="card"><div class="ch">' + esc(block.title || section.heading) + ' (continued)</div></div>');
            }
            body.appendChild(card);
            card.appendChild(row);
            justStarted = false;
          }
          carry = [];
        }
        if (block.omitted > 0) {
          const more = el('<div class="more"></div>');
          more.textContent = block.omitted + ' further finding' + (block.omitted === 1 ? '' : 's') +
            ' of this type are not listed individually. Open the Hygiene workspace for the full set.';
          card.appendChild(more);
          if (overflows(body)) { card.removeChild(more); body = nextSheet(false); body.appendChild(more); }
        }
      }
    }
  }

  const total = sheets.length + 1;
  sheets.forEach((s, i) => {
    const spans = s.querySelectorAll('.foot span');
    spans[0].textContent = 'SPYDIR · ' + REPORT.meta.domain + ' · read-only directory report';
    spans[1].textContent = 'Page ' + (i + 2) + ' of ' + total;
  });
  return total;
}

window.__layout = layout;
`
