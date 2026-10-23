// Affichage, navigation et recherche dans le texte des règles (data/rules.json).
import { esc, inline, norm, normWithMap, stripMd } from "./util.js";

let rules = null;
const anchors = new Map(); // id -> { chapter, section, block, label }
const searchIndex = [];

export const PARTS = [
  { id: "intro", label: "Introduction" },
  { id: "rules", label: "Règles" },
  { id: "appendix", label: "Appendices" },
  { id: "glossary", label: "Glossaire" },
  { id: "casebook", label: "Livret de mises en situations" },
];

export async function loadRules() {
  if (rules) return rules;
  const res = await fetch("data/rules.json");
  rules = await res.json();
  buildIndex();
  return rules;
}

export function getRules() {
  return rules;
}

function sectionLabel(chapter, section) {
  if (section.level === 1) return chapter.title;
  const prefix = chapter.part === "casebook" ? "C" : "";
  return `${prefix}${section.num} ${section.title}`;
}

function buildIndex() {
  for (const chapter of rules.chapters) {
    anchors.set(chapter.id, { chapter, section: chapter.sections[0], label: chapterLabel(chapter) });
    for (const section of chapter.sections) {
      if (section.level > 1) anchors.set(section.id, { chapter, section, label: sectionLabel(chapter, section) });
      let anchor = section.level > 1 ? section.id : chapter.id;
      let where = section.level > 1 ? sectionLabel(chapter, section) : chapterLabel(chapter);
      if (section.title) {
        searchIndex.push({ chapter, anchor, where, text: `${section.num ?? ""} ${section.title}`, n: norm(section.title), heading: true });
      }
      section.blocks.forEach((block, i) => {
        if (block.id) {
          anchor = block.id;
          if (block.type === "term") where = `Glossaire · ${block.text}`;
          else if (block.type === "scenario") where = `${block.text} (livret)`;
          else where = `${sectionLabel(chapter, section)} · ${block.text}`;
          anchors.set(block.id, { chapter, section, block: i, label: block.type === "h" ? `${sectionLabel(chapter, section)} · ${block.text}` : where });
        }
        const text = block.type === "table"
          ? block.rows.map((r) => r.join(" : ")).join(" · ")
          : block.type === "figure" ? (block.caption || block.alt) : block.text;
        if (text) searchIndex.push({ chapter, anchor, where, text, n: norm(text), heading: ["h", "term", "scenario"].includes(block.type) });
      });
    }
  }
}

export function chapterLabel(chapter) {
  if (chapter.part === "casebook") return `Livret · ${chapter.num}. ${chapter.title}`;
  if (chapter.num) return `${chapter.num}. ${chapter.title}`;
  return chapter.title;
}

export function resolve(id) {
  return anchors.get(id) || null;
}

export function refLabel(id) {
  const a = anchors.get(id);
  if (!a) return id;
  if (id.startsWith("g-")) return `Glossaire : ${a.section.blocks[a.block].text}`;
  if (a.section && a.block === undefined && a.section.level > 1) {
    return a.chapter.part === "casebook" ? `Livret, ${a.label}` : `Section ${a.label}`;
  }
  return a.label;
}

// ---------- Rendu HTML ----------

function renderBlocks(blocks, { from = 0, to = blocks.length } = {}) {
  let html = "";
  let list = null; // "ul" ouvert
  let sub = false; // sous-liste ouverte
  let scenario = false;
  const closeList = () => {
    if (sub) { html += "</ul></li>"; sub = false; }
    if (list) { html += list === "li-open" ? "</li></ul>" : "</ul>"; list = null; }
  };
  for (let i = from; i < to; i++) {
    const b = blocks[i];
    if (b.type !== "li" && b.type !== "li2") closeList();
    if (["scenario", "h", "term"].includes(b.type) && scenario) {
      html += "</div>";
      scenario = false;
    }
    switch (b.type) {
      case "p": html += `<p>${inline(b.text)}</p>`; break;
      case "ol": html += `<p class="ol">${inline(b.text)}</p>`; break;
      case "caption": html += `<p class="muted small">${inline(b.text)}</p>`; break;
      case "quote": html += `<blockquote>${inline(b.text)}</blockquote>`; break;
      case "origin": html += `<p class="origin">${inline(b.text)}</p>`; break;
      case "h": html += `<h4 id="r-${esc(b.id)}">${inline(b.text, { links: false })}</h4>`; break;
      case "term": html += `<h4 class="term" id="r-${esc(b.id)}">${esc(b.text)}</h4>`; break;
      case "scenario":
        html += `<div class="scenario" id="r-${esc(b.id)}"><h4>${esc(b.text)}</h4>`;
        scenario = true;
        break;
      case "li":
        if (sub) { html += "</ul></li>"; sub = false; }
        if (list === "li-open") html += "</li>";
        if (!list) html += "<ul>";
        html += `<li>${inline(b.text)}`;
        list = "li-open";
        break;
      case "li2":
        if (!list) { html += "<ul><li>"; list = "li-open"; }
        if (!sub) { html += "<ul>"; sub = true; }
        html += `<li>${inline(b.text)}</li>`;
        break;
      case "figure":
        html += `<figure><img src="${esc(b.src)}" alt="${esc(b.alt)}" loading="lazy">${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ""}</figure>`;
        break;
      case "table":
        html += `<table><thead><tr>${b.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${b.rows
          .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`;
        break;
      default: break;
    }
  }
  closeList();
  if (scenario) html += "</div>";
  return html;
}

