// RookieRules : routeur et vues de l'application.
import { esc, norm, parseHash, plural } from "./util.js";
import * as store from "./store.js";
import { EXAM, answer, createSession, finish, getBank, isRight, loadQuestions, pick, score, themeById } from "./quiz.js";
import {
  PARTS, chapterLabel, findById, getRules, loadRules, refLabel, renderChapter, renderFragment, resolve, search,
} from "./rules.js";

const app = document.getElementById("app");
let session = null; // quiz en cours
let timer = null;
let renderedChapter = null;

// ---------- Routeur ----------

const routes = {
  "": viewHome,
  entrainement: viewTrainSetup,
  examen: viewExamIntro,
  quiz: viewQuiz,
  resultats: viewResults,
  regles: viewRules,
  revisions: viewReview,
  "a-propos": viewAbout,
};

const NAV = { "": "home", entrainement: "train", examen: "exam", regles: "rules", revisions: "review" };

function route() {
  const { parts, params } = parseHash();
  const name = parts[0] ?? "";
  const view = routes[name] || viewHome;
  if (name !== "quiz") {
    stopTimer();
    document.onkeydown = null;
  }
  if (name !== "regles") renderedChapter = null;
  for (const a of document.querySelectorAll("[data-nav]")) {
    if (a.dataset.nav === NAV[name]) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  closeSheet();
  view(parts.slice(1), params);
}

function go(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

function setTitle(title) {
  document.title = title ? `${title} · RookieRules` : "RookieRules";
}

function focusMain() {
  window.scrollTo(0, 0);
  app.focus({ preventScroll: true });
}

// ---------- Accueil ----------

function viewHome() {
  setTitle("");
  const bank = getBank();
  const s = store.summary(bank.questions);
  const review = store.toReview().length;
  app.innerHTML = `
    <section class="hero">
      <h1>Révise les règles du roller derby</h1>
      <p class="lead">Comme pour le code de la route : des séries de questions tirées au hasard, un examen blanc chronométré, et les règles officielles WFTDA en français, consultables à tout moment.</p>
    </section>
    <div class="grid">
      <a class="card mode-card featured" href="#/quiz?mode=train&n=20">
        <span class="emoji" aria-hidden="true">🎲</span>
        <h3>Série rapide</h3>
        <p>20 questions au hasard sur tous les thèmes, avec la correction et la règle après chaque réponse.</p>
      </a>
      <a class="card mode-card" href="#/examen">
        <span class="emoji" aria-hidden="true">⏱️</span>
        <h3>Examen blanc</h3>
        <p>${EXAM.size} questions, ${EXAM.seconds} secondes par question, correction à la fin. Réussite à ${EXAM.pass}/${EXAM.size}.</p>
      </a>
      <a class="card mode-card" href="#/entrainement">
        <span class="emoji" aria-hidden="true">🎯</span>
        <h3>Entraînement par thème</h3>
        <p>Choisis tes thèmes et le nombre de questions.</p>
      </a>
      <a class="card mode-card" href="#/revisions">
        <span class="emoji" aria-hidden="true">🔁</span>
        <h3>Mes erreurs</h3>
        <p>${review ? `${plural(review, "question à revoir", "questions à revoir")}.` : "Aucune erreur à revoir pour l’instant."}</p>
      </a>
    </div>

    <h2>Chercher dans les règles</h2>
    <form class="search-hero" role="search" id="home-search">
      <input id="home-q" type="search" aria-label="Rechercher dans les règles" placeholder="Ex. : Star Pass, Lead, 4.2.2, C3.3.A…" autocomplete="off">
      <button class="btn primary" type="submit">Chercher</button>
    </form>

    <h2>Ta progression</h2>
    <div class="card stats">
      <div class="stat"><b>${s.seen}/${bank.questions.length}</b><span>questions déjà vues</span></div>
      <div class="stat"><b>${s.rate === null ? "–" : s.rate + " %"}</b><span>de bonnes réponses</span></div>
      <div class="stat"><b>${s.exams ? `${s.best}/${EXAM.size}` : "–"}</b><span>meilleur examen blanc</span></div>
    </div>

    <h2>Thèmes</h2>
    <div class="theme-list">${themeRows()}</div>
  `;
  document.getElementById("home-search").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = document.getElementById("home-q").value.trim();
    go(q ? `#/regles?q=${encodeURIComponent(q)}` : "#/regles");
  });
  focusMain();
}

