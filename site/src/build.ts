// Builds the Fork Commons static site from data/products.json into dist/.
// Run: node src/build.ts   (Node 22.18+ strips the types natively)
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

type Status = "live" | "released" | "beta" | "preview" | "development" | "parked" | "archived" | "planned";
type Blaze = "circle" | "square" | "diamond" | "triangle" | "bar";
interface Program { id: string; name: string; domain?: string; for: string; summary: string; org: string; site?: string; release?: { label: string; url: string; summary: string }; blaze: Blaze }
interface Item {
  name: string; line: string; status?: Status; version?: string; repo: string;
  site?: string; docs?: string; live?: string; liveLabel?: string; program?: string;
  role?: string; usedBy?: string[]; localAI?: string;
  alsoIn?: string[]; // other program pages that list this item too
}
interface Data { programs: Program[]; products: Item[]; core: Item[]; workshop: Item[]; archive: Item[] }

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data: Data = JSON.parse(readFileSync(join(root, "data", "products.json"), "utf8"));
const out = join(root, "dist");
mkdirSync(join(out, "assets"), { recursive: true });

const ESSAY = "https://scottconverse.substack.com/p/open-source-the-world-all-of-it";
const LINKEDIN = "https://www.linkedin.com/in/scottgconverse/";
const NEXTLIGHT_SRC = "https://broadbandbreakfast.com/next/";

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const STATUS_LABEL: Record<Status, string> = {
  live: "Live", released: "Released", beta: "Beta", preview: "Preview",
  development: "In development", parked: "Parked", archived: "Archived", planned: "Planned",
};
const shipping = (s?: Status): boolean => s === "live" || s === "released" || s === "beta" || s === "preview";
// A program lists its own products, then items from other programs or the core that also belong there.
const byProgram = (id: string): Item[] => [
  ...data.products.filter((p) => p.program === id),
  ...[...data.products, ...data.core].filter((p) => p.program !== id && (p.alsoIn ?? []).includes(id)),
];
const program = (id: string): Program => data.programs.find((p) => p.id === id)!;
const pageFor = (id: string): string => `${id}.html`;
const tally = (items: Item[]) => ({ ship: items.filter((i) => shipping(i.status)).length, dev: items.filter((i) => i.status === "development").length });
const tallyText = (items: Item[]): string => { const t = tally(items); return t.dev ? `${t.ship} shipping, ${t.dev} in development` : `${t.ship} shipping`; };

const total = data.products.length;
const totalShip = data.products.filter((p) => shipping(p.status)).length;
const liveTowns = 8; // CivicCast Brief README: Longmont, Boulder, Louisville, Lafayette, Lyons, Nederland, Superior, Erie

// ---------- small graphics ----------
function blaze(shape: Blaze, cls = "bl"): string {
  const s: Record<Blaze, string> = {
    circle: '<circle class="blaze" cx="26" cy="26" r="13"/>',
    square: '<rect class="blaze" x="15" y="15" width="22" height="22" rx="1.5"/>',
    diamond: '<rect class="blaze" x="16" y="16" width="20" height="20" transform="rotate(45 26 26)"/>',
    triangle: '<path class="blaze" d="M26 11 L40 37 L12 37 Z"/>',
    bar: '<rect class="blaze" x="19" y="9" width="14" height="34" rx="1.5"/>',
  };
  return `<svg class="${cls}" viewBox="0 0 52 52" aria-hidden="true" focusable="false"><rect class="bark" x="4" y="0" width="44" height="52" rx="10"/>${s[shape]}</svg>`;
}
const forkIcon = `<svg viewBox="0 0 18 18" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 3v12"/><path d="M5 10.5c0-3.5 8-3 8-6.5V3"/></g><circle cx="5" cy="15" r="2" fill="currentColor"/><circle cx="13" cy="3" r="2" fill="currentColor"/><circle cx="5" cy="3" r="2" fill="currentColor"/></svg>`;

// Deterministic contour lines for the hero's topo-map paper.
function topo(): string {
  const W = 1400, H = 760, paths: string[] = [];
  const centers = [{ x: 1080, y: 250, k: 1 }, { x: 260, y: 640, k: 0.8 }];
  for (const c of centers) {
    for (let r = 1; r <= 15; r++) {
      const pts: string[] = [];
      for (let a = 0; a <= 360; a += 6) {
        const t = (a * Math.PI) / 180;
        const wob = 1 + 0.16 * Math.sin(3 * t + r * 0.7) + 0.08 * Math.sin(5 * t - r * 0.4) + 0.05 * Math.cos(7 * t + r);
        const rad = r * 34 * c.k * wob;
        pts.push(`${(c.x + rad * 1.35 * Math.cos(t)).toFixed(1)},${(c.y + rad * Math.sin(t)).toFixed(1)}`);
      }
      paths.push(`<path${r % 5 === 0 ? ' class="idx"' : ""} d="M${pts.join(" L")} Z"/>`);
    }
  }
  return `<svg class="topo" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${paths.join("")}</svg>`;
}

// The signature: a trail-junction signpost, one routed board per program, plus the planned trail.
function signpost(): string {
  const W = 720, boardH = 62, gap = 16, top = 46;
  const postX = 380;
  type B = { name: string; href: string; count: string; planned?: boolean };
  const list: B[] = data.programs.map((p) => {
    const t = tally(byProgram(p.id));
    return { name: p.name, href: pageFor(p.id), count: t.dev ? `${t.ship} shipping, ${t.dev} coming` : `${t.ship} shipping` };
  });
  list.push({ name: "Community AI", href: "community-ai.html", count: "Planned: being designed now", planned: true });
  const boards = list.map((p, i) => {
    const y = top + i * (boardH + gap);
    const right = i % 2 === 0;
    const w = Math.max(320, p.name.length * 19 + 80);
    const x = right ? postX - 56 : postX + 56 - w;
    const tip = 26;
    const d = right
      ? `M${x},${y} L${x + w - tip},${y} L${x + w},${y + boardH / 2} L${x + w - tip},${y + boardH} L${x},${y + boardH} Z`
      : `M${x + tip},${y} L${x + w},${y} L${x + w},${y + boardH} L${x + tip},${y + boardH} L${x},${y + boardH / 2} Z`;
    const ins = right
      ? `M${x + 7},${y + 7} L${x + w - tip - 3},${y + 7} L${x + w - 9},${y + boardH / 2} L${x + w - tip - 3},${y + boardH - 7} L${x + 7},${y + boardH - 7} Z`
      : `M${x + tip + 3},${y + 7} L${x + w - 7},${y + 7} L${x + w - 7},${y + boardH - 7} L${x + tip + 3},${y + boardH - 7} L${x + 9},${y + boardH / 2} Z`;
    const tx = right ? x + 22 : x + tip + 18;
    return `<a href="${p.href}" aria-label="${esc(p.name)}: ${esc(p.count)}"><g class="swing${p.planned ? " planned" : ""}" style="--d:${0.15 + i * 0.12}s;--r:${right ? 5 : -5}deg">
<path class="board" d="${d}"/><path class="inset" d="${ins}"/>
<text class="bname" x="${tx}" y="${y + 29}">${esc(p.name)}</text>
<text class="bcount" x="${tx}" y="${y + 48}">${esc(p.count)}</text>
</g></a>`;
  }).join("\n");
  const H = top + list.length * (boardH + gap) + 50;
  return `<svg class="signpost" viewBox="0 0 ${W} ${H}" role="group" aria-label="Five programs and one planned trail">
<rect class="post" x="${postX - 13}" y="18" width="26" height="${H - 18}" rx="3"/>
<path class="cap" d="M${postX - 20},26 L${postX},6 L${postX + 20},26 Z"/>
${boards}
</svg>`;
}

// NextLight: one fiber trunk lighting a town's worth of homes.
function fiber(): string {
  const homes: string[] = [], lines: string[] = [];
  const hub = { x: 60, y: 200 };
  for (let i = 0; i < 9; i++) {
    const y = 40 + i * 40, x = 470 - (i % 2) * 40;
    const mid = 230 + (i % 3) * 30;
    const d = `M${hub.x},${hub.y} C${mid},${hub.y} ${mid - 40},${y} ${x - 26},${y}`;
    lines.push(`<path d="${d}" stroke="#7fb08a" stroke-width="2"/><path class="pulse" d="${d}" stroke="#e3ac2e" stroke-width="3" style="animation-delay:${(i * 0.31).toFixed(2)}s"/>`);
    homes.push(`<path d="M${x - 22},${y + 9} L${x - 22},${y - 3} L${x - 11},${y - 13} L${x},${y - 3} L${x},${y + 9} Z" fill="#eef1e6"/>`);
  }
  return `<svg class="fiber" viewBox="0 0 520 400" aria-hidden="true" focusable="false">${lines.join("")}${homes.join("")}<circle cx="${hub.x}" cy="${hub.y}" r="14" fill="#e3ac2e"/><circle cx="${hub.x}" cy="${hub.y}" r="24" fill="none" stroke="#e3ac2e" stroke-width="2" opacity=".5"/></svg>`;
}

