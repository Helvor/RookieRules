// Vérifie la conversion « tout au féminin » sur toutes les données :
// plus aucun point médian ni « ielle », et les réponses restent distinctes.
// Usage : node tools/check_ecriture.mjs [--list]  (--list affiche chaque forme convertie)
import { readFileSync } from "node:fs";
import { adaptData, feminize } from "../assets/js/ecriture.js";

const root = new URL("../", import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root), "utf8"));
const errors = [];
const forms = new Map();

function collect(text) {
  for (const m of text.matchAll(/[\p{L}’']*[·⋅][\p{L}·⋅]*/gu)) {
    if (!forms.has(m[0])) forms.set(m[0], feminize(m[0]));
  }
}

for (const file of ["data/questions.json", "data/rules.json"]) {
  const raw = read(file);
  adaptData(raw, (s) => { collect(s); return s; });
  const out = adaptData(raw, feminize);
  adaptData(out, (s) => {
    if (/[·⋅]/.test(s)) errors.push(`${file} : point médian restant dans « ${s.slice(0, 120)} »`);
    if (/(?<!\p{L})iel/iu.test(s)) errors.push(`${file} : « iel » restant dans « ${s.slice(0, 120)} »`);
    return s;
  });
  if (out.questions) {
    for (const q of out.questions) {
      if (new Set([q.a, ...q.w]).size !== 4) errors.push(`${q.id} : réponses identiques une fois au féminin`);
    }
  }
}

if (process.argv.includes("--list")) {
  for (const [from, to] of [...forms].sort((a, b) => a[0].localeCompare(b[0], "fr"))) console.log(`${from} → ${to}`);
}
console.log(`${forms.size} formes en écriture inclusive converties`);
if (errors.length) {
  console.log(errors.join("\n"));
  process.exit(1);
}
console.log("OK");