function themeRows() {
  const bank = getBank();
  return bank.themes.map((t) => {
    const qs = bank.questions.filter((q) => q.theme === t.id);
    const rate = store.themeRate(qs);
    const pct = rate === null ? 0 : Math.round(rate * 100);
    return `<a class="card theme-row" href="#/quiz?mode=train&themes=${t.id}&n=10">
      <span class="t">${t.icon} ${esc(t.label)}</span>
      <span class="muted small">${qs.length} questions${rate === null ? "" : ` · ${pct} %`}</span>
      <span class="bar" aria-hidden="true"><i style="width:${pct}%"></i></span>
    </a>`;
  }).join("");
}

// ---------- Entraînement ----------

function viewTrainSetup() {
  setTitle("Entraînement");
  const bank = getBank();
  app.innerHTML = `
    <h1>Entraînement</h1>
    <p class="lead">Correction immédiate, explication et lien vers la règle après chaque question.</p>
    <form class="card" id="train-form">
      <fieldset>
        <legend>Thèmes</legend>
        <div class="chips">
          ${bank.themes.map((t) => `<label class="chip"><input type="checkbox" name="theme" value="${t.id}" checked><span>${t.icon} ${esc(t.label)}</span></label>`).join("")}
        </div>
        <div class="btn-row"><button class="btn ghost" type="button" id="all-themes">Tout cocher</button><button class="btn ghost" type="button" id="no-themes">Tout décocher</button></div>
      </fieldset>
      <fieldset>
        <legend>Nombre de questions</legend>
        <div class="chips">
          ${[10, 20, 40].map((n) => `<label class="chip"><input type="radio" name="n" value="${n}" ${n === 20 ? "checked" : ""}><span>${n}</span></label>`).join("")}
          <label class="chip"><input type="radio" name="n" value="all"><span>Toutes</span></label>
        </div>
      </fieldset>
      <p class="muted small" id="train-count"></p>
      <button class="btn primary" type="submit">Commencer</button>
    </form>`;
  const form = document.getElementById("train-form");
  const update = () => {
    const themes = [...form.querySelectorAll("input[name=theme]:checked")].map((i) => i.value);
    const count = bank.questions.filter((q) => themes.includes(q.theme)).length;
    document.getElementById("train-count").textContent = `${count} questions disponibles avec ces thèmes.`;
    form.querySelector("[type=submit]").disabled = count === 0;
  };
  form.addEventListener("change", update);
  document.getElementById("all-themes").onclick = () => { form.querySelectorAll("input[name=theme]").forEach((i) => { i.checked = true; }); update(); };
  document.getElementById("no-themes").onclick = () => { form.querySelectorAll("input[name=theme]").forEach((i) => { i.checked = false; }); update(); };
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const themes = [...form.querySelectorAll("input[name=theme]:checked")].map((i) => i.value);
    const n = form.querySelector("input[name=n]:checked").value;
    go(`#/quiz?mode=train&themes=${themes.join(",")}&n=${n}`);
  });
  update();
  focusMain();
}

// ---------- Examen ----------

function viewExamIntro() {
  setTitle("Examen blanc");
  app.innerHTML = `
    <h1>Examen blanc</h1>
    <div class="card">
      <ul>
        <li>${EXAM.size} questions tirées au hasard parmi tous les thèmes.</li>
        <li>${EXAM.seconds} secondes par question : sans réponse validée à temps, la question compte comme fausse.</li>
        <li>Pas de correction pendant l’examen : tu vois tout à la fin, avec les explications et les règles.</li>
        <li>Examen réussi à partir de <strong>${EXAM.pass}/${EXAM.size}</strong>.</li>
      </ul>
      <div class="btn-row"><a class="btn primary" href="#/quiz?mode=exam">Démarrer l’examen</a></div>
    </div>`;
  focusMain();
}

// ---------- Quiz ----------

function startSession(params) {
  const bank = getBank();
  const mode = params.get("mode") || "train";
  let pool = bank.questions;
  let n = EXAM.size;
  if (mode === "exam") {
    n = EXAM.size;
  } else if (mode === "review") {
    const ids = new Set(store.toReview());
    pool = pool.filter((q) => ids.has(q.id));
    n = pool.length;
  } else {
    const themes = (params.get("themes") || "").split(",").filter(Boolean);
    if (themes.length) pool = pool.filter((q) => themes.includes(q.theme));
    const raw = params.get("n");
    n = raw === "all" ? pool.length : Number(raw) || 20;
  }
  if (!pool.length) return null;
  return createSession({ mode, questions: pick(pool, Math.min(n, pool.length)) });
}

