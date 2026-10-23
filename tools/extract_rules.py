#!/usr/bin/env python3
"""Extrait le texte et les schémas du PDF officiel des règles WFTDA (version française).

Produit :
  - data/rules.json        : règles, glossaire et livret de mises en situation structurés
  - assets/figures/*.png   : schémas recadrés depuis le PDF

Usage :
  pip install pymupdf pillow
  python3 tools/extract_rules.py [chemin/vers/wftda-rules-french.pdf]

Sans argument, le PDF est téléchargé depuis le site de la WFTDA.
Le script est à relancer à chaque nouvelle version des règles ; les questions
(data/questions.json) référencent les identifiants de sections produits ici,
et tools/validate.py vérifie que ces références existent toujours.
"""
import json
import re
import sys
import unicodedata
import urllib.request
from pathlib import Path

import pymupdf
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parent.parent
PDF_URL = "https://static.wftda.com/rules/wftda-rules-french.pdf"
OUT_JSON = ROOT / "data" / "rules.json"
FIG_DIR = ROOT / "assets" / "figures"

# Schémas : page -> (fichier, recadrage en fractions de page x0, y0, x1, y1, texte alternatif)
FIGURES = {
    11: ("fig-2-1-track", (.03, .20, .80, .67), "Schéma du Track : ligne de Pivot, ligne de Jammeur·se, limites intérieure et extérieure"),
    20: ("fig-2-2-zones-cibles", (.22, .33, .80, .66), "Zones cibles légales (vue de face et de dos)"),
    21: ("fig-2-3-zones-blocage", (.22, .17, .72, .49), "Zones de blocage légales (vue de face et de dos)"),
    27: ("fig-4-1-1-zones-cibles", (.20, .56, .68, .895), "Zones cibles légales (vue de face et de dos)"),
    29: ("fig-4-1-2-zones-blocage", (.24, .07, .68, .38), "Zones de blocage légales (vue de face et de dos)"),
    55: ("c2-2-positions", (.0, .645, .55, .85), "Positions de départ des Bloqueur·ses et Jammeur·ses entre les lignes"),
    67: ("c2-3-a", (.02, .55, .43, .73), "Scénario C2.3.A : un·e Bloqueur·se Rouge bloque un·e Bloqueur·se Blanc·he hors des limites"),
    68: ("c2-3-b", (.02, .19, .39, .365), "Scénario C2.3.B : le mur Rouge avance, les Bloqueur·ses Blanc·hes restent immobiles"),
    69: ("c2-3-c", (.01, .042, .62, .318), "Scénario C2.3.C : position des Bloqueur·ses dans le virage et définition du Pack"),
}
# Pixels à rogner en haut après recadrage (titre capturé avec le schéma)
FIG_TRIM_TOP = {"c2-3-c": 60}

PARA_GAP = 26  # écart vertical (pt) au-delà duquel une nouvelle ligne commence un paragraphe
TERMINAL = tuple(".:;!?»)")


def slug(text):
    t = unicodedata.normalize("NFD", text.lower().replace("œ", "oe").replace("æ", "ae"))
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = re.sub(r"[^a-z0-9]+", "-", t).strip("-")
    return t[:60]


def crop_figures(pdf_path):
    FIG_DIR.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(pdf_path)
    for page_no, (name, (x0, y0, x1, y1), _alt) in FIGURES.items():
        page = doc[page_no - 1]
        pix = page.get_pixmap(dpi=200)
        im = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        w, h = im.size
        c = im.crop((int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h)))
        diff = ImageChops.difference(c, Image.new("RGB", c.size, (255, 255, 255)))
        bb = diff.convert("L").point(lambda v: 255 if v > 12 else 0).getbbox()
        if bb:
            m = 12
            c = c.crop((max(bb[0] - m, 0), max(bb[1] - m, 0), min(bb[2] + m, c.width), min(bb[3] + m, c.height)))
        trim = FIG_TRIM_TOP.get(name)
        if trim:
            c = c.crop((0, trim, c.width, c.height))
        c.save(FIG_DIR / f"{name}.png", optimize=True)


