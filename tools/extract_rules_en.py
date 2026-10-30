#!/usr/bin/env python3
"""Extrait les règles officielles WFTDA en anglais depuis le site rules.wftda.com.

Produit :
  - data/rules.en.json        : règles, glossaire et casebook, au même format que data/rules.json
  - assets/figures/en/*.png   : schémas officiels (version anglaise)

Usage :
  pip install beautifulsoup4
  python3 tools/extract_rules_en.py [chemin/vers/index.html]

Sans argument, la version « une seule page » du site est téléchargée
(https://rules.wftda.com/singlehtml/index.html). Les identifiants de sections
(« 2.2.4 », « C4.3.D », « resume »…) sont les mêmes que ceux de la version
française, pour que chaque question pointe vers la même règle dans les deux langues.
Seuls les termes du glossaire ont des identifiants propres à chaque langue (g-<terme>).
"""
import json
import re
import sys
import unicodedata
import urllib.request
from pathlib import Path

from bs4 import BeautifulSoup, NavigableString, Tag

ROOT = Path(__file__).resolve().parent.parent
BASE_URL = "https://rules.wftda.com/"
PAGE_URL = BASE_URL + "singlehtml/index.html"
OUT_JSON = ROOT / "data" / "rules.en.json"
FIG_DIR = ROOT / "assets" / "figures" / "en"

# Textes alternatifs des schémas (le site n'en fournit pas)
ALT = {
    "track_dimensions.png": "Track diagram: Pivot Line, Jammer Line, inside and outside track boundaries",
    "target_zones.png": "Legal Target Zones (front and back view)",
    "blocking_zones.png": "Legal Blocking Zones (front and back view)",
    "c-gameplay-positions.png": "Starting positions of Blockers and Jammers between the lines",
    "c-gameplay-pack-blocked-out.png": "Scenario C2.3.A: a Red Blocker blocks a White Blocker out of bounds",
    "c-gameplay-front-skates-forward.png": "Scenario C2.3.B: the Red wall skates forward while the White Blockers stay still",
    "c-gameplay-pack-stretch.png": "Scenario C2.3.C: Blocker positions around the turn and Pack definition",
}

HEADING = re.compile(r"^h[1-6]$")