function viewQuiz(_parts, params) {
  // Un nouveau lien de quiz démarre une nouvelle série ; « #/quiz » seul reprend la série en cours.
  if (params.has("mode")) {
    session = startSession(params);
    history.replaceState(null, "", "#/quiz");
  }
  if (!session || session.finished) {
    if (session?.finished) return go("#/resultats");
    app.innerHTML = `<h1>Aucune question</h1><p class="lead">Rien à réviser avec ces critères.</p><a class="btn primary" href="#/">Retour à l’accueil</a>`;
    return;
  }
  setTitle(session.mode === "exam" ? "Examen blanc" : "Quiz");
  renderQuestion();
}

const LETTERS = ["A", "B", "C", "D"];

function renderQuestion() {
  const s = session;
  const item = s.items[s.index];
  const total = s.items.length;
  const exam = s.mode === "exam";
  const answered = item.chosen !== null || item.timedOut;
  const theme = themeById(item.q.theme);
  app.innerHTML = `
    <div class="quiz">
      <div class="quiz-top">
        <span class="count">Question ${s.index + 1}/${total}</span>
        <span class="badge">${theme.icon} ${esc(theme.label)}</span>
        <span class="grow"></span>
        ${exam ? `<span class="timer" id="timer" aria-live="off"></span>` : `<span class="badge accent">${score(s)} ✓</span>`}
      </div>
      <div class="progress" aria-hidden="true"><i style="width:${(s.index / total) * 100}%"></i></div>
      <p class="question" id="q-text">${esc(item.q.q)}</p>
      ${item.q.img ? `<div class="qimg"><img src="${esc(item.q.img)}" alt="Schéma de la question"></div>` : ""}
      <ul class="choices" role="list" aria-labelledby="q-text">
        ${item.choices.map((c, i) => `<li><button class="choice" type="button" data-i="${i}"><span class="letter">${LETTERS[i]}</span><span>${esc(c)}</span></button></li>`).join("")}
      </ul>
      <div id="feedback" aria-live="polite"></div>
      <div class="quiz-actions">
        <button class="btn ghost" type="button" id="quit">Arrêter</button>
        <button class="btn primary" type="button" id="next" ${answered ? "" : "disabled"}>${exam ? "Valider" : nextLabel()}</button>
      </div>
      <p class="kbd-hint">Clavier : touches 1 à 4 (ou A à D) pour répondre, Entrée pour continuer.</p>
    </div>`;

  let selected = null;
  const buttons = [...app.querySelectorAll(".choice")];
  const nextBtn = document.getElementById("next");

  const choose = (i) => {
    if (item.chosen !== null || item.timedOut) return;
    if (exam) {
      selected = i;
      buttons.forEach((b, j) => b.classList.toggle("selected", j === i));
      nextBtn.disabled = false;
      return;
    }
    answer(s, i);
    showCorrection(item, buttons);
    nextBtn.disabled = false;
    nextBtn.focus();
  };
  buttons.forEach((b) => b.addEventListener("click", () => choose(Number(b.dataset.i))));

  const next = () => {
    if (exam && item.chosen === null && !item.timedOut) {
      if (selected === null) return;
      answer(s, selected);
    }
    if (!(item.chosen !== null || item.timedOut)) return;
    if (s.index + 1 < total) {
      s.index += 1;
      renderQuestion();
      focusMain();
    } else {
      endSession();
    }
  };
  nextBtn.addEventListener("click", next);
  document.getElementById("quit").addEventListener("click", () => {
    const done = s.items.filter((it) => it.chosen !== null || it.timedOut).length;
    if (done && !confirm("Arrêter la série ? Les réponses déjà données sont conservées dans ta progression.")) return;
    stopTimer();
    if (done) {
      s.items = s.items.slice(0, done);
      s.index = done - 1;
      endSession();
    } else {
      session = null;
      go("#/");
    }
  });

  document.onkeydown = (e) => {
    if (!document.getElementById("sheet").hidden || e.target.closest?.("input, textarea")) return;
    const k = e.key.toUpperCase();
    const idx = "1234".includes(k) && k.length === 1 ? Number(k) - 1 : LETTERS.indexOf(k);
    if (idx >= 0 && idx < buttons.length && k.length === 1) { e.preventDefault(); choose(idx); }
    else if (e.key === "Enter" && !nextBtn.disabled && e.target.tagName !== "BUTTON") { e.preventDefault(); next(); }
  };

  if (answered && !exam) showCorrection(item, buttons);
  if (exam && !answered) startTimer(item, buttons, next);
}