// The core as a plain grid: one row per shared part, one column per program, a dot where a program uses it.
function utilities(): string {
  const progs = data.programs;
  const head = `<tr><th scope="col" class="cm-part">Shared part</th>${progs.map((p) => `<th scope="col"><a href="${pageFor(p.id)}">${esc(p.name)}</a></th>`).join("")}</tr>`;
  const rows = data.core.map((c) => {
    const planned = c.status === "planned";
    const cells = progs.map((p) => (c.usedBy ?? []).includes(p.id)
      ? `<td><span class="cm-dot${planned ? " planned" : ""}" role="img" aria-label="${planned ? "Will use" : "Uses"}"></span></td>`
      : `<td><span class="cm-none" role="img" aria-label="Does not use"></span></td>`).join("");
    return `<tr><th scope="row" class="cm-part"><span class="cm-name">${esc(c.name)}${planned ? " <em>(planned)</em>" : ""}</span><span class="cm-role">${esc(c.line)}</span></th>${cells}</tr>`;
  }).join("");
  return `<div class="ledger-wrap"><table class="coremap"><caption>Which program uses which shared part</caption><thead>${head}</thead><tbody>${rows}</tbody></table></div>
<p class="legend-note"><span class="cm-dot"></span> uses it today &nbsp; <span class="cm-dot planned"></span> will use it (planned) &nbsp; <span class="cm-none"></span> does not use it</p>`;
}

const chip = `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="3.5" y="3.5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="6" y="6" width="4" height="4" fill="currentColor"/><path d="M6 1v2.5M10 1v2.5M6 12.5V15M10 12.5V15M1 6h2.5M1 10h2.5M12.5 6H15M12.5 10H15" stroke="currentColor" stroke-width="1.4"/></svg>`;
const localCount = [...data.products, ...data.core, ...data.workshop].filter((i) => i.localAI).length;

// Three scales of local AI: your computer (shipping), your town (planned), your region (planned).
function scales(): string {
  const pc = `<g transform="translate(110,128)"><rect x="-58" y="-46" width="116" height="74" rx="6" fill="#fbfaf3" stroke="#22251f" stroke-width="3"/><rect x="-48" y="-36" width="96" height="54" rx="2" fill="#2f5d3a"/><path d="M-30 8 L-12 -12 L4 2 L16 -10 L32 8 Z" fill="#e3ac2e" opacity=".9"/><rect x="-14" y="28" width="28" height="12" fill="#22251f"/><rect x="-36" y="40" width="72" height="7" rx="3" fill="#22251f"/></g>`;
  const house = (x: number, y: number, s = 1) => `<path transform="translate(${x},${y}) scale(${s})" d="M-14 10 V-4 L0 -16 L14 -4 V10 Z" fill="#fbfaf3" stroke="#22251f" stroke-width="2.5"/>`;
  const town = `<g transform="translate(470,128)">
<path d="M-118 34 C-60 34 -40 0 0 0 C40 0 60 34 118 34" fill="none" stroke="#e3ac2e" stroke-width="3"/>
${house(-96, 18)}${house(-62, 8)}${house(-28, 0)}${house(28, 0)}${house(62, 8)}${house(96, 18)}
<rect x="-22" y="-52" width="44" height="40" rx="4" fill="#4b3424" stroke="#3a271a" stroke-width="3"/><rect x="-14" y="-44" width="28" height="6" fill="#f3e2b8"/><rect x="-14" y="-34" width="28" height="6" fill="#f3e2b8"/><rect x="-14" y="-24" width="28" height="6" fill="#f3e2b8"/>
<path d="M0 -12 L0 0" stroke="#e3ac2e" stroke-width="3"/></g>`;
  const pts: [number, number][] = [[0, 0], [-80, -30], [70, -40], [-50, 40], [80, 30], [10, -70]];
  const region = `<g transform="translate(850,128)">${pts.map(([x, y], i) => pts.slice(i + 1).filter((_, j) => (i + j) % 2 === 0).map(([x2, y2]) => `<path d="M${x} ${y} L${x2} ${y2}" stroke="#2f5d3a" stroke-width="2.5" stroke-dasharray="6 5"/>`).join("")).join("")}${pts.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i === 0 ? 15 : 10}" fill="${i === 0 ? "#e3ac2e" : "#fbfaf3"}" stroke="#22251f" stroke-width="2.5"/>`).join("")}</g>`;
  const arrow = (x: number) => `<path d="M${x} 128 L${x + 70} 128 M${x + 56} 116 L${x + 70} 128 L${x + 56} 140" fill="none" stroke="#4b3424" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
  const label = (x: number, t: string, sub: string, st: string, cls: string) => `<text x="${x}" y="296" text-anchor="middle" class="sc-t">${t}</text><text x="${x}" y="320" text-anchor="middle" class="sc-s">${sub}</text><g transform="translate(${x},350)"><rect x="-64" y="-15" width="128" height="26" rx="3" class="${cls}"/><text y="3" text-anchor="middle" class="sc-p ${cls}-t">${st}</text></g>`;
  return `<svg class="scales" viewBox="0 0 960 380" role="img" aria-labelledby="sc-t sc-d">
<title id="sc-t">Local AI at three scales</title>
<desc id="sc-d">Your computer: shipping now, ${localCount} products run on local models. Your town: planned community AI utility. Your region: planned linked cooperatives.</desc>
<circle cx="110" cy="128" r="96" class="ring now"/><circle cx="470" cy="128" r="128" class="ring plan"/><circle cx="850" cy="128" r="108" class="ring plan"/>
${pc}${town}${region}${arrow(222)}${arrow(612)}
${label(110, "Your computer", `${localCount} products run on local models`, "Shipping now", "sc-now")}
${label(470, "Your town", "A community AI utility on the fiber", "Planned", "sc-plan")}
${label(850, "Your region", "Town utilities linked together", "Planned", "sc-plan")}
</svg>`;
}

// How the community AI utility fits together.
function aiArch(): string {
  const box = (x: number, y: number, w: number, h: number, cls: string, title: string, lines: string[]) =>
    `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" class="${cls}"/><text x="${x + 18}" y="${y + 30}" class="ab-t ${cls}-t">${title}</text>${lines.map((l, i) => `<text x="${x + 18}" y="${y + 54 + i * 20}" class="ab-l ${cls}-l">${l}</text>`).join("")}</g>`;
  const arr = (d: string, dash = false) => `<path d="${d}" class="ab-a"${dash ? ' stroke-dasharray="8 7"' : ""} marker-end="url(#ah)"/>`;
  return `<svg class="aiarch" viewBox="0 0 1180 600" role="img" aria-labelledby="aa-t aa-d">
<title id="aa-t">How the community AI utility fits together</title>
<desc id="aa-d">Residents, civic apps and local organizations come in through the front door, then the gateway, which sends work to the core pool or the member pool, or out to competing hosts for overflow. City staff reach a separate protected pool directly. Everything runs over NextLight fiber with an encrypted private network.</desc>
<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="#4b3424"/></marker></defs>
${box(20, 30, 230, 92, "ab-user", "Residents", ["Sign in with a library card"])}
${box(20, 140, 230, 112, "ab-user", "Civic apps", ["TownReporter, CivicCast Brief,", "TownRecord, TownLight"])}
${box(20, 270, 230, 92, "ab-user", "Local groups", ["Nonprofits and businesses", "with an API key"])}
${box(20, 400, 230, 92, "ab-staff", "City staff", ["Separate accounts"])}
${box(300, 120, 190, 150, "ab-door", "Front door", ["Chat page", "Standard API"])}
${box(540, 60, 260, 270, "ab-gate", "Gateway", ["Identity for every key", "Meter on every request", "Fair allowances", "Routing", "Fallback"])}
${box(860, 30, 300, 100, "ab-core", "Core pool", ["Owned by the community", "Public service and civic apps"])}
${box(860, 150, 300, 100, "ab-member", "Member pool", ["Machines neighbors lend", "Public, patient work only"])}
${box(860, 270, 300, 92, "ab-over", "Overflow", ["Competing hosts, same open models"])}
${box(860, 400, 300, 100, "ab-prot", "Protected pool", ["City records stay here", "Own network, full audit log"])}
${arr("M250 76 C275 76 275 160 296 168")}${arr("M250 196 L296 196")}${arr("M250 316 C275 316 275 230 296 222")}
${arr("M490 195 L536 195")}
${arr("M800 120 C830 120 830 80 856 80")}${arr("M800 195 L856 200")}${arr("M800 270 C830 270 830 316 856 316", true)}
${arr("M250 446 L856 450")}
<text x="300" y="478" class="ab-note">A separate, locked path. Never through the public service.</text>
<rect x="20" y="530" width="1140" height="50" rx="8" class="ab-net"/>
<text x="590" y="561" text-anchor="middle" class="ab-net-t">NextLight fiber, with an encrypted private network on top</text>
</svg>`;
}

// Towns linking up. An illustration of the plan, not a list of members.
function federation(): string {
  const towns: [string, number, number, boolean][] = [["Longmont", 300, 210, true], ["Boulder", 250, 300, false], ["Fort Collins", 330, 60, false], ["Loveland", 330, 135, false], ["Lafayette", 380, 300, false], ["A rural county", 120, 150, false], ["A university", 470, 220, false]];
  const links = [[0, 1], [0, 3], [3, 2], [0, 4], [1, 4], [0, 5], [0, 6], [4, 6], [5, 2]];
  return `<svg class="fed" viewBox="0 0 600 370" role="img" aria-labelledby="fd-t fd-d">
<title id="fd-t">Community AI utilities linked across a region</title>
<desc id="fd-d">An illustration: Longmont's utility linked to neighboring towns, a rural county and a university, each running its own service and sharing capacity.</desc>
${links.map(([a, b]) => `<path d="M${towns[a][1]} ${towns[a][2]} L${towns[b][1]} ${towns[b][2]}" class="fd-l"/>`).join("")}
${towns.map(([n, x, y, home]) => `<g><circle cx="${x}" cy="${y}" r="${home ? 18 : 11}" class="${home ? "fd-home" : "fd-node"}"/><text x="${x}" y="${y + (home ? 40 : 30)}" text-anchor="middle" class="fd-t">${n}</text></g>`).join("")}
</svg>`;
}

