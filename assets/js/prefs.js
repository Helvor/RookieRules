// Préférences d'affichage, enregistrées dans le navigateur (séparément de la progression).
import { adaptData, feminize } from "./ecriture.js";
import { getLang } from "./i18n.js";

const KEY = "rookierules:prefs";

// Formes d'écriture proposées pour les textes en français.
export const ECRITURES = {
  inclusive: "inclusive", // point médian, comme la version officielle des règles (par défaut)
  feminin: "feminin", // tout au féminin, sans point médian (lecture facilitée)
};

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    if (data && typeof data === "object") return { ecriture: ECRITURES.inclusive, ...data };
  } catch {
    // stockage indisponible ou corrompu : réglages par défaut
  }
  return { ecriture: ECRITURES.inclusive };
}

let prefs = load();

export function get(name) {
  return prefs[name];
}

export function set(name, value) {
  prefs = { ...prefs, [name]: value };
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // navigation privée : le réglage ne vaut que pour cette visite
  }
}

// La conversion ne concerne que les textes en français.
function feminin() {
  return prefs.ecriture === ECRITURES.feminin && getLang() === "fr";
}

// Texte rédigé en écriture inclusive, adapté à la forme choisie.
export function w(text) {
  return feminin() ? feminize(text) : text;
}

// Même chose pour des données chargées (questions, règles) dans la langue courante.
export function adapt(data) {
  return feminin() ? adaptData(data, feminize) : data;
}
