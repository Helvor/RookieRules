# RookieRules

Application web pour réviser les règles du roller derby (WFTDA, version française de janvier 2025), sur le principe du « code de la route » : séries de questions aléatoires, examen blanc chronométré et texte intégral des règles consultable et recherchable.

## Fonctionnalités

- **Entraînement** : séries aléatoires (10, 20 ou 40 questions), par thème ou toutes thématiques confondues. Les questions jamais vues sont tirées en priorité et l'ordre des réponses est mélangé à chaque fois.
- **Examen blanc** : 20 questions, 30 secondes par question, réussite à 17/20.
- **Révisions** : reprise des questions ratées (progression enregistrée uniquement dans le navigateur).
- **Règles** : texte intégral (règles, appendices, glossaire, livret de mises en situation) avec les schémas du PDF, recherche par mot-clé ou par numéro (`4.1.2`, `C4.3.D`…). Chaque question renvoie vers la règle correspondante.
- **Écriture** : textes en écriture inclusive (point médian, comme la traduction officielle), avec une option « tout au féminin » plus facile à lire (dyslexie, lecteurs d'écran), dans la page Réglages.
- **Hors ligne** : installable sur téléphone (PWA), fonctionne sans connexion après la première visite.

Site statique sans étape de compilation : HTML, CSS et JavaScript (modules ES).

## Lancer en local

```sh
python3 -m http.server 8000
```

puis ouvrir http://localhost:8000.

## Mise en ligne (GitHub Pages)

Le workflow `.github/workflows/pages.yml` valide les données puis publie le site à chaque push sur `main`.
À faire une seule fois : **Settings → Pages → Build and deployment → Source : GitHub Actions**.

## Ajouter ou modifier des questions

Les questions sont dans `data/questions.json` :

```json
{
  "id": "p22",
  "theme": "pack",
  "ref": "2.2.4",
  "q": "Énoncé de la question",
  "a": "Bonne réponse",
  "w": ["Mauvaise réponse 1", "Mauvaise réponse 2", "Mauvaise réponse 3"],
  "why": "Explication affichée après la réponse"
}
```

- `ref` est l'identifiant de la règle : numéro de section (`2.2.4`), mise en situation (`C4.3.D`), section du livret (`C2.2`) ou terme du glossaire (`g-hors-jeu`).
- `img` (facultatif) affiche un schéma de `assets/figures/` sous la question.

Vérifier ensuite avec :

```sh
python3 tools/validate.py
```

Le script contrôle les identifiants, les références aux règles, les réponses, les images et la liste de mise en cache du service worker (`sw.js`). Le workflow refuse de publier si la validation échoue.

## Écriture inclusive et option « tout au féminin »

Questions, explications et textes de l'interface s'écrivent en écriture inclusive avec le point médian, comme les règles officielles : `le·la Jammeur·se`, `pénalisé·e`, `ielle`. Pour les mots sans marque, écrire aussi la forme inclusive des déterminants (`son·sa Pivot`, `un·e Capitaine`).

L'option « tout au féminin » (page Réglages, `assets/js/prefs.js`) convertit tous ces textes au chargement avec `assets/js/ecriture.js` : `la Jammeuse`, `pénalisée`, `elle`. Un texte d'interface genré passe par `prefs.w("…")`. Les formes irrégulières sont listées dans `PAIRS` et `PHRASES`. Pour vérifier la conversion (plus aucun point médian, réponses toujours distinctes) :

```sh
node tools/check_ecriture.mjs          # --list affiche chaque forme et sa conversion
```

## Mettre à jour les règles

Quand la WFTDA publie une nouvelle version du PDF :

```sh
pip install pymupdf pillow
python3 tools/extract_rules.py            # télécharge le PDF officiel
python3 tools/extract_rules.py regles.pdf # ou utilise un fichier local
python3 tools/validate.py
```

Le script régénère `data/rules.json` et les schémas de `assets/figures/`. Les zones de découpe des schémas (`FIGURES`) sont définies par page dans le script et devront être vérifiées si la mise en page change. Pensez aussi à incrémenter `VERSION` dans `sw.js` pour que les appareils récupèrent le nouveau contenu.

## Droits d'auteur

Le texte des règles et les schémas sont © 2025 Women's Flat Track Derby Association (WFTDA), traduction réalisée par l'équipe bénévole de traduction de la WFTDA. Schéma de la piste © 2002 Electra Blu / Amy Sherman, Texas Rollergirls. Source officielle : https://static.wftda.com/rules/wftda-rules-french.pdf

RookieRules est un outil d'entraînement non officiel, sans lien avec la WFTDA. Les questions ne sont pas officielles : en cas de doute, le texte des règles fait foi.