function nextLabel() {
  return session.index + 1 < session.items.length ? "Question suivante" : "Voir le résultat";
}

function showCorrection(item, buttons) {
  buttons.forEach((b, j) => {
    b.disabled = true;
    if (j === item.correct) b.classList.add("correct");
    else if (j === item.chosen) b.classList.add("wrong");
  });
  const ok = isRight(item);
  // En cas de bonne réponse, l'explication est repliée pour enchaîner plus vite.
  const explanation = `<p>${esc(item.q.why)}</p>${refButton(item.q.ref)}`;
  const feedback = document.getElementById("feedback");
  feedback.innerHTML = `
    <div class="card feedback ${ok ? "ok" : "ko"}">
      <h3>${ok ? "Bonne réponse !" : item.timedOut ? "Temps écoulé" : "Mauvaise réponse"}</h3>
      ${ok ? `<details class="why">
        <summary>Voir l’explication</summary>
        ${explanation}
      </details>` : `<p>Réponse attendue : <strong>${esc(item.q.a)}</strong></p>${explanation}`}
    </div>`;
  bindRefButtons(feedback);
  // Fait apparaître la correction au-dessus de la barre d'actions collée en bas.
  const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  feedback.firstElementChild.scrollIntoView({ block: "nearest", behavior: smooth ? "smooth" : "auto" });
}

function refButton(ref) {
  return `<button class="ref-link" type="button" data-ref="${esc(ref)}">📖 ${esc(refLabel(ref))}</button>`;
}

function bindRefButtons(root) {
  root.querySelectorAll("[data-ref]").forEach((b) => b.addEventListener("click", () => openSheet(b.dataset.ref)));
}

function startTimer(item, buttons, next) {
  stopTimer();
  const el = document.getElementById("timer");
  const deadline = Date.now() + EXAM.seconds * 1000;
  const tick = () => {
    const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    el.textContent = `⏱ ${left} s`;
    el.classList.toggle("low", left <= 5);
    if (left > 0) return;
    stopTimer();
    const sel = buttons.findIndex((b) => b.classList.contains("selected"));
    if (sel >= 0) answer(session, sel);
    else answer(session, null, { timedOut: true });
    next();
  };
  tick();
  timer = setInterval(tick, 250);
}

function stopTimer() {
  if (timer) clearInterval(timer);
  timer = null;
}

function endSession() {
  stopTimer();
  finish(session);
  go("#/resultats");
}

// ---------- Résultats ----------

function viewResults() {
  if (!session || !session.finished) return go("#/");
  setTitle("Résultats");
  const s = session;
  const total = s.items.length;
  const pts = score(s);
  const exam = s.mode === "exam";
  const passed = exam ? pts >= EXAM.pass : pts / total >= 0.85;
  const wrongIds = s.items.filter((it) => !isRight(it)).length;
  app.innerHTML = `
    <div class="quiz">
      <div class="card score-box ${passed ? "pass" : "fail"}">
        <div class="big">${pts}/${total}</div>
        <p class="verdict">${exam ? (passed ? "Examen réussi 🎉" : "Examen non réussi") : passed ? "Excellent !" : pts / total >= 0.6 ? "Pas mal, continue !" : "À retravailler"}</p>
        <p class="muted">${exam ? `Il fallait ${EXAM.pass}/${EXAM.size} pour réussir.` : `${Math.round((pts / total) * 100)} % de bonnes réponses.`}</p>
        <div class="btn-row" style="justify-content:center">
          <a class="btn primary" href="${exam ? "#/quiz?mode=exam" : "#/quiz?mode=train&n=20"}">${exam ? "Nouvel examen" : "Nouvelle série"}</a>
          ${wrongIds ? `<a class="btn" href="#/quiz?mode=review">Revoir mes erreurs</a>` : ""}
          <a class="btn ghost" href="#/">Accueil</a>
        </div>
      </div>
      <h2>Correction</h2>
      <ol class="review-list">
        ${s.items.map((it, i) => {
          const ok = isRight(it);
          const mine = it.chosen === null ? "Pas de réponse (temps écoulé)" : it.choices[it.chosen];
          return `<li class="card review-item ${ok ? "ok" : "ko"}">
            <p class="q">${i + 1}. ${esc(it.q.q)}</p>
            ${ok ? `<p class="ans-ok">✓ ${esc(it.q.a)}</p>` : `<p class="ans-ko">✗ Ta réponse : ${esc(mine)}</p><p class="ans-ok">✓ ${esc(it.q.a)}</p>`}
            <p class="muted small">${esc(it.q.why)}</p>
            ${refButton(it.q.ref)}
          </li>`;
        }).join("")}
      </ol>
    </div>`;
  bindRefButtons(app);
  focusMain();
}

