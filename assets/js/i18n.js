// Langue de l'interface (français ou anglais) et textes traduits.
// Les règles et les questions de chaque langue sont dans des fichiers séparés :
// data/rules.json + data/questions.json (fr), data/rules.en.json + data/questions.en.json (en).

import { plural } from "./util.js";

const KEY = "rookierules:lang";

export const LANGS = ["fr", "en"];

function detect() {
  const param = new URLSearchParams(location.search).get("lang");
  try {
    if (LANGS.includes(param)) {
      localStorage.setItem(KEY, param);
      return param;
    }
    const saved = localStorage.getItem(KEY);
    if (LANGS.includes(saved)) return saved;
  } catch {
    // stockage indisponible : on se fie à l'adresse ou à la langue du navigateur
    if (LANGS.includes(param)) return param;
  }
  const nav = (navigator.languages?.[0] || navigator.language || "fr").toLowerCase();
  return nav.startsWith("fr") ? "fr" : "en";
}

let lang = detect();

export function getLang() {
  return lang;
}

export function setLang(next) {
  if (!LANGS.includes(next)) return;
  lang = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // navigation privée : le choix ne sera pas conservé
  }
}

// Suffixe des fichiers de données pour la langue courante (« » ou « .en »).
export function dataFile(name) {
  return `data/${name}${lang === "fr" ? "" : `.${lang}`}.json`;
}