export function renderChapter(chapter) {
  let html = `<h2 class="chap">${esc(chapterLabel(chapter))}</h2>`;
  for (const section of chapter.sections) {
    if (section.level > 1) {
      const tag = "h3";
      html += `<${tag} class="sec" id="r-${esc(section.id)}">${esc(sectionLabel(chapter, section))}</${tag}>`;
    }
    html += renderBlocks(section.blocks);
  }
  return html;
}

// Extrait affiché dans la feuille « Voir la règle » du quiz.
export function renderFragment(id) {
  const a = anchors.get(id);
  if (!a) return { title: id, html: "<p>Règle introuvable.</p>" };
  const { chapter, section } = a;
  const blocks = section.blocks;
  if (a.block !== undefined) {
    const start = a.block;
    let end = start + 1;
    while (end < blocks.length && !["scenario", "term", "h"].includes(blocks[end].type)) end++;
    if (blocks[start].type === "h") {
      return { title: a.label, html: `<h3 class="sec">${esc(sectionLabel(chapter, section))}</h3>${renderBlocks(blocks, { from: start, to: end })}` };
    }
    return { title: a.label, html: renderBlocks(blocks, { from: start, to: end }) };
  }
  if (section.level === 1 && chapter.sections.length === 1) {
    return { title: chapterLabel(chapter), html: renderBlocks(blocks) };
  }
  return { title: sectionLabel(chapter, section), html: renderBlocks(blocks) || "<p class='muted'>Voir les sous-sections.</p>" };
}

// ---------- Recherche ----------

const ID_QUERY = /^(c)?\s*(\d+(?:\.\d+)*)(?:\.?\s*([a-z]))?\.?$/i;

export function findById(query) {
  const m = query.trim().match(ID_QUERY);
  if (!m) return null;
  const id = `${m[1] ? "C" : ""}${m[2]}${m[3] ? "." + m[3].toUpperCase() : ""}`;
  return anchors.has(id) ? id : null;
}

function snippet(text, words) {
  const plain = stripMd(text);
  const { text: n, map } = normWithMap(plain);
  const ranges = [];
  for (const w of words) {
    let from = 0;
    let idx;
    while ((idx = n.indexOf(w, from)) !== -1) {
      ranges.push([map[idx], map[idx + w.length - 1] + 1]);
      from = idx + w.length;
    }
  }
  ranges.sort((x, y) => x[0] - y[0]);
  const first = ranges.length ? ranges[0][0] : 0;
  const start = Math.max(0, first - 90);
  const end = Math.min(plain.length, first + 190);
  let out = "";
  let pos = start;
  for (const [a, b] of ranges) {
    if (a < pos || b > end) continue;
    out += esc(plain.slice(pos, a)) + `<mark>${esc(plain.slice(a, b))}</mark>`;
    pos = b;
  }
  out += esc(plain.slice(pos, end));
  return (start > 0 ? "… " : "") + out + (end < plain.length ? " …" : "");
}

export function search(query, limit = 60) {
  const words = norm(query).split(/\s+/).filter((w) => w.length > 1 || /\d/.test(w));
  if (!words.length) return [];
  const hits = [];
  for (const entry of searchIndex) {
    if (!words.every((w) => entry.n.includes(w))) continue;
    let score = entry.heading ? 5 : 0;
    for (const w of words) score += entry.n.split(w).length - 1;
    if (entry.chapter.part === "rules" || entry.chapter.part === "glossary") score += 1;
    hits.push({ entry, score });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit).map(({ entry }) => ({
    anchor: entry.anchor,
    where: entry.where,
    html: snippet(entry.text, words),
    words,
  }));
}