// ---------- Révisions ----------

function viewReview() {
  setTitle("Révisions");
  const bank = getBank();
  const ids = new Set(store.toReview());
  const list = bank.questions.filter((q) => ids.has(q.id));
  app.innerHTML = `
    <h1>Mes erreurs</h1>
    <p class="lead">Les questions auxquelles tu as mal répondu la dernière fois. Une question disparaît de cette liste dès que tu y réponds correctement.</p>
    ${list.length ? `
      <div class="btn-row"><a class="btn primary" href="#/quiz?mode=review">Revoir ${plural(list.length, "question", "questions")}</a></div>
      <h2>À revoir</h2>
      <ul class="review-list">
        ${list.map((q) => `<li class="card review-item ko"><p class="q">${esc(q.q)}</p>${refButton(q.ref)}</li>`).join("")}
      </ul>` : `<div class="card"><p>Aucune erreur à revoir. Lance une <a href="#/quiz?mode=train&n=20">série rapide</a> !</p></div>`}
    <h2>Progression</h2>
    <div class="theme-list">${themeRows()}</div>
    <div class="btn-row"><button class="btn ghost" type="button" id="reset">Effacer ma progression</button></div>
    <p class="muted small">Ta progression est enregistrée uniquement dans ce navigateur.</p>`;
  bindRefButtons(app);
  document.getElementById("reset").addEventListener("click", () => {
    if (confirm("Effacer toute ta progression et tes erreurs enregistrées ?")) {
      store.reset();
      viewReview();
    }
  });
  focusMain();
}

// ---------- Règles ----------

function tocHtml(activeChapter) {
  const rules = getRules();
  return PARTS.map((part) => {
    const chapters = rules.chapters.filter((c) => c.part === part.id);
    if (!chapters.length) return "";
    return `<h3>${esc(part.label)}</h3>${chapters.map((c) => {
      const active = activeChapter && c.id === activeChapter.id;
      const subs = active ? c.sections.filter((s) => s.level === 2) : [];
      return `<a href="#/regles/${esc(c.id)}" class="${active ? "active" : ""}">${esc(part.id === "casebook" ? `${c.num}. ${c.title}` : chapterLabel(c))}</a>
        ${subs.length ? `<div class="sub">${subs.map((s) => `<a href="#/regles/${esc(s.id)}">${esc(s.num)} ${esc(s.title)}</a>`).join("")}</div>` : ""}`;
    }).join("")}`;
  }).join("");
}

function backToQuiz() {
  return session && !session.finished ? `<div class="btn-row" style="margin-top:0;margin-bottom:12px"><a class="btn" href="#/quiz">↩ Revenir au quiz</a></div>` : "";
}

function searchBar(value = "") {
  return `<form class="searchbar" role="search" id="rules-search">
      <input type="search" id="rules-q" value="${esc(value)}" placeholder="Mot-clé ou numéro (ex. : apex, 2.2.4, C4.3.D)" aria-label="Rechercher dans les règles" autocomplete="off">
      <button class="btn primary" type="submit">Chercher</button>
    </form>`;
}

function bindSearch() {
  const form = document.getElementById("rules-search");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = document.getElementById("rules-q").value.trim();
    go(q ? `#/regles?q=${encodeURIComponent(q)}` : "#/regles");
  });
}