const pluralEn = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const STRINGS = {
  fr: {
    "meta.description": "Révise les règles du roller derby (WFTDA, version française) avec des séries de questions, un examen blanc et les règles complètes consultables hors ligne.",
    "skip": "Aller au contenu",
    "brand.label": "RookieRules, accueil",
    "nav.label": "Navigation principale",
    "nav.home": "Accueil",
    "nav.train": "Entraînement",
    "nav.exam": "Examen",
    "nav.rules": "Règles",
    "nav.review": "Révisions",
    "lang.switch": "English",
    "lang.switchLabel": "Switch to English",
    "loading": "Chargement…",
    "footer": `<p>Règles : « Les règles du Roller Derby sur piste plate » (janvier 2025), traduction française ©2025 Women’s Flat Track Derby Association (WFTDA).
      <a href="https://static.wftda.com/rules/wftda-rules-french.pdf" rel="noopener" target="_blank">Source officielle</a>.</p>
    <p>Outil d’apprentissage non officiel, non affilié à la WFTDA. En cas de doute, seule la version officielle fait foi. <a href="#/a-propos">À propos et crédits</a></p>`,
    "sheet.title": "Règle",
    "close": "Fermer",

    "home.title": "Révise les règles du roller derby",
    "home.lead": "Comme pour le code de la route : des séries de questions tirées au hasard, un examen blanc chronométré, et les règles officielles WFTDA en français, consultables à tout moment.",
    "home.quick": "Série rapide",
    "home.quickText": "20 questions au hasard sur tous les thèmes, avec la correction et la règle après chaque réponse.",
    "home.exam": "Examen blanc",
    "home.examText": ({ size, seconds, pass }) => `${size} questions, ${seconds} secondes par question, correction à la fin. Réussite à ${pass}/${size}.`,
    "home.themes": "Entraînement par thème",
    "home.themesText": "Choisis tes thèmes et le nombre de questions.",
    "home.mistakes": "Mes erreurs",
    "home.mistakesCount": ({ n }) => `${plural(n, "question à revoir", "questions à revoir")}.`,
    "home.noMistakes": "Aucune erreur à revoir pour l’instant.",
    "home.search": "Chercher dans les règles",
    "home.searchPlaceholder": "Ex. : Star Pass, Lead, 4.2.2, C3.3.A…",
    "home.progress": "Ta progression",
    "home.seen": "questions déjà vues",
    "home.rate": "de bonnes réponses",
    "home.best": "meilleur examen blanc",
    "home.themeList": "Thèmes",
    "search.label": "Rechercher dans les règles",
    "search.submit": "Chercher",
    "themes.count": ({ n }) => `${n} questions`,

    "train.title": "Entraînement",
    "train.lead": "Correction immédiate, explication et lien vers la règle après chaque question.",
    "train.themes": "Thèmes",
    "train.all": "Tout cocher",
    "train.none": "Tout décocher",
    "train.count": "Nombre de questions",
    "train.everything": "Toutes",
    "train.available": ({ n }) => `${n} questions disponibles avec ces thèmes.`,
    "train.start": "Commencer",

    "exam.title": "Examen blanc",
    "exam.rule1": ({ size }) => `${size} questions tirées au hasard parmi tous les thèmes.`,
    "exam.rule2": ({ seconds }) => `${seconds} secondes par question : sans réponse validée à temps, la question compte comme fausse.`,
    "exam.rule3": "Pas de correction pendant l’examen : tu vois tout à la fin, avec les explications et les règles.",
    "exam.rule4": ({ size, pass }) => `Examen réussi à partir de <strong>${pass}/${size}</strong>.`,
    "exam.start": "Démarrer l’examen",

    "quiz.title": "Quiz",
    "quiz.none": "Aucune question",
    "quiz.noneText": "Rien à réviser avec ces critères.",
    "quiz.backHome": "Retour à l’accueil",
    "quiz.count": ({ i, total }) => `Question ${i}/${total}`,
    "quiz.image": "Schéma de la question",
    "quiz.quit": "Arrêter",
    "quiz.validate": "Valider",
    "quiz.next": "Question suivante",
    "quiz.results": "Voir le résultat",
    "quiz.keys": "Clavier : touches 1 à 4 (ou A à D) pour répondre, Entrée pour continuer.",
    "quiz.quitConfirm": "Arrêter la série ? Les réponses déjà données sont conservées dans ta progression.",
    "quiz.right": "Bonne réponse !",
    "quiz.timeUp": "Temps écoulé",
    "quiz.wrong": "Mauvaise réponse",
    "quiz.expected": "Réponse attendue :",
    "quiz.timer": ({ left }) => `⏱ ${left} s`,

    "results.title": "Résultats",
    "results.examPassed": "Examen réussi 🎉",
    "results.examFailed": "Examen non réussi",
    "results.great": "Excellent !",
    "results.ok": "Pas mal, continue !",
    "results.bad": "À retravailler",
    "results.needed": ({ pass, size }) => `Il fallait ${pass}/${size} pour réussir.`,
    "results.rate": ({ pct }) => `${pct} % de bonnes réponses.`,
    "results.newExam": "Nouvel examen",
    "results.newSeries": "Nouvelle série",
    "results.reviewMistakes": "Revoir mes erreurs",
    "results.home": "Accueil",
    "results.correction": "Correction",
    "results.noAnswer": "Pas de réponse (temps écoulé)",
    "results.yourAnswer": "Ta réponse :",

    "review.title": "Mes erreurs",
    "review.pageTitle": "Révisions",
    "review.lead": "Les questions auxquelles tu as mal répondu la dernière fois. Une question disparaît de cette liste dès que tu y réponds correctement.",
    "review.start": ({ n }) => `Revoir ${plural(n, "question", "questions")}`,
    "review.todo": "À revoir",
    "review.empty": `Aucune erreur à revoir. Lance une <a href="#/quiz?mode=train&n=20">série rapide</a> !`,
    "review.progress": "Progression",
    "review.reset": "Effacer ma progression",
    "review.local": "Ta progression est enregistrée uniquement dans ce navigateur.",
    "review.resetConfirm": "Effacer toute ta progression et tes erreurs enregistrées ?",

    "rules.title": "Règles",
    "rules.heading": "Les règles",
    "rules.lead": ({ title, version }) => `${title} — version ${version}, traduction française officielle de la WFTDA, avec le glossaire et le livret de mises en situations.`,
    "rules.backToQuiz": "↩ Revenir au quiz",
    "rules.searchPlaceholder": "Mot-clé ou numéro (ex. : apex, 2.2.4, C4.3.D)",
    "rules.searchTitle": "Recherche",
    "rules.goTo": ({ label }) => `Aller à ${label}`,
    "rules.hits": ({ n, q }) => `${plural(n, "résultat", "résultats")}${n >= 60 ? " (les 60 premiers)" : ""} pour « ${q} »`,
    "rules.noHits": ({ q }) => `Aucun résultat pour « ${q} ».`,
    "rules.notFound": "Règle introuvable",
    "rules.notFoundText": ({ id }) => `La référence « ${id} » n’existe pas.`,
    "rules.back": "Retour aux règles",
    "rules.toc": "☰ Sommaire",
    "rules.tocLabel": "Sommaire des règles",
    "rules.source": ({ copyright, url, page }) => `${copyright} · Texte reproduit depuis la <a href="${url}" target="_blank" rel="noopener">version PDF officielle</a>${page ? ` (page ${page} et suivantes)` : ""}.`,
    "rules.openFull": "Ouvrir dans les règles",
    "rules.missing": "Règle introuvable.",
    "rules.seeSubsections": "Voir les sous-sections.",
    "part.intro": "Introduction",
    "part.rules": "Règles",
    "part.appendix": "Appendices",
    "part.glossary": "Glossaire",
    "part.casebook": "Livret de mises en situations",
    "ref.glossary": ({ term }) => `Glossaire : ${term}`,
    "ref.glossaryWhere": ({ term }) => `Glossaire · ${term}`,
    "ref.casebook": ({ label }) => `Livret, ${label}`,
    "ref.casebookWhere": ({ label }) => `${label} (livret)`,
    "ref.casebookChapter": ({ num, title }) => `Livret · ${num}. ${title}`,
    "ref.section": ({ label }) => `Section ${label}`,

    "about.title": "À propos",
    "about.heading": "À propos de RookieRules",
    "about.body": ({ title, version, copyright, source }) => `
      <p>RookieRules aide les rookies (et les autres !) à apprendre les règles du roller derby sur piste plate, à la manière d’un entraînement au code de la route. L’application fonctionne hors ligne une fois chargée et enregistre ta progression uniquement dans ton navigateur.</p>
      <h3 class="sec">Droits et crédits</h3>
      <p><strong>Règles :</strong> « ${title} » (${version}), traduction française officielle. ${copyright}. Le texte des règles, du glossaire et du livret de mises en situations ainsi que les schémas sont reproduits depuis le document publié par la WFTDA :
        <a href="${source}" target="_blank" rel="noopener">${source}</a>. Version en ligne : <a href="https://rules.wftda.com/" target="_blank" rel="noopener">rules.wftda.com</a>.</p>
      <p><strong>Schéma du Track :</strong> design © 2002 Electra Blu/Amy Sherman, Texas Rollergirls, utilisé dans les règles avec leur permission.</p>
      <p><strong>Traduction :</strong> équipe bénévole de traduction des règles de la WFTDA en français (voir la note sur <a href="#/regles/ecriture-inclusive">l’écriture inclusive</a>).</p>
      <p><strong>Questions :</strong> les questions et explications ont été rédigées pour RookieRules à partir des règles. Elles ne sont pas officielles et peuvent contenir des erreurs : chaque question renvoie à la règle correspondante, qui fait foi.</p>
      <p>RookieRules n’est ni affilié à la WFTDA, ni approuvé par elle. En cas de doute ou de divergence, seule la version officielle des règles s’applique.</p>
      <h3 class="sec">Langue</h3>
      <p>L’application existe aussi en anglais, avec le texte officiel des règles en anglais : bouton « English » en haut de la page.</p>
      <h3 class="sec">Signaler une erreur</h3>
      <p>Une question te semble fausse ou ambiguë ? Ouvre un ticket sur <a href="https://github.com/Helvor/RookieRules/issues" target="_blank" rel="noopener">GitHub</a> en indiquant son numéro de règle.</p>`,

    "error.title": "Oups",
    "error.text": "Impossible de charger les données. Vérifie ta connexion puis recharge la page.",
  },

  en: {
    "meta.description": "Study the roller derby rules (WFTDA) with random question series, a timed mock exam and the full rules, searchable and available offline.",
    "skip": "Skip to content",
    "brand.label": "RookieRules, home",
    "nav.label": "Main navigation",
    "nav.home": "Home",
    "nav.train": "Practice",
    "nav.exam": "Exam",
    "nav.rules": "Rules",
    "nav.review": "Review",
    "lang.switch": "Français",
    "lang.switchLabel": "Passer en français",
    "loading": "Loading…",
    "footer": `<p>Rules: “The Rules of Flat Track Roller Derby” (January 1, 2025). Rules and diagrams ©2025 Women’s Flat Track Derby Association (WFTDA).
      <a href="https://rules.wftda.com/" rel="noopener" target="_blank">Official source</a>.</p>
    <p>Unofficial study tool, not affiliated with the WFTDA. When in doubt, only the official rules apply. <a href="#/a-propos">About and credits</a></p>`,
    "sheet.title": "Rule",
    "close": "Close",

    "home.title": "Study the roller derby rules",
    "home.lead": "Like a driving theory test: random question series, a timed mock exam, and the official WFTDA rules, available at any time.",
    "home.quick": "Quick series",
    "home.quickText": "20 random questions on every topic, with the answer and the rule after each question.",
    "home.exam": "Mock exam",
    "home.examText": ({ size, seconds, pass }) => `${size} questions, ${seconds} seconds per question, answers at the end. Pass mark ${pass}/${size}.`,
    "home.themes": "Practice by topic",
    "home.themesText": "Pick your topics and the number of questions.",
    "home.mistakes": "My mistakes",
    "home.mistakesCount": ({ n }) => `${pluralEn(n, "question to review", "questions to review")}.`,
    "home.noMistakes": "No mistakes to review yet.",
    "home.search": "Search the rules",
    "home.searchPlaceholder": "E.g. Star Pass, Lead, 4.2.2, C3.3.A…",
    "home.progress": "Your progress",
    "home.seen": "questions seen",
    "home.rate": "correct answers",
    "home.best": "best mock exam",
    "home.themeList": "Topics",
    "search.label": "Search the rules",
    "search.submit": "Search",
    "themes.count": ({ n }) => pluralEn(n, "question", "questions"),

    "train.title": "Practice",
    "train.lead": "Instant feedback, explanation and a link to the rule after each question.",
    "train.themes": "Topics",
    "train.all": "Select all",
    "train.none": "Clear all",
    "train.count": "Number of questions",
    "train.everything": "All",
    "train.available": ({ n }) => `${pluralEn(n, "question", "questions")} available with these topics.`,
    "train.start": "Start",

    "exam.title": "Mock exam",
    "exam.rule1": ({ size }) => `${size} random questions across all topics.`,
    "exam.rule2": ({ seconds }) => `${seconds} seconds per question: if no answer is confirmed in time, the question counts as wrong.`,
    "exam.rule3": "No feedback during the exam: you see everything at the end, with explanations and rules.",
    "exam.rule4": ({ size, pass }) => `Pass mark: <strong>${pass}/${size}</strong>.`,
    "exam.start": "Start the exam",

    "quiz.title": "Quiz",
    "quiz.none": "No questions",
    "quiz.noneText": "Nothing to review with these settings.",
    "quiz.backHome": "Back to home",
    "quiz.count": ({ i, total }) => `Question ${i}/${total}`,
    "quiz.image": "Diagram for the question",
    "quiz.quit": "Stop",
    "quiz.validate": "Confirm",
    "quiz.next": "Next question",
    "quiz.results": "See results",
    "quiz.keys": "Keyboard: keys 1 to 4 (or A to D) to answer, Enter to continue.",
    "quiz.quitConfirm": "Stop this series? Answers already given are kept in your progress.",
    "quiz.right": "Correct!",
    "quiz.timeUp": "Time’s up",
    "quiz.wrong": "Wrong answer",
    "quiz.expected": "Correct answer:",
    "quiz.timer": ({ left }) => `⏱ ${left} s`,

    "results.title": "Results",
    "results.examPassed": "Exam passed 🎉",
    "results.examFailed": "Exam not passed",
    "results.great": "Excellent!",
    "results.ok": "Not bad, keep going!",
    "results.bad": "Needs more work",
    "results.needed": ({ pass, size }) => `You needed ${pass}/${size} to pass.`,
    "results.rate": ({ pct }) => `${pct}% correct answers.`,
    "results.newExam": "New exam",
    "results.newSeries": "New series",
    "results.reviewMistakes": "Review my mistakes",
    "results.home": "Home",
    "results.correction": "Answers",
    "results.noAnswer": "No answer (time’s up)",
    "results.yourAnswer": "Your answer:",

    "review.title": "My mistakes",
    "review.pageTitle": "Review",
    "review.lead": "Questions you got wrong last time. A question leaves this list as soon as you answer it correctly.",
    "review.start": ({ n }) => `Review ${pluralEn(n, "question", "questions")}`,
    "review.todo": "To review",
    "review.empty": `No mistakes to review. Start a <a href="#/quiz?mode=train&n=20">quick series</a>!`,
    "review.progress": "Progress",
    "review.reset": "Clear my progress",
    "review.local": "Your progress is only stored in this browser.",
    "review.resetConfirm": "Clear all your progress and saved mistakes?",

    "rules.title": "Rules",
    "rules.heading": "The rules",
    "rules.lead": ({ title, version }) => `${title}, ${version} edition, the official WFTDA text, with the glossary and the casebook.`,
    "rules.backToQuiz": "↩ Back to the quiz",
    "rules.searchPlaceholder": "Keyword or number (e.g. apex, 2.2.4, C4.3.D)",
    "rules.searchTitle": "Search",
    "rules.goTo": ({ label }) => `Go to ${label}`,
    "rules.hits": ({ n, q }) => `${pluralEn(n, "result", "results")}${n >= 60 ? " (first 60)" : ""} for “${q}”`,
    "rules.noHits": ({ q }) => `No results for “${q}”.`,
    "rules.notFound": "Rule not found",
    "rules.notFoundText": ({ id }) => `The reference “${id}” does not exist.`,
    "rules.back": "Back to the rules",
    "rules.toc": "☰ Contents",
    "rules.tocLabel": "Table of contents",
    "rules.source": ({ copyright, url }) => `${copyright} · Text reproduced from the <a href="${url}" target="_blank" rel="noopener">official WFTDA rules website</a>.`,
    "rules.openFull": "Open in the rules",
    "rules.missing": "Rule not found.",
    "rules.seeSubsections": "See the subsections.",
    "part.intro": "Introduction",
    "part.rules": "Rules",
    "part.appendix": "Appendices",
    "part.glossary": "Glossary",
    "part.casebook": "Casebook",
    "ref.glossary": ({ term }) => `Glossary: ${term}`,
    "ref.glossaryWhere": ({ term }) => `Glossary · ${term}`,
    "ref.casebook": ({ label }) => `Casebook, ${label}`,
    "ref.casebookWhere": ({ label }) => `${label} (casebook)`,
    "ref.casebookChapter": ({ num, title }) => `Casebook · ${num}. ${title}`,
    "ref.section": ({ label }) => `Section ${label}`,

    "about.title": "About",
    "about.heading": "About RookieRules",
    "about.body": ({ title, version, copyright, source }) => `
      <p>RookieRules helps rookies (and everyone else!) learn the rules of flat track roller derby, the way you would study for a driving theory test. The app works offline once loaded and only stores your progress in your browser.</p>
      <h3 class="sec">Rights and credits</h3>
      <p><strong>Rules:</strong> “${title}” (${version}). ${copyright}. The text of the rules, glossary and casebook, and the diagrams, are reproduced from the official WFTDA rules website:
        <a href="${source}" target="_blank" rel="noopener">${source}</a>. PDF version: <a href="https://static.wftda.com/rules/wftda-rules.pdf" target="_blank" rel="noopener">wftda-rules.pdf</a>.</p>
      <p><strong>Track diagram:</strong> Track Layout and Design © 2002 Electra Blu/Amy Sherman, Texas Rollergirls, used in the rules with permission.</p>
      <p><strong>Questions:</strong> the questions and explanations were written for RookieRules based on the rules. They are not official and may contain mistakes: each question links to the relevant rule, which is authoritative.</p>
      <p>RookieRules is not affiliated with or endorsed by the WFTDA. In case of doubt or discrepancy, only the official rules apply.</p>
      <h3 class="sec">Language</h3>
      <p>The app is also available in French, with the official French translation of the rules: use the “Français” button at the top of the page.</p>
      <h3 class="sec">Report a mistake</h3>
      <p>Does a question look wrong or ambiguous? Open an issue on <a href="https://github.com/Helvor/RookieRules/issues" target="_blank" rel="noopener">GitHub</a> with its rule number.</p>`,

    "error.title": "Oops",
    "error.text": "Could not load the data. Check your connection, then reload the page.",
  },
};

// Texte traduit ; les entrées qui sont des fonctions reçoivent les paramètres.
export function t(key, params = {}) {
  const entry = STRINGS[lang][key] ?? STRINGS.fr[key];
  if (entry === undefined) return key;
  return typeof entry === "function" ? entry(params) : entry;
}

// Traduit les éléments statiques de index.html (attributs data-i18n*).
export function translatePage(root = document) {
  document.documentElement.lang = lang;
  for (const el of root.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll("[data-i18n-html]")) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of root.querySelectorAll("[data-i18n-attr]")) {
    for (const pair of el.dataset.i18nAttr.split(";")) {
      const [attr, key] = pair.split(":");
      el.setAttribute(attr, t(key));
    }
  }
}