// Friendly workflow illustrations for each program page.
const ICON: Record<string, string> = {
  camera: '<rect x="6" y="15" width="26" height="20" rx="3"/><path d="M32 21 L42 15 V35 L32 29 Z"/><circle cx="14" cy="11" r="4"/><circle cx="24" cy="11" r="4"/>',
  gavel: '<rect x="8" y="30" width="30" height="7" rx="2"/><rect x="14" y="9" width="18" height="10" rx="2" transform="rotate(-25 23 14)"/><path d="M25 18 L33 30"/>',
  book: '<path d="M8 10 H22 C24 10 24 12 24 12 V38 C24 36 22 36 22 36 H8 Z"/><path d="M40 10 H26 C24 10 24 12 24 12 V38 C24 36 26 36 26 36 H40 Z"/>',
  stamp: '<rect x="10" y="30" width="28" height="8" rx="2"/><path d="M18 30 V22 H30 V30"/><circle cx="24" cy="15" r="6"/>',
  door: '<rect x="12" y="7" width="24" height="34" rx="2"/><circle cx="30" cy="25" r="2"/><path d="M6 41 H42"/>',
  video: '<rect x="6" y="12" width="36" height="24" rx="3"/><path d="M21 18 L30 24 L21 30 Z"/>',
  lines: '<rect x="9" y="7" width="30" height="34" rx="2"/><path d="M15 15 H33 M15 21 H33 M15 27 H29 M15 33 H25"/>',
  search: '<circle cx="21" cy="21" r="11"/><path d="M29 29 L40 40"/>',
  pen: '<path d="M10 38 L13 28 L32 9 L39 16 L20 35 Z"/><path d="M28 13 L35 20"/>',
  paper: '<rect x="7" y="9" width="34" height="30" rx="2"/><path d="M12 15 H28 M12 21 H36 M12 27 H36 M12 33 H30"/><rect x="31" y="13" width="6" height="6"/>',
  wave: '<path d="M6 24 C10 12 14 12 18 24 C22 36 26 36 30 24 C34 12 38 12 42 24"/>',
  cc: '<rect x="6" y="11" width="36" height="26" rx="4"/><path d="M20 19 C16 17 13 20 13 24 C13 28 16 31 20 29 M34 19 C30 17 27 20 27 24 C27 28 30 31 34 29"/>',
  clock: '<circle cx="24" cy="24" r="16"/><path d="M24 14 V24 L31 29"/>',
  ear: '<path d="M16 34 C16 40 26 40 26 32 C26 26 34 25 34 17 C34 10 28 6 23 6 C16 6 12 11 12 17"/><path d="M19 18 C19 14 27 14 27 19"/>',
  tv: '<rect x="6" y="10" width="36" height="24" rx="3"/><path d="M18 40 H30 M24 34 V40"/>',
  bubble: '<path d="M8 10 H40 V30 H22 L13 38 V30 H8 Z"/>',
  cube: '<path d="M24 6 L40 15 V33 L24 42 L8 33 V15 Z"/><path d="M8 15 L24 24 L40 15 M24 24 V42"/>',
  check: '<circle cx="24" cy="24" r="16"/><path d="M16 24 L22 30 L33 18"/>',
  layers: '<path d="M24 8 L42 17 L24 26 L6 17 Z"/><path d="M6 24 L24 33 L42 24 M6 31 L24 40 L42 31"/>',
  printer: '<rect x="10" y="6" width="28" height="12"/><rect x="6" y="18" width="36" height="16" rx="2"/><rect x="13" y="28" width="22" height="14"/>',
  download: '<path d="M24 6 V30 M14 21 L24 31 L34 21"/><path d="M8 34 V40 H40 V34"/>',
  chip: '<rect x="13" y="13" width="22" height="22" rx="3"/><rect x="19" y="19" width="10" height="10"/><path d="M19 6 V13 M29 6 V13 M19 35 V42 M29 35 V42 M6 19 H13 M6 29 H13 M35 19 H42 M35 29 H42"/>',
  briefcase: '<rect x="6" y="16" width="36" height="22" rx="3"/><path d="M18 16 V11 H30 V16 M6 25 H42"/>',
  person: '<circle cx="24" cy="15" r="8"/><path d="M9 41 C9 30 16 26 24 26 C32 26 39 30 39 41"/>',
  gear: '<circle cx="24" cy="24" r="7"/><path d="M24 6 V12 M24 36 V42 M6 24 H12 M36 24 H42 M11 11 L15 15 M33 33 L37 37 M37 11 L33 15 M15 33 L11 37"/><circle cx="24" cy="24" r="13"/>',
  snapshot: '<rect x="7" y="14" width="34" height="24" rx="3"/><circle cx="24" cy="26" r="7"/><path d="M17 14 L20 9 H28 L31 14"/>',
  lock: '<rect x="10" y="21" width="28" height="20" rx="3"/><path d="M16 21 V15 C16 6 32 6 32 15 V21"/><circle cx="24" cy="31" r="3"/>',
};
const FLOWS: Record<string, [string, string, string][]> = {
  townlight: [["camera", "Capture", "Station records the meeting"], ["gavel", "Decide", "Agendas, motions and votes"], ["book", "Codify", "Every code section traced"], ["stamp", "Serve", "Permits, zoning, records"], ["door", "Release", "A deliberate public release"]],
  "local-news": [["video", "Watch", "Meeting video, packets, minutes"], ["lines", "Transcribe", "Local speech-to-text"], ["search", "Find", "Leads and cited facts"], ["pen", "Write", "Local AI drafts, a person edits"], ["paper", "Publish", "Paper, recap and podcast"]],
  "public-media": [["camera", "Shoot", "Meetings and shows"], ["cc", "Caption", "Live and backup captions"], ["clock", "Schedule", "Playout to the channel"], ["ear", "Describe", "Audio description"], ["tv", "Share", "Channel, portal and archive"]],
  makers: [["bubble", "Describe", "A part in plain English"], ["cube", "Model", "Editable CAD source"], ["check", "Check", "Can it actually print?"], ["layers", "Slice", "Ready for the printer"], ["printer", "Print", "On your own machine"]],
  everyday: [["download", "Install", "One Windows installer"], ["chip", "Choose a model", "Local first, cloud if you want"], ["briefcase", "Work", "Research, patents, writing"], ["lock", "Keep it", "Your data stays with you"]],
};
function flow(id: string, custom?: [string, string, string][], label?: string): string {
  const steps = custom ?? FLOWS[id];
  const W = 1100, n = steps.length, gap = W / n, cy = 78;
  const xs = steps.map((_, i) => gap * i + gap / 2);
  const trail = `<path d="M${xs[0]} ${cy} ${xs.slice(1).map((x, i) => `C${xs[i] + gap / 2} ${cy + (i % 2 ? -38 : 38)} ${x - gap / 2} ${cy + (i % 2 ? -38 : 38)} ${x} ${cy}`).join(" ")}" class="fl-trail"/>`;
  const nodes = steps.map(([ic, t, sub], i) => `<g transform="translate(${xs[i]},${cy})"><circle r="52" class="fl-disc"/><circle r="52" class="fl-ring"/><g transform="translate(-24,-24)" class="fl-icon">${ICON[ic]}</g></g>
<text x="${xs[i]}" y="${cy + 88}" text-anchor="middle" class="fl-t">${esc(t)}</text><text x="${xs[i]}" y="${cy + 110}" text-anchor="middle" class="fl-s">${esc(sub)}</text>`).join("");
  return `<svg class="flow" viewBox="0 0 ${W} 210" role="img" aria-label="${esc(label ?? program(id).name)} workflow: ${esc(steps.map((x) => x[1]).join(", then "))}">${trail}${nodes}</svg>`;
}

