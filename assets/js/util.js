// Petites fonctions partagées : échappement HTML, mise en forme, recherche, hasard.

export function esc(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Convertit le **gras** des règles en <strong> et transforme les renvois
// (« Section 2.5 », « Scénario C4.2.4.F ») en liens internes.
export function inline(text, { links = true } = {}) {
  let html = esc(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  if (links) {
    html = html
      .replace(/\b([Ss]ections?)\s+(\d+(?:\.\d+)*)(?!\d)/g, (m, word, num) =>
        `<a href="#/regles/${num.replace(/\.$/, "")}">${word} ${num}</a>`)
      .replace(/\b(Sc[ée]nario)\s+C\.?(\d+(?:\.\d+)*\.[A-Z])\b/g, (m, word, id) =>
        `<a href="#/regles/C${id}">${word} C${id}</a>`);
  }
  return html;
}

// Normalise pour la recherche : minuscules, sans accents ni point médian.
export function norm(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[·⋅•]/g, "")
    .replace(/\*\*/g, "")
    .replace(/[’']/g, "'");
}

// Comme norm(), mais renvoie aussi la position de chaque caractère normalisé
// dans le texte d'origine, pour surligner les correspondances.
export function normWithMap(text) {
  const out = [];
  const map = [];
  const src = String(text ?? "");
  for (let i = 0; i < src.length; i++) {
    const n = norm(src[i]);
    for (const ch of n) {
      out.push(ch);
      map.push(i);
    }
  }
  return { text: out.join(""), map };
}

export function stripMd(text) {
  return String(text ?? "").replace(/\*\*/g, "");
}

function randomInt(max) {
  if (globalThis.crypto?.getRandomValues) {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

export function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function plural(n, one, many) {
  return `${n} ${n > 1 ? many : one}`;
}

export function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [path, query = ""] = raw.split("?");
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  return { parts, params: new URLSearchParams(query) };
}
