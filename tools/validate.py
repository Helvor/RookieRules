#!/usr/bin/env python3
"""Vérifie la cohérence de data/questions.json avec data/rules.json.

- identifiants de questions uniques, thèmes connus ;
- chaque question a une bonne réponse et trois mauvaises réponses distinctes ;
- chaque référence (« ref ») pointe vers une section, un scénario ou un terme
  du glossaire existant dans rules.json ;
- les images référencées existent ;
- tous les fichiers de assets/ et data/ sont mis en cache par sw.js.
Code de sortie non nul en cas d'erreur (utilisé par la GitHub Action).
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main():
    rules = json.loads((ROOT / "data" / "rules.json").read_text(encoding="utf-8"))
    bank = json.loads((ROOT / "data" / "questions.json").read_text(encoding="utf-8"))
    anchors = set()
    for chapter in rules["chapters"]:
        anchors.add(chapter["id"])
        for section in chapter["sections"]:
            anchors.add(section["id"])
            for block in section["blocks"]:
                if block.get("id"):
                    anchors.add(block["id"])
                if block.get("src") and not (ROOT / block["src"]).exists():
                    print(f"figure manquante : {block['src']}")
    themes = {t["id"] for t in bank["themes"]}
    errors, seen = [], set()
    for q in bank["questions"]:
        qid = q.get("id", "?")
        if qid in seen:
            errors.append(f"{qid} : identifiant en double")
        seen.add(qid)
        if q.get("theme") not in themes:
            errors.append(f"{qid} : thème inconnu {q.get('theme')!r}")
        if q.get("ref") not in anchors:
            errors.append(f"{qid} : référence introuvable {q.get('ref')!r}")
        for key in ("q", "a", "why"):
            if not q.get(key, "").strip():
                errors.append(f"{qid} : champ {key!r} vide")
        wrong = q.get("w", [])
        if len(wrong) != 3 or len(set(wrong)) != 3 or q.get("a") in wrong:
            errors.append(f"{qid} : il faut trois mauvaises réponses distinctes de la bonne")
        if q.get("img") and not (ROOT / q["img"]).exists():
            errors.append(f"{qid} : image introuvable {q['img']}")
    sw = (ROOT / "sw.js").read_text(encoding="utf-8")
    for path in sorted(ROOT.glob("assets/**/*")) + sorted(ROOT.glob("data/*.json")):
        rel = path.relative_to(ROOT).as_posix()
        if path.is_file() and f'"{rel}"' not in sw:
            errors.append(f"sw.js : {rel} absent de la liste PRECACHE (pas disponible hors ligne)")
    per_theme = {t: sum(1 for q in bank["questions"] if q["theme"] == t) for t in themes}
    print(f"{len(bank['questions'])} questions : " + ", ".join(f"{t} {n}" for t, n in sorted(per_theme.items())))
    if errors:
        print("\n".join(errors))
        sys.exit(1)
    print("OK")


if __name__ == "__main__":
    main()