// ---------- Real TownLight architecture, redrawn ----------
// Source: townlight/townlight README (Architecture, Connected workflows) and townlight.github.io/assets/*.svg
function townHall(): string {
  const ws = ["Records", "Meetings", "Code", "Zoning", "Planning", "Permitting", "Inspections", "Notice",
    "Access", "Boards", "Contracts", "Procurement", "Budget", "Grants", "Data", "311", "Comms", "Parks", "Core"];
  const L = 150, R = 770, perRow = 7, wsW = (R - L - 40) / perRow;
  const windows = ws.map((n, i) => { const x = L + 20 + (i % perRow) * wsW, y = 150 + Math.floor(i / perRow) * 26; return `<g><rect x="${x + 6}" y="${y}" width="${wsW - 12}" height="10" rx="3" class="th-win"/><path d="M${x + 6} ${y + 4} H${x + wsW - 6}" class="th-awn"/><text x="${x + wsW / 2}" y="${y + 22}" text-anchor="middle" class="th-ws">${n}</text></g>`; }).join("");
  const gears = [[392, 398, 24], [436, 420, 16], [358, 428, 14]].map(([x, y, r]) => `<g transform="translate(${x},${y})"><circle r="${r}" class="th-gear"/><circle r="${r * 0.4}" class="th-gearhole"/>${[0, 45, 90, 135].map((a) => `<rect x="${-r * 0.18}" y="${-r * 1.28}" width="${r * 0.36}" height="${r * 2.56}" rx="2" transform="rotate(${a})" class="th-gear"/>`).join("")}</g>`).join("");
  return `<svg class="hall" viewBox="0 0 1120 640" role="img" aria-labelledby="th-t th-d">
<title id="th-t">How TownLight is built</title>
<desc id="th-d">A cutaway of a town hall. Top floor: the staff desktop with a workspace for each of the 18 desktop modules (Records, Meetings, Code, Zoning, Planning, Permitting, Inspections, Notice, Access, Boards and Commissions, Contracts, Procurement, Budget, Grants, Data, 311, Communications and Parks) and Core. Second floor: the native Rust and Tauri app, which carries each person's sign-in with every request. First floor: the Python domain runtime, where the city's business rules live, with an optional local AI room. Vault: PostgreSQL and the original files. Records leave through a release window only after a decision and an approval. Station is a separate annex with its own database and media.</desc>
<path d="M0 470 H1120" class="th-ground"/>
<rect x="0" y="470" width="1120" height="170" class="th-earth"/>
<path d="M${L - 20} 120 L${(L + R) / 2} 40 L${R + 20} 120 Z" class="th-roof"/>
<text x="${(L + R) / 2}" y="104" text-anchor="middle" class="th-sign">TownLight</text>
<rect x="${L}" y="120" width="${R - L}" height="350" class="th-wall"/>
${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${L + 10 + i * ((R - L - 20) / 5) - 7}" y="120" width="14" height="350" class="th-col"/>`).join("")}
<rect x="${L + 8}" y="128" width="${R - L - 16}" height="104" rx="4" class="th-floor"/>
<text x="${L + 24}" y="144" class="th-fl">Staff desktop</text>
${windows}
<rect x="${L + 8}" y="240" width="${R - L - 16}" height="96" rx="4" class="th-floor"/>
<text x="${L + 24}" y="268" class="th-fl">Native app, built in Rust and Tauri</text>
<text x="${L + 24}" y="292" class="th-sub">Your sign-in travels with every request.</text>
<text x="${L + 24}" y="312" class="th-sub">Nothing reaches the rules without it.</text>
<g transform="translate(640,290)"><rect x="-56" y="-30" width="112" height="56" rx="6" class="th-desk"/><circle cx="0" cy="-42" r="12" class="th-guard"/><path d="M-30 -2 H30 M-30 10 H18" class="th-deskline"/></g>
<rect x="${L + 8}" y="344" width="${R - L - 16}" height="118" rx="4" class="th-floor"/>
<text x="${L + 24}" y="372" class="th-fl">Python domain runtime</text>
<text x="${L + 24}" y="396" class="th-sub">The city's business</text>
<text x="${L + 24}" y="416" class="th-sub">rules, in one place.</text>
${gears}
<rect x="490" y="356" width="150" height="96" rx="6" class="th-ai"/>
<text x="565" y="384" text-anchor="middle" class="th-aih">Local AI</text>
<text x="565" y="406" text-anchor="middle" class="th-ais">Optional, on this</text>
<text x="565" y="424" text-anchor="middle" class="th-ais">same computer</text>
<g transform="translate(${R - 6},400)"><rect x="-74" y="-36" width="74" height="72" rx="4" class="th-releasewin"/><path d="M-62 -6 L-46 8 L-18 -20" class="th-tick"/></g>
<path d="M${R + 4} 400 C${R + 60} 400 ${R + 70} 520 ${R + 140} 540" class="th-out" marker-end="url(#th-ah)"/>
<text x="${R + 92}" y="580" class="th-fl2">Records release</text>
<text x="${R + 92}" y="602" class="th-sub">A decision, then an approval.</text>
<text x="${R + 92}" y="622" class="th-sub">Nothing goes out by accident.</text>
<rect x="${L + 60}" y="492" width="${R - L - 120}" height="118" rx="10" class="th-vault"/>
<circle cx="${L + 120}" cy="551" r="34" class="th-vdoor"/>${[0, 60, 120].map((a) => `<rect x="${L + 117}" y="523" width="6" height="56" rx="2" transform="rotate(${a} ${L + 120} 551)" class="th-vhandle"/>`).join("")}
<text x="${L + 178}" y="540" class="th-vt">PostgreSQL and the original files</text>
<text x="${L + 178}" y="566" class="th-vs">Saved work, every version, and the untouched originals.</text>
<text x="${L + 178}" y="588" class="th-vs">On the town's own computer.</text>
<rect x="890" y="260" width="200" height="210" class="th-annex"/>
<path d="M880 260 L990 200 L1100 260 Z" class="th-roof"/>
<text x="990" y="250" text-anchor="middle" class="th-sign small">Station</text>
<g transform="translate(990,320)" class="th-cam"><rect x="-30" y="-18" width="44" height="36" rx="4"/><path d="M14 -8 L32 -18 V18 L14 8 Z"/></g>
<text x="990" y="384" text-anchor="middle" class="th-sub">Records the meeting</text>
<text x="990" y="406" text-anchor="middle" class="th-sub">Own database</text>
<text x="990" y="428" text-anchor="middle" class="th-sub">and media</text>
<path d="M${R} 300 H890" class="th-walk"/>
<text x="${(R + 890) / 2}" y="292" text-anchor="middle" class="th-walkt">configured link</text>
<defs><marker id="th-ah" viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth="16" markerHeight="16" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="#4b3424"/></marker></defs>
</svg>`;
}

function routeMap(): string {
  const S: Record<string, [number, number]> = {
    Meetings: [150, 200], Station: [330, 90], Records: [590, 90], Release: [870, 90],
    Code: [370, 230], Zoning: [590, 230], Permitting: [790, 230], Inspections: [980, 230], Planning: [150, 360],
    Procurement: [150, 480], Contracts: [370, 480], Data: [790, 480], Grants: [150, 580], Budget: [590, 580],
  };
  const route = (names: string[]) => names.map((n, i) => `${i ? "L" : "M"}${S[n][0]} ${S[n][1]}`).join(" ");
  // r4 has two branches that meet at Data.
  const routes: [string, string, string[][]][] = [
    ["r1", "A meeting becomes a records response", [["Meetings", "Station", "Records", "Release"]]],
    ["r2", "A new law becomes cited staff guidance", [["Meetings", "Code", "Zoning", "Permitting", "Inspections"]]],
    ["r3", "Policy and land use reach the public record", [["Planning", "Zoning", "Permitting", "Records"]]],
    ["r4", "Contracts and budgets become reviewed open data", [["Procurement", "Contracts", "Data"], ["Grants", "Budget", "Data"]]],
  ];
  const stations = Object.entries(S).map(([n, [x, y]]) => `<g><circle cx="${x}" cy="${y}" r="15" class="rm-st"/><text x="${x}" y="${y < 120 ? y - 26 : y + 44}" text-anchor="middle" class="rm-n">${n === "Release" ? "Public release" : n}</text></g>`).join("");
  const legend = routes.map(([c, t], i) => `<g transform="translate(${30 + (i % 2) * 560},${790 + Math.floor(i / 2) * 36})"><path d="M0 0 H44" class="rm-${c}"/><text x="56" y="6" class="rm-lg">${t}</text></g>`).join("");
  return `<svg class="routes" viewBox="0 0 1120 860" role="img" aria-labelledby="rm-t rm-d">
<title id="rm-t">How TownLight's products connect</title>
<desc id="rm-d">${esc(routes.map(([, t, b]) => `${t}: ${b.map((n) => n.join(", then ")).join("; and ")}`).join(". "))}. Core sits under all of them, with Notice, Access and Boards and Commissions alongside.</desc>
${routes.map(([c, , b]) => b.map((n) => `<path d="${route(n)}" class="rm-${c}"/>`).join("")).join("")}
${stations}
<rect x="30" y="660" width="1060" height="84" rx="8" class="rm-core"/>
<text x="560" y="690" text-anchor="middle" class="rm-ct">Core, under every route</text>
<text x="560" y="714" text-anchor="middle" class="rm-cs">Shared accounts and sign-in, task helpers, and coherent backup and recovery.</text>
<text x="560" y="734" text-anchor="middle" class="rm-cs">Notice, Access and Boards &amp; Commissions work alongside any route.</text>
${legend}
</svg>`;
}

const CORE_SAFE: [string, string, string][] = [["person", "Sign in", "A named staff account"], ["check", "Check health", "Setup, settings, readiness"], ["gear", "Apply the rules", "Identity and validation"], ["lock", "Keep every version", "Originals and provenance"], ["snapshot", "Back up", "Stop writers, then snapshot"], ["door", "Restore", "Start, then check it"]];

function stationDelivery(): string {
  return `<svg class="delivery" viewBox="0 0 1120 430" role="img" aria-labelledby="sd-t sd-d">