def page_lines(page):
    """Lignes de texte horizontales de la page, hors pied de page, avec styles."""
    out = []
    d = page.get_text("dict")
    for b in d["blocks"]:
        if b["type"] != 0:
            continue
        for l in b["lines"]:
            if abs(l["dir"][1]) > 0.01:  # étiquettes tournées (schéma du Track)
                continue
            spans = [s for s in l["spans"] if s["text"]]
            if not spans or spans[0]["size"] < 9:  # pied de page
                continue
            text = "".join(s["text"] for s in spans)
            if not text.strip():
                continue
            segs = [(s["text"], bool(s["flags"] & 16)) for s in spans]
            out.append({
                "x": l["bbox"][0], "y": l["bbox"][1], "size": round(spans[0]["size"], 1),
                "segs": segs, "text": text.strip(),
                "bold": all(b for t, b in segs if t.strip()),
            })
    out.sort(key=lambda l: (round(l["y"]), l["x"]))
    return out


def figure_anchor_y(page):
    imgs = [b for b in page.get_text("dict")["blocks"] if b["type"] == 1]
    imgs = [b for b in imgs if (b["bbox"][2] - b["bbox"][0]) > 80]
    if not imgs:
        return None
    biggest = max(imgs, key=lambda b: (b["bbox"][2] - b["bbox"][0]) * (b["bbox"][3] - b["bbox"][1]))
    return biggest["bbox"][1]


def segs_to_md(segs):
    """Concatène des segments (texte, gras) en texte avec **gras**."""
    merged = []
    for t, b in segs:
        if merged and merged[-1][1] == b:
            merged[-1][0] += t
        else:
            merged.append([t, b])
    out = ""
    for t, b in merged:
        if b and t.strip():
            lead = t[: len(t) - len(t.lstrip())]
            trail = t[len(t.rstrip()):]
            out += f"{lead}**{t.strip()}**{trail}"
        else:
            out += t
    out = re.sub(r"\s+", " ", out).strip()
    out = out.replace("** **", " ")
    return out


class Builder:
    def __init__(self):
        self.chapters = []
        self.part = "intro"
        self.chapter = None
        self.section = None
        self.para = None  # paragraphe en cours : {"type", "segs", "last_y", "page"}
        self.ids = set()

    # --- structure -------------------------------------------------------
    def unique(self, ident):
        base, n = ident, 2
        while ident in self.ids:
            ident = f"{base}-{n}"
            n += 1
        self.ids.add(ident)
        return ident

    def new_chapter(self, ident, title, page):
        self.flush()
        self.chapter = {"id": self.unique(ident), "title": title, "part": self.part, "page": page, "sections": []}
        self.chapters.append(self.chapter)
        self.section = {"id": self.chapter["id"], "title": None, "level": 1, "page": page, "blocks": []}
        self.chapter["sections"].append(self.section)

    def new_section(self, ident, title, level, page):
        self.flush()
        self.section = {"id": self.unique(ident), "title": title, "level": level, "page": page, "blocks": []}
        self.chapter["sections"].append(self.section)

    def add_block(self, block):
        self.flush()
        self.section["blocks"].append(block)

    # --- paragraphes -----------------------------------------------------
    def flush(self):
        if self.para:
            text = segs_to_md(self.para["segs"])
            if text:
                block = {"type": self.para["type"], "text": text}
                if self.para.get("id"):
                    block["id"] = self.para["id"]
                blocks = self.section["blocks"]
                if block["type"] == "caption" and blocks and blocks[-1]["type"] == "figure":
                    blocks[-1]["caption"] = re.sub(r"\*\*", "", text)
                else:
                    blocks.append(block)
            self.para = None

    def start_para(self, kind, line, page, ident=None):
        self.flush()
        self.para = {"type": kind, "segs": list(line["segs"]), "last_y": line["y"], "page": page}
        if ident:
            self.para["id"] = ident

    def continue_para(self, line, page):
        self.para["segs"].append((" ", False))
        self.para["segs"].extend(line["segs"])
        self.para["last_y"] = line["y"]
        self.para["page"] = page