def slug(text):
    t = unicodedata.normalize("NFD", text.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = re.sub(r"[^a-z0-9]+", "-", t).strip("-")
    return t[:60]


def clean(text):
    return re.sub(r"\s+", " ", text.replace("¶", "")).strip()


def md(el):
    """Texte d'un élément, avec le gras converti en **gras**."""
    out = []
    for node in el.children:
        if isinstance(node, NavigableString):
            out.append(str(node))
        elif isinstance(node, Tag):
            if "headerlink" in (node.get("class") or []):
                continue
            inner = md(node)
            if node.name in ("strong", "b") and inner.strip():
                lead = inner[: len(inner) - len(inner.lstrip())]
                trail = inner[len(inner.rstrip()):]
                out.append(f"{lead}**{inner.strip()}**{trail}")
            else:
                out.append(inner)
    return clean("".join(out)).replace("** **", " ").replace("****", "")


def heading_parts(h):
    num_el = h.find("span", class_="section-number")
    num = num_el.get_text().strip().rstrip(".") if num_el else None
    if num_el:
        num_el.extract()
    return num, clean(h.get_text())


class Builder:
    def __init__(self):
        self.chapters = []
        self.part = "rules"
        self.chapter = None
        self.section = None
        self.ids = set()
        self.figures = set()

    def unique(self, ident):
        base, n = ident, 2
        while ident in self.ids:
            ident = f"{base}-{n}"
            n += 1
        self.ids.add(ident)
        return ident

    def new_chapter(self, ident, title, num=None):
        self.chapter = {"id": self.unique(ident), "title": title, "part": self.part, "page": None, "sections": []}
        if num:
            self.chapter["num"] = num
        self.chapters.append(self.chapter)
        self.section = {"id": self.chapter["id"], "title": None, "level": 1, "page": None, "blocks": []}
        self.chapter["sections"].append(self.section)

    def new_section(self, ident, title, num, level):
        self.section = {"id": self.unique(ident), "title": title, "level": level, "page": None, "num": num, "blocks": []}
        self.chapter["sections"].append(self.section)

    def add(self, block):
        if self.section is None:
            return
        if block.get("text") == "" and block["type"] not in ("figure", "table"):
            return
        self.section["blocks"].append(block)

    # --- parcours du HTML -------------------------------------------------
    def walk(self, el):
        for child in el.children:
            if isinstance(child, Tag):
                self.element(child)

    def element(self, el):
        name, cls = el.name, el.get("class") or []
        if name == "section":
            self.open_section(el)
        elif HEADING.match(name) or name in ("span", "hr", "script"):
            return
        elif name == "p" and "rubric" in cls:
            self.add({"type": "h", "id": self.unique(f"{self.section['id']}-{slug(el.get_text())}"), "text": clean(el.get_text())})
        elif name == "p" and "attribution" in cls:
            self.add({"type": "origin", "text": md(el)})
        elif name == "p":
            self.add({"type": "p", "text": md(el)})
        elif name == "blockquote":
            for p in el.find_all("p"):
                kind = "origin" if "attribution" in (p.get("class") or []) else "quote"
                self.add({"type": kind, "text": md(p)})
        elif name == "ul":
            self.bullets(el, "li")
        elif name == "ol":
            for i, li in enumerate(el.find_all("li", recursive=False), start=int(el.get("start", 1))):
                self.add({"type": "ol", "text": f"{i}. {md_li(li)}"})
        elif name == "div" and "scenario" in cls:
            label = clean(el.find("span", class_="label").get_text())
            sid = label.split()[-1]
            self.add({"type": "scenario", "id": self.unique(sid), "text": f"Scenario {sid}"})
            for child in el.children:
                if isinstance(child, Tag) and not (child.name == "span" and "title" in (child.get("class") or [])):
                    self.element(child)
        elif name == "dl" and "glossary" in cls:
            for item in el.children:
                if not isinstance(item, Tag):
                    continue
                if item.name == "dt":
                    term = clean(item.get_text())
                    self.add({"type": "term", "id": self.unique("g-" + slug(term)), "text": term})
                elif item.name == "dd":
                    self.walk(item)
        elif name == "figure":
            self.figure(el)
        elif name == "table":
            self.table(el)
        else:
            self.walk(el)

    def bullets(self, ul, kind):
        for li in ul.find_all("li", recursive=False):
            self.add({"type": kind, "text": md_li(li)})
            for sub in li.find_all("ul", recursive=False):
                self.bullets(sub, "li2")

    def figure(self, el):
        img = el.find("img")
        name = Path(img["src"]).name
        cap = el.find("figcaption")
        caption = clean(cap.get_text()) if cap else None
        self.figures.add(name)
        self.add({"type": "figure", "src": f"assets/figures/en/{name}", "alt": ALT.get(name, caption or name), "caption": caption})

    def table(self, el):
        head = [clean(th.get_text()) for th in el.select("thead th")]
        rows = [[clean(td.get_text()) for td in tr.find_all("td")] for tr in el.select("tbody tr")]
        self.add({"type": "table", "head": head, "rows": rows})

    def open_section(self, el):
        sid = el.get("id")
        h = el.find(HEADING, recursive=False)
        if sid == "the-rules-of-flat-track-roller-derby":
            return self.walk(el)
        if h is None:
            return self.walk(el)
        num, title = heading_parts(h)
        if sid == "summary":
            self.part = "rules"
            self.new_chapter("resume", title)
        elif sid == "appendices":
            self.part = "appendix"
            self.new_chapter("appendices", title)
        elif sid == "glossary":
            self.part = "glossary"
            self.new_chapter("glossaire", title)
        elif sid == "casebook":
            self.part = "casebook"
            self.section = None
        elif num and "." not in num:
            prefix = "C" if self.part == "casebook" else ""
            self.new_chapter(prefix + num, title, num)
        elif num:
            prefix = "C" if self.part == "casebook" else ""
            self.new_section(prefix + num, title, num, num.count(".") + 1)
        self.walk(el)


def md_li(li):
    """Texte d'un élément de liste, sans ses sous-listes."""
    parts = [md(p) for p in li.find_all("p", recursive=False)]
    if not parts:
        copy = BeautifulSoup(str(li), "html.parser").li
        for sub in copy.find_all(["ul", "ol"]):
            sub.extract()
        parts = [md(copy)]
    return " ".join(p for p in parts if p)


def main():
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "tools" / ".cache" / "wftda-rules-en.html"
    if not src.exists():
        src.parent.mkdir(parents=True, exist_ok=True)
        print(f"Téléchargement de {PAGE_URL}…")
        urllib.request.urlretrieve(PAGE_URL, src)
    soup = BeautifulSoup(src.read_text(encoding="utf-8"), "html.parser")
    main_el = soup.find(attrs={"role": "main"})
    bld = Builder()
    bld.walk(main_el)

    FIG_DIR.mkdir(parents=True, exist_ok=True)
    for name in sorted(bld.figures):
        dest = FIG_DIR / name
        if not dest.exists():
            print(f"Téléchargement du schéma {name}…")
            urllib.request.urlretrieve(f"{BASE_URL}_images/{name}", dest)

    data = {
        "title": "The Rules of Flat Track Roller Derby",
        "version": "January 1, 2025",
        "source": BASE_URL,
        "pdf": "https://static.wftda.com/rules/wftda-rules.pdf",
        "copyright": "Rules and diagrams © 2025 Women’s Flat Track Derby Association (WFTDA)",
        "chapters": bld.chapters,
    }
    OUT_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    n_sections = sum(len(c["sections"]) for c in bld.chapters)
    n_blocks = sum(len(s["blocks"]) for c in bld.chapters for s in c["sections"])
    print(f"{len(bld.chapters)} chapitres, {n_sections} sections, {n_blocks} blocs -> {OUT_JSON.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
