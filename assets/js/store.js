// Progression enregistrée dans le navigateur (localStorage), rien n'est envoyé ailleurs.

const KEY = "rookierules:v1";

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    if (data && typeof data === "object") return { answers: {}, history: [], ...data };
  } catch {
    // stockage indisponible ou corrompu : on repart de zéro
  }
  return { answers: {}, history: [] };
}

let state = load();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // navigation privée ou quota plein : la progression ne sera simplement pas conservée
  }
}

export function recordAnswer(qid, correct) {
  const a = state.answers[qid] || { seen: 0, right: 0, last: null };
  a.seen += 1;
  if (correct) a.right += 1;
  a.last = correct;
  a.ts = Date.now();
  state.answers[qid] = a;
  save();
}

export function recordSession(mode, score, total) {
  state.history.push({ mode, score, total, ts: Date.now() });
  state.history = state.history.slice(-100);
  save();
}

export function answerOf(qid) {
  return state.answers[qid];
}

// Questions dont la dernière réponse était fausse.
export function toReview() {
  return Object.entries(state.answers).filter(([, a]) => a.last === false).map(([id]) => id);
}

export function summary(questions) {
  let seen = 0;
  let right = 0;
  let total = 0;
  for (const q of questions) {
    const a = state.answers[q.id];
    if (!a) continue;
    seen += 1;
    right += a.right;
    total += a.seen;
  }
  const exams = state.history.filter((h) => h.mode === "exam");
  const best = exams.reduce((m, h) => Math.max(m, h.score), 0);
  return { seen, rate: total ? Math.round((right / total) * 100) : null, exams: exams.length, best };
}

export function themeRate(questions) {
  let right = 0;
  let total = 0;
  for (const q of questions) {
    const a = state.answers[q.id];
    if (a) {
      right += a.right;
      total += a.seen;
    }
  }
  return total ? right / total : null;
}

export function reset() {
  state = { answers: {}, history: [] };
  save();
}