HEADING_NUM = re.compile(r"^(\d+(?:\.\d+)*)\.?\s+(.+)$")
SCENARIO = re.compile(r"^Sc[ée]nario\s+(C[\d.·]+[\s.]?[A-Z])\b\s*(.*)$")
NUMBERED = re.compile(r"^\d+\.\s")


def scenario_id(raw):
    return re.sub(r"[·\s]", ".", raw).replace("..", ".")


def build(pdf_path):
    doc = pymupdf.open(pdf_path)
    bld = Builder()
    pending_heading = None  # titres sur plusieurs lignes

    def emit_heading(h, page):
        size, text = h["size"], h["text"]
        if size >= 30:
            if text.startswith("Livret"):
                bld.part = "casebook"
            return
        if size >= 20:  # chapitre
            if text == "Résumé":
                bld.part = "rules"
                bld.new_chapter("resume", "Résumé", page)
            elif text == "Glossaire":
                bld.part = "glossary"
                bld.new_chapter("glossaire", "Glossaire", page)
            elif text == "Appendices":
                bld.part = "appendix"
                bld.new_chapter("appendices", "Appendices", page)
            else:
                m = HEADING_NUM.match(text)
                num, title = m.group(1), m.group(2)
                prefix = "C" if bld.part == "casebook" else ""
                bld.new_chapter(prefix + num, title, page)
                bld.chapter["num"] = num
            return
        if size >= 13.5 and bld.part == "intro":
            bld.new_chapter("ecriture-inclusive", text, page)
            return
        m = HEADING_NUM.match(text)
        num, title = m.group(1), m.group(2)
        prefix = "C" if bld.part == "casebook" else ""
        level = 2 if size >= 17 else 3
        bld.new_section(prefix + num, title, level, page)
        bld.section["num"] = num

    for pno in range(1, doc.page_count + 1):
        if pno == 3:  # table des matières
            continue
        page = doc[pno - 1]
        lines = page_lines(page)
        if pno == 69:
            lines = handle_table_page(lines, bld)
        fig = FIGURES.get(pno)
        fig_y = figure_anchor_y(page) if fig else None
        items = [("line", l) for l in lines]
        if fig and fig_y is not None:
            items.append(("fig", {"y": fig_y}))
        items.sort(key=lambda it: it[1]["y"])
        prev_y = None
        for kind, l in items:
            if kind == "fig":
                name, _box, alt = fig
                if pending_heading:
                    emit_heading(pending_heading, pno)
                    pending_heading = None
                bld.add_block({"type": "figure", "src": f"assets/figures/{name}.png", "alt": alt, "caption": None})
                prev_y = None
                continue
            if kind == "table":
                continue
            if l.get("table"):
                bld.add_block(l["table"])
                prev_y = None
                continue
            size, text = l["size"], l["text"]
            # Titres (taille > corps de texte)
            if size >= 13.5:
                if pending_heading and pending_heading["size"] == size and l["y"] - pending_heading["y2"] < 40:
                    pending_heading["text"] += " " + text
                    pending_heading["y2"] = l["y"]
                    continue
                if pending_heading:
                    emit_heading(pending_heading, pno)
                pending_heading = {"size": size, "text": text, "y2": l["y"]}
                prev_y = l["y"]
                continue
            if pending_heading:
                emit_heading(pending_heading, pno)
                pending_heading = None
                prev_y = None
            if bld.chapter is None:
                continue

            gap = None if prev_y is None else l["y"] - prev_y
            new_para = gap is None or gap > PARA_GAP
            para = bld.para
            sc = SCENARIO.match(text)
            is_sub = (
                l["bold"] and len(text) < 70 and not text.endswith((".", ":", ";", ","))
                and (new_para and (para is None or gap is not None or para_closed(para)))
                and not text.startswith("—")
            )
            if sc and len(text) < 30:
                sid = scenario_id(sc.group(1))
                bld.flush()
                bld.add_block({"type": "scenario", "id": bld.unique(sid), "text": f"Scénario {sid}"})
            elif text.startswith("Fig."):
                bld.start_para("caption", l, pno)
            elif is_sub:
                kind_ = "term" if bld.part == "glossary" else "h"
                prefix = "g-" if kind_ == "term" else f"{bld.section['id']}-"
                bld.add_block({"type": kind_, "id": bld.unique(prefix + slug(text)), "text": text})
            elif text.startswith(("●", "○")):
                bld.start_para("li" if text.startswith("●") else "li2", l, pno)
                bld.para["segs"][0] = (bld.para["segs"][0][0].lstrip("●○ "), bld.para["segs"][0][1])
            elif NUMBERED.match(text) and 45 < l["x"] < 62:
                bld.start_para("ol", l, pno)
            elif text.startswith("—") or text.startswith("-Origine"):
                bld.start_para("origin", l, pno)
            elif para and not new_para:
                bld.continue_para(l, pno)
            elif para and gap is None and not para_closed(para) and para["type"] in ("p", "li", "ol", "quote") and text[:1].islower():
                bld.continue_para(l, pno)  # paragraphe coupé par un saut de page
            elif para and gap is None and not para_closed(para) and para["type"] in ("p", "li", "ol", "quote") and l["x"] >= 68 and para["type"] in ("li", "ol"):
                bld.continue_para(l, pno)
            else:
                kind_ = "quote" if (bld.part == "casebook" and l["x"] >= 68) else "p"
                bld.start_para(kind_, l, pno)
            prev_y = l["y"]
    bld.flush()
    return bld.chapters