<title id="sd-t">How a meeting leaves the chamber</title>
<desc id="sd-d">The chamber's video feeds Station capture. Station keeps a private, verified recording as evidence. Separately, a live sender carries an encrypted feed to CivicCast, where the PEG operator controls the cable channel. A separate upload queue sends approved recordings to YouTube with explicit visibility and a receipt.</desc>
<defs><marker id="sd-ah" viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth="16" markerHeight="16" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="#4b3424"/></marker></defs>
<g transform="translate(110,215)"><rect x="-90" y="-80" width="180" height="160" rx="12" class="sd-room"/><path d="M-60 40 H60" class="sd-dais"/><circle cx="-30" cy="18" r="10" class="sd-p"/><circle cx="0" cy="12" r="10" class="sd-p"/><circle cx="30" cy="18" r="10" class="sd-p"/><g transform="translate(0,-44)" class="sd-camg"><rect x="-22" y="-14" width="34" height="28" rx="3"/><path d="M12 -6 L26 -14 V14 L12 6 Z"/></g><text y="106" text-anchor="middle" class="sd-t">Council chamber</text></g>
<path d="M200 215 H300" class="sd-a" marker-end="url(#sd-ah)"/>
<g transform="translate(400,215)"><circle r="78" class="sd-hub"/><text y="-6" text-anchor="middle" class="sd-ht">Station</text><text y="18" text-anchor="middle" class="sd-hs">capture</text></g>
<path d="M478 200 C560 150 600 80 680 80" class="sd-a" marker-end="url(#sd-ah)"/>
<path d="M478 215 H680" class="sd-a sd-live" marker-end="url(#sd-ah)"/>
<path d="M478 230 C560 280 600 350 680 350" class="sd-a" marker-end="url(#sd-ah)"/>
${[["Private evidence", "A verified recording, kept locked", 80, "sd-lane-lock"], ["Live to CivicCast", "Encrypted feed. The station runs the cable channel", 215, "sd-lane-live"], ["Approved upload to YouTube", "Visibility chosen on purpose, with a receipt", 350, "sd-lane-up"]].map(([t, s2, y, c]) => `<g><rect x="690" y="${Number(y) - 46}" width="400" height="92" rx="10" class="${c}"/><text x="712" y="${Number(y) - 8}" class="sd-lt${c === "sd-lane-lock" ? " inv" : ""}">${t}</text><text x="712" y="${Number(y) + 18}" class="sd-ls${c === "sd-lane-lock" ? " inv" : ""}">${s2}</text></g>`).join("")}
</svg>`;
}

// ---------- page chrome ----------
const NAV: [string, string][] = [
  ["index.html", "Home"],
  ...data.programs.map((p): [string, string] => [pageFor(p.id), p.name]),
  ["core.html", "The core"],
  ["community-ai.html", "Community AI"],
  ["workshop.html", "Workshop"],
  ["about.html", "About"],
  ["get-involved.html", "Get involved"],
];

function layout(file: string, title: string, description: string, body: string): string {
  const items = NAV.map(([href, label]) => `<li><a href="${href}"${href === file ? ' aria-current="page"' : ""}>${esc(label)}</a></li>`).join("");
  const fullTitle = file === "index.html" ? "Fork Commons: software the public owns" : `${title} | Fork Commons`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Rokkitt:wght@600;700;800;900&family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="styles.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-head"><div class="wrap">
<a class="mark wood routed" href="index.html">${forkIcon}<span>Fork Commons</span></a>
<nav aria-label="Main" class="nav-wide"><ul class="nav">
<li><details class="drop"><summary${data.programs.some((p) => pageFor(p.id) === file) ? ' aria-current="page"' : ""}>Programs</summary><ul>${data.programs.map((p) => `<li><a href="${pageFor(p.id)}"${pageFor(p.id) === file ? ' aria-current="page"' : ""}>${blaze(p.blaze, "mini")}${esc(p.name)}</a></li>`).join("")}</ul></details></li>
${(["core.html", "community-ai.html", "workshop.html", "about.html"] as const).map((h) => { const lab = NAV.find(([x]) => x === h)![1]; return `<li><a href="${h}"${h === file ? ' aria-current="page"' : ""}>${esc(lab)}</a></li>`; }).join("")}
<li><a class="nav-cta" href="get-involved.html"${file === "get-involved.html" ? ' aria-current="page"' : ""}>Get involved</a></li>
</ul></nav>
<details class="menu"><summary aria-label="Open menu">Menu</summary><nav aria-label="Main, small screens"><ul class="nav">${items}</ul></nav></details>
</div></header>
<main id="main">
${body}
</main>
<footer class="site-foot"><div class="wrap">
<div><h2>Fork Commons</h2><p>Free, open-source software for town halls, newsrooms, public media and workshops, held in trust for the public. Forming as a nonprofit.</p></div>
<div><h2>Programs</h2><ul>${data.programs.map((p) => `<li><a href="${pageFor(p.id)}">${esc(p.name)}</a></li>`).join("")}</ul></div>
<div><h2>Read</h2><ul><li><a href="${ESSAY}">Open-Source the World. All of It.</a></li><li><a href="core.html">The shared core</a></li><li><a href="community-ai.html">Community AI</a></li><li><a href="workshop.html">How it's built</a></li><li><a href="about.html">About</a></li></ul></div>
<div><h2>Code</h2><ul><li><a href="https://github.com/forkcommons">Fork Commons on GitHub</a></li><li><a href="https://github.com/townlight">TownLight on GitHub</a></li><li><a href="https://github.com/scottconverse">Scott Converse on GitHub</a></li><li><a href="${LINKEDIN}">Scott Converse on LinkedIn</a></li></ul></div>
</div></footer>
</body>
</html>
`;
}