function viewRules(parts, params) {
  const id = parts[0];
  const q = params.get("q");
  if (id) return showRule(id, params.get("hl"));
  setTitle("Règles");
  renderedChapter = null;
  const rules = getRules();
  if (q) {
    const direct = findById(q);
    const hits = search(q);
    app.innerHTML = `
      ${backToQuiz()}
      <h1>Recherche</h1>
      ${searchBar(q)}
      ${direct ? `<div class="btn-row" style="margin-top:0"><a class="btn primary" href="#/regles/${esc(direct)}">Aller à ${esc(refLabel(direct))}</a></div>` : ""}
      <p class="muted">${hits.length ? `${plural(hits.length, "résultat", "résultats")}${hits.length >= 60 ? " (les 60 premiers)" : ""} pour « ${esc(q)} »` : `Aucun résultat pour « ${esc(q)} ».`}</p>
      <ul class="results">
        ${hits.map((h) => `<li class="result"><a class="card" href="#/regles/${esc(h.anchor)}?hl=${encodeURIComponent(h.words.join(" "))}">
            <div class="where">${esc(h.where)}</div><p class="snip">${h.html}</p></a></li>`).join("")}
      </ul>`;
    bindSearch();
    focusMain();
    return;
  }
  app.innerHTML = `
    ${backToQuiz()}
    <h1>Les règles</h1>
    <p class="lead">${esc(rules.title)} — version ${esc(rules.version)}, traduction française officielle de la WFTDA, avec le glossaire et le livret de mises en situations.</p>
    ${searchBar()}
    <div class="grid">
      ${PARTS.map((part) => {
        const chapters = rules.chapters.filter((c) => c.part === part.id);
        return `<div class="card"><h3 style="margin-top:0">${esc(part.label)}</h3>${chapters.map((c) =>
          `<p style="margin:6px 0"><a href="#/regles/${esc(c.id)}">${esc(part.id === "casebook" ? `${c.num}. ${c.title}` : chapterLabel(c))}</a></p>`).join("")}</div>`;
      }).join("")}
    </div>`;
  bindSearch();
  focusMain();
}

function showRule(id, hl) {
  const target = resolve(id);
  if (!target) {
    app.innerHTML = `<h1>Règle introuvable</h1><p>La référence « ${esc(id)} » n’existe pas.</p><a class="btn" href="#/regles">Retour aux règles</a>`;
    return;
  }
  const chapter = target.chapter;
  setTitle(target.label);
  if (renderedChapter !== chapter.id) {
    const rules = getRules();
    const idx = rules.chapters.indexOf(chapter);
    const prev = rules.chapters[idx - 1];
    const next = rules.chapters[idx + 1];
    app.innerHTML = `
      ${backToQuiz()}
      ${searchBar()}
      <button class="btn toc-toggle" type="button" id="toc-toggle" aria-expanded="false" aria-controls="toc">☰ Sommaire</button>
      <div class="rules-layout">
        <nav class="card toc" id="toc" aria-label="Sommaire des règles">${tocHtml(chapter)}</nav>
        <article class="rules-text" id="chapter">
          ${renderChapter(chapter)}
          <div class="chap-nav">
            ${prev ? `<a class="btn" href="#/regles/${esc(prev.id)}">← ${esc(chapterLabel(prev))}</a>` : "<span></span>"}
            ${next ? `<a class="btn" href="#/regles/${esc(next.id)}">${esc(chapterLabel(next))} →</a>` : "<span></span>"}
          </div>
          <p class="source-note">${esc(getRules().copyright)} · Texte reproduit depuis la <a href="${esc(getRules().source)}" target="_blank" rel="noopener">version PDF officielle</a> (page ${chapter.page} et suivantes).</p>
        </article>
      </div>`;
    bindSearch();
    const toggle = document.getElementById("toc-toggle");
    toggle.addEventListener("click", () => {
      const toc = document.getElementById("toc");
      toc.classList.toggle("open");
      toggle.setAttribute("aria-expanded", toc.classList.contains("open"));
    });
    renderedChapter = chapter.id;
  }
  const el = id === chapter.id ? null : document.getElementById(`r-${id}`);
  if (el) {
    el.scrollIntoView({ block: "start" });
    el.classList.remove("flash");
    void el.offsetWidth;
    el.classList.add("flash");
    if (hl) highlight(el.classList.contains("sec") ? el.nextElementSibling : el, hl);
  } else {
    window.scrollTo(0, 0);
  }
}

