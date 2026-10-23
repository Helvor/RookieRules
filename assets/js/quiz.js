// Moteur de quiz : tirage des questions, mélange des réponses, correction.
import { shuffle } from "./util.js";
import { answerOf, recordAnswer, recordSession } from "./store.js";

export const EXAM = { size: 20, seconds: 30, pass: 17 };

let bank = null;

export async function loadQuestions() {
  if (bank) return bank;
  const res = await fetch("data/questions.json");
  bank = await res.json();
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
      const choices = shuffle([q.a, ...q.w]);
      return { q, choices, correct: choices.indexOf(q.a), chosen: null, timedOut: false };
    }),
    index: 0,
    finished: false,
    startedAt: Date.now(),
  };
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