function pill(s: Status = "released"): string {
  return `<span class="status status-${s}">${STATUS_LABEL[s]}</span>`;
}
function links(i: Item): string {
  const parts: string[] = [];
  if (i.live) parts.push(`<a href="${esc(i.live)}">${esc(i.liveLabel ?? "Live site")}</a>`);
  if (i.site) parts.push(`<a href="${esc(i.site)}">Website</a>`);
  if (i.docs) parts.push(`<a href="${esc(i.docs)}">Manual</a>`);
  if (i.repo) parts.push(`<a href="${esc(i.repo)}">Code</a>`);
  return parts.join("");
}
function ledger(caption: string, items: Item[], opts: { role?: boolean; uses?: boolean } = {}): string {
  if (!items.length) return "";
  const head = `<tr><th scope="col">${opts.role ? "Component" : "Product"}</th>${opts.role ? '<th scope="col">Job</th>' : ""}<th scope="col">What it does</th>${opts.uses ? '<th scope="col">Serves</th>' : ""}<th scope="col">Status</th><th scope="col">Links</th></tr>`;
  const rows = items.map((i) => {
    const href = i.site ?? i.live;
    return `<tr>
<td class="name">${href ? `<a class="pname" href="${esc(href)}">${esc(i.name)}</a>` : esc(i.name)}${i.version ? `<span class="ver">${esc(i.version)}</span>` : ""}</td>
${opts.role ? `<td>${esc(i.role ?? "")}</td>` : ""}
<td class="what">${esc(i.line)}${i.localAI ? `<span class="lai">${chip}<span>${esc(i.localAI)}</span></span>` : ""}</td>
${opts.uses ? `<td><span class="uses">${(i.usedBy ?? []).map((u) => `<a href="${pageFor(u)}">${esc(program(u).name)}</a>`).join("")}</span></td>` : ""}
<td class="st">${pill(i.status)}</td>
<td class="links">${links(i) || '<span class="muted">Not yet</span>'}</td>
</tr>`;
  }).join("");
  return `<div class="ledger-wrap"><table class="ledger"><caption>${esc(caption)}</caption><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
}

// ---------- shared sections ----------
const picksFor = (id: string, n = 4): Item[] => {
  const order: Status[] = ["live", "released", "beta", "preview", "development"];
  const borrowed = (i: Item) => (i.program === id ? 0 : 1); // a program's own products come first
  return [...byProgram(id)].filter((i) => i.status !== "parked").sort((a, b) => borrowed(a) - borrowed(b) || order.indexOf(a.status!) - order.indexOf(b.status!)).slice(0, n);
};
const trails = data.programs.map((p) => {
  const items = byProgram(p.id);
  const picks = picksFor(p.id).map((i) => `<li><a href="${esc(i.site ?? i.live ?? i.repo)}">${esc(i.name)} ${pill(i.status)}</a></li>`).join("");
  return `<li class="trail">
${blaze(p.blaze)}
<div><h3><a href="${pageFor(p.id)}">${esc(p.name)}</a></h3><p class="for">${esc(p.for)}</p><p class="tally">${esc(tallyText(items))}</p></div>
<div class="body"><p>${esc(p.summary)}</p><ul class="picks" aria-label="${esc(p.name)} highlights">${picks}</ul><p><a class="more" href="${pageFor(p.id)}">All ${items.length} ${esc(p.name)} products</a></p></div>
</li>`;
}).join("");

const aiUtility = `<div class="survey">
<div>
<span class="stake">Planned: in design now</span>
<h2>Next: AI the community owns</h2>
<p style="margin-top:16px">The civic tools here lean on AI. The next step is making sure that intelligence belongs to the community too, so a town that leaves one landlord doesn't move in with another.</p>
<p style="margin-top:14px">The plan: own the core, rent the overflow, keep the switch. Openly licensed models run on machines the community owns, connected over Longmont's own fiber. One gateway meters every request, enforces the cooperative's rules, and can send overflow to whichever host is serving the same open models best that week.</p>
</div>
<div>
<ul>
<li><strong>Shared machines get more done.</strong> Serving many people at once lets one machine produce many times the output it would for a single user. That's the math that makes a town-sized utility work.</li>
<li><strong>Open models are close behind.</strong> Independent tracking puts the best open models a matter of months behind the best closed ones, plenty for summarizing a meeting, searching records or drafting a grant letter.</li>
<li><strong>Sensitive records stay home.</strong> City work runs on separate, locked-down hardware that never touches the public service.</li>
<li><strong>Library card sign-in.</strong> Residents get an allowance, and the civic apps here become the first users on day one.</li>
<li><strong>Neighbors can share capacity.</strong> Members can lend spare machines overnight, and town utilities can link up, settling accounts the way libraries handle interlibrary loans.</li>
</ul>
<p style="margin-top:16px"><a class="more" href="community-ai.html">See the full plan for a community AI utility</a></p>
</div>
</div>`;

// ---------- Home ----------
const workshopLog = data.workshop.slice(0, 7).map((w) => `<span class="k">$</span> ${esc(w.name.toLowerCase().replace(/ /g, "-"))}\n<span class="c">  ${esc(w.line)}</span>`).join("\n");

const home = `<section class="hero">${topo()}<div class="wrap">
<div>
<p class="kicker">${forkIcon}<span>Fork Commons is public software, held in trust</span></p>
<h1>Open-source the world. All of it.</h1>
<p class="lede">Wall Street has learned to buy the software that runs our towns and charge rent on systems we can't afford to leave. We're building the way out: free, open-source software your town, newsroom or station owns outright.</p>
<div class="actions"><a class="btn btn-primary" href="#trails">Find software for your town</a><a class="btn btn-quiet" href="${ESSAY}">Read why</a></div>
<p class="byline">${total} products on five trails, ${totalShip} already shipping. Every line of code is public.</p>
</div>
<div>${signpost()}</div>
</div></section>

<section class="facts" aria-label="At a glance"><ul>
<li><strong>${total}</strong>products across five programs</li>
<li><strong>${totalShip}</strong>shipping today</li>
<li><strong>20</strong>TownLight modules in the Windows beta (19 functional modules plus the Core platform service)</li>
<li><strong>${liveTowns}</strong>Colorado towns on CivicCast Brief</li>
<li><strong>${localCount}</strong>products run on local AI</li>
<li><strong>$0</strong>in license fees, ever</li>
</ul></section>

<section class="section"><div class="wrap rent">
<div class="prose">
<h2>The rent always comes due</h2>
<p>Private equity has spent years buying the companies behind city agendas, permits, public records, municipal codes and school systems. The customers are perfect: a city can't stop issuing permits, and leaving a system it has run for fifteen years can cost more than staying.</p>
<p>So prices climb, features become add-ons, and the public's records sit on a server the public doesn't control.</p>
<p class="quote">The monthly charge was just the visible part. The real transaction was ownership.<cite>Scott Converse, <a href="${ESSAY}">Open-Source the World. All of It.</a></cite></p>
</div>
<table class="compare">
<caption class="muted" style="caption-side:bottom;text-align:left;padding-top:10px;font-size:.875rem">How the same job looks rented and owned.</caption>
<thead><tr><th scope="col"></th><th scope="col">Rented from a vendor</th><th scope="col">Held in the commons</th></tr></thead>
<tbody>
<tr><th scope="row">Where the records live</th><td>On the vendor's servers</td><td>On computers the town controls</td></tr>
<tr><th scope="row">Leaving</th><td>Migrate, retrain, maybe pay to get the data back</td><td>Take the code and the data and go</td></tr>
<tr><th scope="row">Price</th><td>Yearly increases, new modules extra</td><td>Free. Pay only for hardware and help</td></tr>
<tr><th scope="row">Who it answers to</th><td>Its owners</td><td>A nonprofit holding it for the public</td></tr>
<tr><th scope="row">When one town fixes something</th><td>That town paid for it</td><td>Every town gets the fix</td></tr>
</tbody>
</table>
</div></section>

<section class="band"><div class="wrap">
<div style="display:grid;gap:20px">
<h2>Longmont already did this once</h2>
<p>When the telecom companies said it couldn't be done, Longmont built NextLight, its own city-owned fiber network. In 2026, PCMag's readers named it the top internet provider in America, ahead of every national carrier.</p>
<p>If a town can own the network that carries its information, it can own the software that runs on it.</p>
<p class="src">Source: <a href="${NEXTLIGHT_SRC}">Broadband Breakfast, June 2, 2026</a></p>
</div>
<div>${fiber()}</div>
</div></section>

<section class="section" id="trails"><div class="wrap">
<div class="head"><h2>Five trails, one commons</h2><p>Each program serves one kind of public institution. Pick the trail that matches your work, and you'll find software you can install today.</p></div>
<ul class="trails">${trails}</ul>
</div></section>

<section class="section"><div class="wrap">
<div class="head"><h2>The pipes under the street</h2><p>Transcription, records connectors and evidence search are built once and shared, like the water main under every house. A fix made for a town clerk reaches the newsroom and the station the same day.</p></div>
${utilities()}
<p class="legend-note">Read across a row to see every program that shares that part. <a href="core.html">See the core in detail</a></p>
</div></section>

<section class="section localai"><div class="wrap">
<div class="head"><h2>Your AI, on your own machine</h2><p>Nearly everything here runs on AI models on your own computer, through Ollama, LM Studio or llama.cpp, with Whisper for speech. Cloud models are a choice you make, never a requirement, and TownLight's core workflows run with no AI at all.</p></div>
${scales()}
<p class="legend-note">${localCount} products run on local models today. Look for the chip <span class="lai inline">${chip}<span>Local AI</span></span> on every program page. The next step is the town, then the region.</p>
</div></section>

<section class="section"><div class="wrap">${aiUtility}</div></section>

<section class="section"><div class="wrap shop">
<div style="display:grid;gap:18px">
<h2>How one person builds this much</h2>
<p>Fork Commons is built by one developer directing teams of AI coding agents, with a rule that sits under everything: the agent writes claims, never verdicts. Every claim has to point at evidence that a separate tool checks.</p>
<p>Those tools are open source too. Use them on your own projects.</p>
<p><a class="more" href="workshop.html">Visit the workshop: ${data.workshop.length} tools</a></p>
</div>
<pre class="log" aria-label="Some of the workshop tools and what they check">${workshopLog}</pre>
</div></section>

<section class="section"><div class="wrap">
<div class="deed">
<h2>Declaration of trust</h2>
<p class="sub">What Fork Commons promises everyone who depends on its software.</p>
<ol class="articles">
<li><strong>Free, and kept free</strong><span>Every product ships under an open-source license. Nobody can close it later.</span></li>
<li><strong>Your data leaves with you</strong><span>Records stay in formats you can export, read and take anywhere.</span></li>
<li><strong>Run it yourself, or have it hosted</strong><span>Your data and your setup stay yours either way.</span></li>
<li><strong>Public money builds public assets</strong><span>What a town pays to improve goes back into the commons for every town.</span></li>
<li><strong>Honest about status</strong><span>Every product says plainly whether it's live, in beta or still being built.</span></li>
<li><strong>Held in trust</strong><span>A nonprofit holds the code and the name, so it can't be sold out from under you.</span></li>
</ol>
</div>
</div></section>

<section class="section final"><div class="wrap">
<div class="plate wood">
<h2>Take it. Improve it. Give it back.</h2>
<p>Download a product, point it at your town, and tell us what breaks. When it works, give it away. That's how you open-source the world.</p>
<div class="actions"><a class="btn btn-primary" href="get-involved.html">Get involved</a><a class="btn btn-quiet" href="https://github.com/forkcommons">See the code</a></div>
</div>
</div></section>`;
writeFileSync(join(out, "index.html"), layout("index.html", "Home", "Free, open-source software for towns, newsrooms, public media and workshops, held in trust for the public.", home));

// ---------- Program pages ----------
for (const p of data.programs) {
  const items = byProgram(p.id);
  const body = `<section class="page-head"><div class="wrap">
${blaze(p.blaze)}
<div class="text">
${p.domain ? `<p class="muted"><strong>${esc(p.domain)}</strong></p>` : ""}
<h1>${esc(p.name)}</h1>
<p class="lede">${esc(p.summary)}</p>
${p.release ? `<p class="legend-note"><strong>${esc(p.release.label)}:</strong> ${esc(p.release.summary)} <a href="${esc(p.release.url)}">${/candidate/i.test(p.release.label) ? "Candidate notes" : "Release notes and signed installer"}</a>.</p>` : ""}
<div class="meta"><span>For <strong>${esc(p.for.toLowerCase())}</strong></span><span><strong>${esc(tallyText(items))}</strong></span>${p.site ? `<a href="${esc(p.site)}">${esc(p.name)} website</a>` : ""}<a href="${esc(p.org)}">Code on GitHub</a></div>
</div>
</div></section>
<section class="section flow-sec"><div class="wrap"><div class="figwrap">${flow(p.id)}</div></div></section>
${p.id === "townlight" ? `<section class="section"><div class="wrap">
<div class="head"><h2>How TownLight is built</h2><p>Every request carries the sign-in of the person who made it, the city's rules live in one place, and the original files never get overwritten. Station records meetings from its own annex.</p></div>
<div class="figwrap">${townHall()}</div>
</div></section>
<section class="section"><div class="wrap">
<div class="head"><h2>How the work connects</h2><p>Four of the routes TownLight supports today. Each stop keeps its own decisions; a handoff never quietly transfers authority.</p></div>
<div class="figwrap">${routeMap()}</div>
<p class="legend-note">Drawn from the TownLight suite manual's connected workflows and architecture. <a href="https://townlight.github.io/manuals/suite.html#connected-workflows">Read the manual</a></p>
</div></section>` : ""}
${p.id === "public-media" ? `<section class="section"><div class="wrap">
<div class="head"><h2>How a meeting leaves the chamber</h2><p>TownLight Station captures the meeting and hands it to CivicCast for the channel. The private recording, the live feed and the online upload each travel on their own path.</p></div>
<div class="figwrap">${stationDelivery()}</div>
<p class="legend-note">Drawn from TownLight's Station delivery architecture. <a href="https://townlight.github.io/manuals/station.html">Read the Station manual</a></p>
</div></section>` : ""}
<section class="section"><div class="wrap">
${ledger("Shipping now", items.filter((i) => shipping(i.status)))}
${ledger("In development", items.filter((i) => i.status === "development"))}
${ledger("Parked prototypes, not in the Windows release", items.filter((i) => i.status === "parked"))}
</div></section>`;
  writeFileSync(join(out, pageFor(p.id)), layout(pageFor(p.id), p.name, p.summary, body));
}

// ---------- Core ----------
const core = `<section class="page-head plain"><div class="wrap"><div class="text">
<h1>The shared core</h1>
<p class="lede">The parts every program needs, built once: turning recordings into text, pulling records from the systems towns already use, answering questions with the source attached, and soon, the intelligence underneath it all.</p>
</div></div></section>
<section class="section"><div class="wrap">${utilities()}</div></section>
<section class="section flow-sec"><div class="wrap">
<div class="head"><h2>Inside TownLight Core: how a town's records stay safe</h2><p>Core is the foundation under every TownLight product. This is its main path, from a named sign-in to a backup you can actually restore.</p></div>
<div class="figwrap">${flow("townlight", CORE_SAFE, "TownLight Core safekeeping")}</div>
<p class="legend-note">Drawn from TownLight Core's architecture. <a href="https://townlight.github.io/manuals/core.html">Read the Core manual</a></p>
</div></section>
<section class="section"><div class="wrap">${ledger("Components", data.core, { role: true, uses: true })}</div></section>
<section class="section"><div class="wrap">${aiUtility}</div></section>`;
writeFileSync(join(out, "core.html"), layout("core.html", "The shared core", "The shared components under every Fork Commons program, and the planned community AI utility.", core));

// ---------- Community AI ----------
const SRC = {
  lmsys: "https://www.lmsys.org/blog/2025-10-13-nvidia-dgx-spark",
  sglang: "https://arxiv.org/abs/2312.07104",
  vllm: "https://arxiv.org/abs/2309.06180",
  epoch: "https://epoch.ai/data-insights/open-closed-eci-gap",
  litellm: "https://docs.litellm.ai/docs/proxy/users",
  toploc: "https://proceedings.mlr.press/v267/ong25a.html",
};
const layers: [string, string, string][] = [
  ["The front door", "A chat page residents sign into with their library card, plus a standard API that any app can point at by changing one web address.", "LibreChat for the page. The OpenAI-style API that nearly every open tool already speaks."],
  ["The gateway", "Where the cooperative's rules become code: a key for every member and app, a meter on every request, fair monthly allowances, routing, and automatic fallback when a machine is down.", "LiteLLM already does keys, budgets and routing."],
  ["The serving engines", "Software that batches many people's requests through one machine at once, plus specialty models for meeting transcription and records search.", "vLLM and SGLang on the core. llama.cpp on member desktops."],
  ["The hardware", "Three pools: a core the community owns, a locked-down protected pool for city records, and spare capacity members lend.", "A few 128 GB-class machines to start. Grow with measured demand."],
  ["The network", "NextLight fiber underneath, with an encrypted private network on top. Member machines only ever call out, so nobody reaches into a home network.", "WireGuard-style encryption. Outbound-only nodes."],
];
const startSteps = [
  "Form the organization and its rules: membership, pricing, data classes, privacy and retention.",
  "Stand up the core: a handful of machines on the fiber, a small and a mid-size model, speech-to-text and records search, behind the gateway.",
  "Connect the civic apps. TownReporter, CivicCast Brief, TownRecord and TownLight become the first users on day one.",
  "Build the public records index, so residents get answers linked to the source documents.",
  "Open the public door, starting with library card holders.",
  "Build the protected environment for approved city work, with its own hardware, network and audit trail.",
  "Add member machines, starting with makerspace and business computers for overnight batch work.",
  "Wire in rented overflow for low-sensitivity work, from competing hosts serving the same open models.",
  "Measure and publish cost, quality, uptime and use.",
  "Package it so the next town can run the same system, and start linking up with the neighbors.",
];
const communityAI = `<section class="page-head ai-head"><div class="wrap"><div class="text">
<span class="stake">Planned: being designed now</span>
<h1>Community AI</h1>
<p class="lede">Every civic tool here gets smarter with AI. The plan is to make that intelligence belong to the community too: openly licensed models, running on machines the town owns, over the fiber Longmont already built.</p>
<div class="actions"><a class="btn btn-primary" href="#start">See how Longmont could start</a><a class="btn btn-quiet" href="${ESSAY}">Read the essay</a></div>
</div></div></section>

<section class="section"><div class="wrap">
<div class="motto">
<div><span class="mword">Own</span><span>the core</span><p>Community machines run the public service and the civic apps, and hold the city's sensitive work.</p></div>
<div><span class="mword">Rent</span><span>the overflow</span><p>When demand spikes, the gateway sends routine work to whichever host serves the same open models best that week.</p></div>
<div><span class="mword">Keep</span><span>the switch</span><p>Open models and a standard API mean no single company can raise the price or change the terms on you.</p></div>
</div>
</div></section>

<section class="section"><div class="wrap">
<div class="head"><h2>From one computer to a whole region</h2><p>Local AI already works on one machine. The utility takes it to the town, and linked utilities take it to the region.</p></div>
${scales()}
</div></section>

<section class="section"><div class="wrap">
<div class="head"><h2>Why a town can pull this off</h2><p>Five things are already true.</p></div>
<ul class="wins">
<li><strong>Sharing multiplies the machine.</strong><span>A machine can serve many people at once for barely more effort than one. LMSYS measured a small model on a single desktop AI machine going from 20.5 tokens per second for one user to 368 for 32 requests, about 18 times the output from the same box. <a href="${SRC.lmsys}">LMSYS</a></span></li>
<li><strong>Civic questions share their homework.</strong><span>When many residents ask about the same public records, the shared part is worked out once and reused. The SGLang research reported up to 6.4 times the throughput on that kind of workload. <a href="${SRC.sglang}">SGLang paper</a></span></li>
<li><strong>Open models are right behind.</strong><span>Epoch AI found the best open models have trailed the best closed ones by about four months on average in 2026. That's plenty for summarizing a meeting, searching records or drafting a grant letter. <a href="${SRC.epoch}">Epoch AI</a></span></li>
<li><strong>The fiber is in the ground.</strong><span>NextLight already connects the town. In 2026 PCMag's readers named it the top internet provider in America. <a href="${NEXTLIGHT_SRC}">Broadband Breakfast</a></span></li>
<li><strong>The software exists.</strong><span>Almost every piece is already open source: the serving engines, the gateway, the chat page and the encrypted network. The work is putting them together for a town.</span></li>
</ul>
</div></section>

<section class="section"><div class="wrap">
<div class="head"><h2>How it fits together</h2><p>A tap, a meter and rules, a treatment plant, pipes, and separate secure plumbing where it's needed. Here is the whole system on one page.</p></div>
<div class="figwrap">${aiArch()}</div>
<h3 style="margin:48px 0 18px">The five layers</h3>
<ol class="layers">${layers.map(([n, d, t]) => `<li><div class="lname">${esc(n)}</div><p>${esc(d)}</p><p class="tool">${esc(t)}</p></li>`).join("")}</ol>
</div></section>

<section class="section"><div class="wrap">
<div class="head"><h2>Three pools of computers</h2></div>
<div class="pools">
<div class="pool"><h3>The core</h3><p>Owned by the cooperative or nonprofit, in a real room with real power, cooling and backups. Runs the public service and the civic apps. Starts with a few machines, not a rack.</p></div>
<div class="pool protected"><h3>The protected pool</h3><p>Separate, locked-down hardware for city records. Its own network, its own accounts, full audit logs, and nothing leaves the building.</p></div>
<div class="pool member"><h3>The member pool</h3><p>Spare capacity lent by residents, businesses and the makerspace for patient public work, like overnight transcription of a backlog of meeting video.</p></div>
</div>
</div></section>

<section class="section"><div class="wrap two-up">
<div class="prose">
<h2>Answers with the receipts</h2>
<p>When a resident asks when the city first considered a development proposal, the answer shouldn't come from a model's memory. The system searches an index of the real public records, hands the right passages to the model, and the model writes an answer that cites them.</p>
<p>The records do the remembering. The model does the reading and writing. It's cheaper, more accurate and easy to check.</p>
</div>
<div class="prose">
<h2>Neighbors lending spare machines</h2>
<p>A member installs a small program, picks which models to host and when, and the machine asks the cooperative for whole jobs, one machine start to finish. Only public, low-sensitivity work ever goes to a member's computer.</p>
<p>The cooperative checks the work with compact fingerprints of each job, a method called TOPLOC that catches swapped models without rerunning anything, and pays credits under a published formula. <a href="${SRC.toploc}">TOPLOC</a></p>
</div>
</div></section>

<section class="section"><div class="wrap two-up">
<div class="prose">
<h2>Then towns link up</h2>
${federation()}
<p class="muted" style="font-size:.875rem">An illustration of the plan. No other town has signed on yet.</p>
<p>Once one community has a working service, joining others mostly means agreeing on a few standards: the same API, a shared catalog of models, data-sensitivity tags that travel with every request, and plain settlement between cooperatives, the way libraries handle interlibrary loans.</p>
<p>If one cooperative stumbles, the others keep running. Every improvement is shared.</p>
</div>
<div class="prose">
<h2>Paid for by the people who use it</h2>
<p>Member dues tiered for residents, nonprofits and businesses. Metered use above an included allowance. Contracts with the city, the library and the schools. Grants for a public allocation, so people without money or hardware still get access.</p>
<p>And every quarter, the cooperative publishes what it costs and what it delivered.</p>
</div>
</div></section>

<section class="section" id="start"><div class="wrap">
<div class="head"><h2>How Longmont could start</h2><p>Ten steps, each one useful on its own.</p></div>
<ol class="steps">${startSteps.map((t) => `<li>${esc(t)}</li>`).join("")}</ol>
</div></section>

<section class="section final"><div class="wrap">
<div class="plate wood">
<h2>Share the computing. Keep the public's data public.</h2>
<p>Longmont already proved it can own world-class digital infrastructure. The fiber is in the ground, and almost all of the software exists. When it works, give it away.</p>
<div class="actions"><a class="btn btn-primary" href="get-involved.html">Help build it</a><a class="btn btn-quiet" href="core.html">See the shared core</a></div>
</div>
<p class="srcnote">Adapted from Scott Converse's blueprint for a community AI utility. Research cited: <a href="${SRC.lmsys}">LMSYS DGX Spark benchmarks</a>, <a href="${SRC.vllm}">vLLM (SOSP 2023)</a>, <a href="${SRC.sglang}">SGLang (NeurIPS 2024)</a>, <a href="${SRC.epoch}">Epoch AI</a>, <a href="${SRC.litellm}">LiteLLM docs</a>, <a href="${SRC.toploc}">TOPLOC (ICML 2025)</a>.</p>
</div></section>`;
writeFileSync(join(out, "community-ai.html"), layout("community-ai.html", "Community AI", "A plan for community-owned AI: open models on town-owned machines, over Longmont's own fiber.", communityAI));

// ---------- Workshop ----------
const workshop = `<section class="page-head plain"><div class="wrap"><div class="text">
<h1>The workshop</h1>
<p class="lede">How one developer directing AI coding agents ships software a town can trust. The agent writes claims, never verdicts, and open tools check every claim against evidence.</p>
<div class="meta"><span><strong>${data.workshop.length} current tools</strong></span><span><strong>${data.archive.length} earlier tools</strong> kept for the record</span></div>
</div></div></section>
<section class="section"><div class="wrap">
${ledger("Current tools", data.workshop)}
${ledger("Earlier tools, kept for the record", data.archive.map((a) => ({ ...a, status: "archived" as Status })))}
</div></section>`;
writeFileSync(join(out, "workshop.html"), layout("workshop.html", "Workshop", "The open-source tools Fork Commons uses to build and verify its software.", workshop));

// ---------- About ----------
const timeline: [string, string][] = [
  ["1987", "Joins Apple. Co-founds the eWorld group, leads its client software, founds the Apple Electronic Media Lab, and on the side builds OneNet, the largest Mac-based BBS network."],
  ["1994", "Founding senior vice president of Paramount Digital Entertainment."],
  ["1997", "Divisional vice president, high-speed wireless systems, Motorola."],
  ["1999", "Vice president of strategy and technology planning, MCI."],
  ["2003", "Runs a fiber-to-the-curb cable, internet and phone system for Cedar Rapids, Iowa, at McLeodUSA."],
  ["2005", "Founds ClickCaster, one of the first podcasting services."],
  ["2007", "Founds Medioh. Nagravision acquires it in 2009, and Samsung builds its smart TV apps on the platform."],
  ["2013", "Founds TinkerMill in Longmont."],
  ["2017", "Co-founds the Longmont Observer and serves as publisher."],
  ["2020", "Co-founds Longmont Public Media, later serving as CEO. Still on the board."],
  ["2024", "Independent AI product builder and fractional CTO."],
  ["2026", "Writes Open-Source the World. All of It. and gathers his work into Fork Commons."],
];
const about = `<section class="page-head plain"><div class="wrap"><div class="text">
<h1>About Fork Commons</h1>
<p class="lede">An emerging home for public-interest software: a permanent place for free software that can't be taken away from the people who depend on it.</p>
</div></div></section>
<section class="section"><div class="wrap rent">
<div class="prose">
<h2>Why this exists</h2>
<p>Open-source code is a beginning, not an institution. Keeping essential software useful for decades takes maintenance, governance, documentation, security, money, and a way for communities to cooperate.</p>
<p>Fork Commons is that institution. It holds the code and the name in trust, keeps every product honest about its status, and makes sure that when one community builds something useful, the next one can take it, improve it and share it back.</p>
<p><a href="${ESSAY}">Read Open-Source the World. All of It.</a></p>
</div>
<div class="books">
<h3 style="font-size:1.3rem;margin-bottom:14px">Open books</h3>
<dl>
<dt>Legal status</dt><dd>Forming as a nonprofit. Not yet incorporated.</dd>
<dt>Money taken</dt><dd>None yet. No donations, grants or investors.</dd>
<dt>Products</dt><dd>${total} in five programs, ${totalShip} shipping</dd>
<dt>Source code</dt><dd>All public on GitHub</dd>
</dl>
<p class="muted" style="margin-top:14px;font-size:.875rem">Filings, funding and spending will be published here once there are any.</p>
</div>
</div></section>
<section class="section" id="founder"><div class="wrap founder">
<div class="prose">
<h2>Who builds it</h2>
<p class="pull">Scott Converse has spent forty years building the stage other people perform on.</p>
<p>He was never the best player in the room. In high school his best friend was the better artist and the better musician. Scott ran the art club and the drama club and built the sets. The pattern held for the rest of his career: find the system that's broken, work out how the pieces fit, and build the thing everyone else gets to use.</p>
<p>He has shipped products at every platform shift. At Apple he co-founded the eWorld group, led its client software, and on the side ran OneNet, a network of more than a thousand bulletin board systems with over a million members, before most people had heard of the internet. He was the founding executive of Paramount Digital Entertainment, built high-speed wireless software at Motorola, and ran strategy at MCI. Then he founded ClickCaster, one of the first podcasting services, and Medioh, a broadband TV platform that Nagravision acquired and Samsung built its smart TV apps on.</p>
<p>Then he came home to Longmont and started building for his town. In 2013 he held a meetup to see whether Longmont wanted a makerspace. Five people came. He built TinkerMill anyway, and it grew into one of the largest makerspaces in the country. He co-founded the Longmont Observer, a nonprofit local newsroom, and Longmont Public Media, one of the last independent public access stations in Colorado, where he still serves on the board.</p>
<p>In his mid-fifties he decided he had enough money and stopped chasing more. Since then he has built what nobody will pay to build because it needs to exist. Fork Commons is where that work now lives, held in trust so it outlasts him.</p>
<p>His philosophy fits in two words, said happily while looking up at the sun: nothing matters. If nothing matters in the cosmic sense, you're free to choose what does. He chose infrastructure, community, and the stubborn belief that broken systems can be replaced with better ones.</p>
<figure class="portrait">
<img src="assets/scott-converse.jpg" width="400" height="400" alt="Scott Converse, white-haired, in a dark jacket and black turtleneck">
<figcaption><strong>Scott Converse</strong><span>Longmont, Colorado. CU Boulder, economics and philosophy.</span>
<span class="elsewhere"><a href="${LINKEDIN}">LinkedIn</a><a href="https://scottconverse.substack.com/">Substack</a><a href="https://github.com/scottconverse">GitHub</a></span></figcaption>
</figure>
</div>
<ol class="timeline" aria-label="Scott Converse, career timeline">
${timeline.map(([y, t]) => `<li><span class="yr">${esc(y)}</span><span>${esc(t)}</span></li>`).join("\n")}
</ol>
</div></section>`;
writeFileSync(join(out, "about.html"), layout("about.html", "About", "Why Fork Commons exists, who builds it, and where things stand.", about));

// ---------- Get involved ----------
const involved = `<section class="page-head plain"><div class="wrap"><div class="text">
<h1>Get involved</h1>
<p class="lede">Use the software, tell us what breaks, or help build it. Funding comes later, once the nonprofit exists.</p>
</div></div></section>
<section class="section"><div class="wrap">
<ul class="ways">
<li><h3>Use it</h3><div class="prose"><p>Every shipping product can be downloaded and installed today. Town halls, stations, newsrooms and makerspaces that want to try one with real work are exactly who this is built for.</p><p><a href="#trails">Find a product</a></p></div></li>
<li><h3>Report a problem</h3><div class="prose"><p>Each product's code page has an issue tracker. A clear report of what you did and what happened is the most useful thing you can send.</p></div></li>
<li><h3>Help build it</h3><div class="prose"><p>Code, documentation, testing on real hardware and translations are all welcome. Start with the product you use.</p><p><a href="https://github.com/forkcommons">Fork Commons on GitHub</a></p></div></li>
<li><h3>Fund it</h3><div class="prose"><p>Fork Commons isn't accepting money yet. Once the nonprofit is incorporated, donations and grants will go here, and the <a href="about.html">open books</a> will show where every dollar goes.</p></div></li>
</ul>
</div></section>
<section class="section" id="trails"><div class="wrap">
<div class="head"><h2>Pick a trail</h2></div>
<ul class="trails">${trails}</ul>
</div></section>`;
writeFileSync(join(out, "get-involved.html"), layout("get-involved.html", "Get involved", "How to use, improve and eventually fund Fork Commons.", involved));

copyFileSync(join(root, "src", "styles.css"), join(out, "styles.css"));
copyFileSync(join(root, "src", "assets", "scott-converse.jpg"), join(out, "assets", "scott-converse.jpg"));
const repoCount = data.products.length + data.core.filter((c) => c.repo).length + data.workshop.length + data.archive.length;
console.log(`Built ${NAV.length} pages, ${repoCount} listed repositories.`);
