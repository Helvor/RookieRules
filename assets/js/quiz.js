// Moteur de quiz : tirage des questions, mélange des réponses, correction.
import { shuffle } from "./util.js";
import { dataFile } from "./i18n.js";
import { answerOf, recordAnswer, recordSession } from "./store.js";
import { adapt } from "./prefs.js";

export const EXAM = { size: 20, seconds: 30, pass: 17 };

let bank = null;
const banks = new Map(); // fichier -> questions déjà chargées

// Charge les questions de la langue courante.
export async function loadQuestions() {
  const file = dataFile("questions");
  if (!banks.has(file)) {
    const res = await fetch(file);
    banks.set(file, adapt(await res.json()));
  }
  bank = banks.get(file);
  return bank;
}

export function getBank() {
  return bank;
}

export function themeById(id) {
  return bank.themes.find((t) => t.id === id);
}

// Tirage aléatoire en privilégiant les questions jamais vues, puis les moins vues.
export function pick(pool, n) {
  const ranked = shuffle(pool).sort((a, b) => (answerOf(a.id)?.seen ?? 0) - (answerOf(b.id)?.seen ?? 0));
  return shuffle(ranked.slice(0, n));
}

export function createSession({ mode, questions }) {
  return {
    mode, // "train" | "exam" | "review"
    items: questions.map((q) => {
      const order = shuffle([0, 1, 2, 3]); // 0 = bonne réponse, 1 à 3 = mauvaises réponses
      return { q, order, choices: choicesOf(q, order), correct: order.indexOf(0), chosen: null, timedOut: false };
    }),
    index: 0,
    finished: false,
    startedAt: Date.now(),
  };
}

function choicesOf(q, order) {
  const all = [q.a, ...q.w];
  return order.map((i) => all[i]);
}

// Après un changement de langue : remplace les textes de la série en cours
// par ceux de la nouvelle langue, sans changer l'ordre des réponses ni la progression.
export function translateSession(session) {
  if (!session) return;
  const byId = new Map(bank.questions.map((q) => [q.id, q]));
  for (const item of session.items) {
    const q = byId.get(item.q.id);
    if (!q) continue; // question absente dans cette langue : on garde l'ancienne
    item.q = q;
    item.choices = choicesOf(q, item.order);
  }
}

export function answer(session, choiceIndex, { timedOut = false } = {}) {
  const item = session.items[session.index];
  if (item.chosen !== null || item.timedOut) return item;
  item.chosen = choiceIndex;
  item.timedOut = timedOut;
  recordAnswer(item.q.id, isRight(item));
  return item;
}

export function isRight(item) {
  return item.chosen !== null && item.chosen === item.correct;
}

export function score(session) {
  return session.items.filter(isRight).length;
}

export function finish(session) {
  if (session.finished) return;
  session.finished = true;
  recordSession(session.mode, score(session), session.items.length);
}
