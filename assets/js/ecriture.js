// Écriture : les textes sont rédigés en écriture inclusive (point médian, comme
// la traduction française officielle des règles). L'option « tout au féminin »
// les convertit pour faciliter la lecture (dyslexie, lecteurs d'écran…).
// Ne concerne que le français.

// Formes à réécrire telles quelles, avant le traitement mot par mot
// (élisions et tournures où le masculin et le féminin n'ont pas la même structure).
const PHRASES = [
  [/(?<!\p{L})([Àà]) la[·⋅]auquel[·⋅]le(?!\p{L})/gu, (m, a) => `${a} laquelle`],
  [/(?<!\p{L})([Ss])[’']il[·⋅]si(?!\p{L})/gu, (m, s) => `${s}i`],
  [/(?<!\p{L})([Ss])[’']ielle(s?)(?!\p{L})/gu, (m, s, pl) => `${s}i elle${pl}`],
  [/(?<!\p{L})(?:([Dd])e )?([Ll])ui[·⋅]d(?=[’'])/gu, (m, d, l) => (/[DL]/.test(d || l) ? "D" : "d")],
];

// Paires de mots entiers : forme masculine·forme féminine (ou l'inverse).
const PAIRS = {
  "le·la": "la", "la·le": "la", "le·a": "la",
  "du·de": "de", "au·à": "à",
  "une·un": "une",
  "il·elle": "elle", "elle·il": "elle", "ils·elles": "elles", "elles·ils": "elles",
  "lui·elle": "elle", "elle·lui": "elle",
  "eux·elles": "elles", "elles·eux": "elles", "ceux·celles": "celles", "celles·ceux": "celles",
  "celui·celle": "celle", "celle·celui": "celle",
  "son·sa": "sa", "sa·son": "sa",
  "ce·cette": "cette", "ce·tte": "cette",
  "tous·tes": "toutes", "tous·toutes": "toutes",
  "ledit·ladite": "ladite",
  "nouveau·elle": "nouvelle", "nouveaux·elles": "nouvelles",
  "destinataire·trice": "destinataire",
};

function keepCase(model, word) {
  return model[0] === model[0].toUpperCase() && model[0] !== model[0].toLowerCase()
    ? word[0].toUpperCase() + word.slice(1)
    : word;
}

// « Jammeur·se » → « Jammeuse », « initiateur·rice » → « initiatrice »,
// « premier·ère » → « première », « pénalisé·es » → « pénalisées »…
function feminine(base, suffix) {
  const plural = suffix.endsWith("s") ? "s" : "";
  if (/teur$/.test(base) && /^t?rices?$/.test(suffix)) return `${base.slice(0, -4)}trice${plural}`;
  if (/eur$/.test(base) && /^(ses?|es|euses?)$/.test(suffix)) return `${base.slice(0, -3)}euse${plural}`;
  if (/eux$/.test(base) && /^ses?$/.test(suffix)) return `${base.slice(0, -1)}${suffix}`;
  if (/er$/.test(base) && /^ères?$/.test(suffix)) return `${base.slice(0, -2)}${suffix}`;
  return base + suffix;
}

// Mots non marqués placés juste avant un mot en écriture inclusive
// (« son Jammeur·se », « au Pivot·e »…) : on les accorde aussi.
const BEFORE = {
  le: "la", un: "une", ce: "cette", cet: "cette", son: "sa", mon: "ma", ton: "ta", du: "de la", au: "à la",
  seul: "seule", premier: "première", dernier: "dernière", aucun: "aucune", tout: "toute",
};
const ELIDE = { le: "l’", son: "son", mon: "mon", ton: "ton" };

const EPICENE = /(?<!\p{L})(le|un|ce|son|du|au|seul) (Pivot|Capitaine|Alternate)(?!\p{L})/giu;

const WORD = /(?:(?<!\p{L})(\p{L}+) )?(\p{L}+)((?:[·⋅]\p{L}+)+)/gu;

export function feminize(text) {
  if (typeof text !== "string" || !/[·⋅]|iel/i.test(text)) return text;
  let out = text;
  for (const [re, fn] of PHRASES) out = out.replace(re, fn);
  out = out.replace(WORD, (m, before, base, rest) => {
    const marked = base + rest;
    const key = marked.toLowerCase().replace(/⋅/g, "·");
    const word = PAIRS[key]
      ? keepCase(marked, PAIRS[key])
      : rest.split(/[·⋅]/).slice(1).reduce((w, suffix) => feminine(w, suffix), base);
    if (!before) return word;
    const det = before.toLowerCase();
    if (!BEFORE[det] || PAIRS[key]) return `${before} ${word}`;
    if (ELIDE[det] && /^[aeiouyéèêàâîôûœh]/i.test(word)) {
      return ELIDE[det].endsWith("’") ? keepCase(before, ELIDE[det]) + word : `${before} ${word}`;
    }
    return `${keepCase(before, BEFORE[det])} ${word}`;
  });
  // Rôles épicènes parfois écrits sans marque (« au Pivot », « son Capitaine »)
  out = out.replace(EPICENE, (m, before, noun) => `${keepCase(before, BEFORE[before.toLowerCase()])} ${noun}`);
  // Pronom neutre « ielle(s) »
  return out.replace(/(?<!\p{L})([Ii])elle(s?)(?!\p{L})/gu, (m, i, pl) => `${i === "I" ? "E" : "e"}lle${pl}`);
}

// Clés dont la valeur n'est jamais du texte affiché.
const RAW_KEYS = new Set(["id", "ref", "src", "img", "source", "theme", "part", "type", "num", "page", "level"]);

// Applique une conversion à toutes les chaînes d'un objet JSON (questions, règles).
export function adaptData(data, convert) {
  if (typeof data === "string") return convert(data);
  if (Array.isArray(data)) return data.map((v) => adaptData(v, convert));
  if (data && typeof data === "object") {
    const out = {};
    for (const [k, v] of Object.entries(data)) out[k] = RAW_KEYS.has(k) ? v : adaptData(v, convert);
    return out;
  }
  return data;
}