def para_closed(para):
    return segs_to_md(para["segs"]).rstrip("* ").endswith(TERMINAL)


def handle_table_page(lines, bld):
    """Page 69 : tableau à deux colonnes du scénario C2.3.C."""
    top = [l for l in lines if l["y"] < 455]
    rows_src = [l for l in lines if l["y"] >= 455]
    rows = []
    for l in sorted(rows_src, key=lambda l: (l["y"], l["x"])):
        if l["x"] < 200:
            if rows and rows[-1]["left_open"] and l["y"] - rows[-1]["ly"] < 26:
                rows[-1]["left"] += " " + l["text"]
                rows[-1]["ly"] = l["y"]
            else:
                rows.append({"left": l["text"], "right": "", "ly": l["y"], "y": l["y"], "left_open": True})
        else:
            target = [r for r in rows if r["y"] <= l["y"] + 2][-1]
            target["right"] = (target["right"] + " " + l["text"]).strip()
    table = {
        "type": "table",
        "head": ["Bloqueur·se à terre", "Composition du Pack"],
        "rows": [[r["left"], r["right"]] for r in rows],
    }
    return top + [{"y": 455, "x": 0, "size": 12, "text": "", "segs": [], "bold": False, "table": table}]


def main():
    pdf = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "tools" / ".cache" / "wftda-rules-french.pdf"
    if not pdf.exists():
        pdf.parent.mkdir(parents=True, exist_ok=True)
        print(f"Téléchargement de {PDF_URL}…")
        urllib.request.urlretrieve(PDF_URL, pdf)
    doc = pymupdf.open(pdf)
    chapters = build(pdf)
    crop_figures(pdf)
    data = {
        "title": doc.metadata.get("title") or "Les règles du Roller Derby sur piste plate",
        "version": "Janvier 2025",
        "source": PDF_URL,
        "copyright": "©2025 Women’s Flat Track Derby Association (WFTDA)",
        "chapters": chapters,
    }
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    n_sections = sum(len(c["sections"]) for c in chapters)
    n_blocks = sum(len(s["blocks"]) for c in chapters for s in c["sections"])
    print(f"{len(chapters)} chapitres, {n_sections} sections, {n_blocks} blocs -> {OUT_JSON.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