// Surligne les mots recherchés dans l'élément ciblé (et le paragraphe qui suit un titre).
function highlight(root, words) {
  if (!root) return;
  const terms = norm(words).split(/\s+/).filter(Boolean);
  const scope = root.matches("h4") && root.nextElementSibling ? [root, root.nextElementSibling] : [root];
  for (const node of scope) {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    for (const t of texts) {
      const n = norm(t.data);
      if (n.length !== t.data.length) continue; // évite un décalage dû aux caractères normalisés
      const hit = terms.map((w) => n.indexOf(w)).find((i) => i >= 0);
      if (hit === undefined) continue;
      const w = terms.find((x) => n.indexOf(x) === hit);
      const after = t.splitText(hit);
      after.splitText(w.length);
      const mark = document.createElement("mark");
      after.parentNode.replaceChild(mark, after);
      mark.appendChild(after);
    }
  }
}

// ---------- Feuille « voir la règle » ----------

function openSheet(ref) {
  const sheet = document.getElementById("sheet");
  const frag = renderFragment(ref);
  document.getElementById("sheet-title").textContent = frag.title;
  document.getElementById("sheet-body").innerHTML = `${frag.html}
    <div class="btn-row"><a class="btn" href="#/regles/${esc(ref)}">Ouvrir dans les règles</a></div>`;
  sheet.hidden = false;
  sheet.dataset.returnFocus = document.activeElement?.dataset?.ref ?? "";
  sheet.querySelector(".sheet-head [data-close]").focus();
}

function closeSheet() {
  const sheet = document.getElementById("sheet");
  if (sheet.hidden) return;
  sheet.hidden = true;
  const ref = sheet.dataset.returnFocus;
  if (ref) app.querySelector(`[data-ref="${CSS.escape(ref)}"]`)?.focus();
}

document.getElementById("sheet").addEventListener("click", (e) => {
  if (e.target.closest("[data-close]")) closeSheet();
  if (e.target.closest("a[href^='#/']")) closeSheet();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSheet();
});

// ---------- À propos ----------

function viewAbout() {
  setTitle("À propos");
  const rules = getRules();
  app.innerHTML = `
    <h1>À propos de RookieRules</h1>
    <div class="card rules-text">
      <p>RookieRules aide les rookies (et les autres !) à apprendre les règles du roller derby sur piste plate, à la manière d’un entraînement au code de la route. L’application fonctionne hors ligne une fois chargée et enregistre ta progression uniquement dans ton navigateur.</p>
      <h3 class="sec">Droits et crédits</h3>
      <p><strong>Règles :</strong> « ${esc(rules.title)} » (${esc(rules.version)}), traduction française officielle. ${esc(rules.copyright)}. Le texte des règles, du glossaire et du livret de mises en situations ainsi que les schémas sont reproduits depuis le document publié par la WFTDA :
        <a href="${esc(rules.source)}" target="_blank" rel="noopener">${esc(rules.source)}</a>. Version en ligne : <a href="https://rules.wftda.org/" target="_blank" rel="noopener">rules.wftda.org</a>.</p>
      <p><strong>Schéma du Track :</strong> design © 2002 Electra Blu/Amy Sherman, Texas Rollergirls, utilisé dans les règles avec leur permission.</p>
      <p><strong>Traduction :</strong> équipe bénévole de traduction des règles de la WFTDA en français (voir la note sur <a href="#/regles/ecriture-inclusive">l’écriture inclusive</a>).</p>
      <p><strong>Questions :</strong> les questions et explications ont été rédigées pour RookieRules à partir des règles. Elles ne sont pas officielles et peuvent contenir des erreurs : chaque question renvoie à la règle correspondante, qui fait foi.</p>
      <p>RookieRules n’est ni affilié à la WFTDA, ni approuvé par elle. En cas de doute ou de divergence, seule la version officielle des règles s’applique.</p>
      <h3 class="sec">Signaler une erreur</h3>
      <p>Une question te semble fausse ou ambiguë ? Ouvre un ticket sur <a href="https://github.com/Helvor/RookieRules/issues" target="_blank" rel="noopener">GitHub</a> en indiquant son numéro de règle.</p>
    </div>`;
  focusMain();
}

// ---------- Démarrage ----------

async function boot() {
  try {
    await Promise.all([loadRules(), loadQuestions()]);
  } catch (err) {
    app.innerHTML = `<h1>Oups</h1><p>Impossible de charger les données. Vérifie ta connexion puis recharge la page.</p>`;
    console.error(err);
    return;
  }
  window.addEventListener("hashchange", route);
  route();
}

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

boot();
