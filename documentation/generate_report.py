#!/usr/bin/env python3
"""Build the Arabic EventFlow graduation report from the marker-based Markdown sources."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Iterable

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor

ROOT = Path(__file__).resolve().parent
SOURCE_DIR = ROOT / "source"
DOCX_PATH = ROOT / "EventFlow_Arabic_Graduation_Report.docx"
MD_PATH = ROOT / "EventFlow_Arabic_Graduation_Report.md"

SOURCE_FILES = [
    "00_prelim.md",
    "01_chapter1.md",
    "02_chapter2.md",
    "03_chapter3.md",
    "04_chapter4.md",
    "05_chapter5.md",
    "06_chapter6.md",
    "07_chapter7.md",
    "08_references.md",
    "09_appendices.md",
]

ARABIC_RE = re.compile(r"[\u0600-\u06FF]")
BOLD_SPLIT_RE = re.compile(r"(\*\*.+?\*\*|`[^`]+`)")


# ---------------------------------------------------------------------------
# XML / style helpers
# ---------------------------------------------------------------------------
def _rpr(run):
    return run._r.get_or_add_rPr()


def set_run_font(run, name: str = "Times New Roman", size: float | None = None,
                 bold: bool | None = None, italic: bool | None = None,
                 color: str | None = None, hidden: bool = False) -> None:
    run.font.name = name
    rpr = _rpr(run)
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.insert(0, rfonts)
    for attr in ("ascii", "hAnsi", "eastAsia", "cs"):
        rfonts.set(qn(f"w:{attr}"), name)
    if size is not None:
        run.font.size = Pt(size)
    if bold is not None:
        run.bold = bold
    if italic is not None:
        run.italic = italic
    if color:
        run.font.color.rgb = RGBColor.from_string(color)
    if hidden:
        vanish = OxmlElement("w:vanish")
        rpr.append(vanish)


def mark_arabic_run(run, text: str) -> bool:
    """Apply Arial complex-script/font and RTL to Arabic runs. Returns True if Arabic."""
    if not ARABIC_RE.search(text):
        return False
    rpr = _rpr(run)
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.insert(0, rfonts)
    # Keep Latin identifiers in Times New Roman, Arabic in Arial.
    rfonts.set(qn("w:cs"), "Arial")
    rfonts.set(qn("w:ascii"), "Times New Roman")
    rfonts.set(qn("w:hAnsi"), "Times New Roman")
    rfonts.set(qn("w:eastAsia"), "Times New Roman")
    rtl = OxmlElement("w:rtl")
    rpr.append(rtl)
    lang = rpr.find(qn("w:lang"))
    if lang is None:
        lang = OxmlElement("w:lang")
        rpr.append(lang)
    lang.set(qn("w:bidi"), "ar-SA")
    return True


def set_paragraph_bidi(paragraph, enabled: bool) -> None:
    ppr = paragraph._p.get_or_add_pPr()
    bidi = ppr.find(qn("w:bidi"))
    if enabled:
        if bidi is None:
            bidi = OxmlElement("w:bidi")
            ppr.append(bidi)
        bidi.set(qn("w:val"), "1")
    elif bidi is not None:
        ppr.remove(bidi)


def add_field(paragraph, instruction: str, placeholder: str = "1", *,
              hidden: bool = False, bold: bool = False, size: float | None = None) -> None:
    run = paragraph.add_run()
    set_run_font(run, size=size, bold=bold, hidden=hidden)
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = f" {instruction} "
    sep = OxmlElement("w:fldChar")
    sep.set(qn("w:fldCharType"), "separate")
    text = OxmlElement("w:t")
    text.text = placeholder
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.extend([begin, instr, sep, text, end])


def add_formatted_text(paragraph, text: str, *, size: float | None = None,
                       bold: bool = False, italic: bool = False,
                       color: str | None = None) -> None:
    """Add text with **bold** and `code` spans, preserving Arabic typography."""
    for part in BOLD_SPLIT_RE.split(text):
        if not part:
            continue
        is_bold = bold
        is_code = False
        if part.startswith("**") and part.endswith("**"):
            part = part[2:-2]
            is_bold = True
        elif part.startswith("`") and part.endswith("`"):
            part = part[1:-1]
            is_code = True
        run = paragraph.add_run(part)
        set_run_font(run, size=size, bold=is_bold, italic=italic, color=color)
        if is_code:
            # Light shading keeps identifiers readable without changing the required font.
            rpr = _rpr(run)
            shd = OxmlElement("w:shd")
            shd.set(qn("w:fill"), "F2F2F2")
            rpr.append(shd)
        mark_arabic_run(run, part)
        if ARABIC_RE.search(part):
            set_paragraph_bidi(paragraph, True)


def configure_styles(doc: Document) -> None:
    styles = doc.styles

    def style(name: str):
        try:
            return styles[name]
        except KeyError:
            return styles.add_style(name, 1)  # WD_STYLE_TYPE.PARAGRAPH

    def set_style(name: str, size: float, bold: bool = False, italic: bool = False,
                  align=WD_ALIGN_PARAGRAPH.LEFT, before: float = 0, after: float = 6,
                  line: float = 1.5, color: str | None = None, left_indent: float | None = None,
                  hanging: float | None = None):
        st = style(name)
        st.font.name = "Times New Roman"
        st.font.size = Pt(size)
        st.bold = bold
        st.italic = italic
        if color:
            st.font.color.rgb = RGBColor.from_string(color)
        pf = st.paragraph_format
        pf.alignment = align
        pf.space_before = Pt(before)
        pf.space_after = Pt(after)
        pf.line_spacing = line
        if left_indent is not None:
            pf.left_indent = Pt(left_indent)
        if hanging is not None:
            pf.first_line_indent = Pt(-hanging)
        rpr = st.element.get_or_add_rPr()
        rfonts = rpr.find(qn("w:rFonts"))
        if rfonts is None:
            rfonts = OxmlElement("w:rFonts")
            rpr.insert(0, rfonts)
        for attr in ("ascii", "hAnsi", "eastAsia", "cs"):
            rfonts.set(qn(f"w:{attr}"), "Times New Roman")
        return st

    set_style("Normal", 12, align=WD_ALIGN_PARAGRAPH.JUSTIFY, after=6, line=1.5)
    set_style("Heading 1", 16, bold=True, align=WD_ALIGN_PARAGRAPH.RIGHT, before=12, after=6, line=1.5)
    set_style("Heading 2", 14, bold=True, align=WD_ALIGN_PARAGRAPH.RIGHT, before=10, after=4, line=1.5)
    set_style("Heading 3", 12, bold=True, align=WD_ALIGN_PARAGRAPH.RIGHT, before=8, after=4, line=1.5)
    set_style("Caption", 10, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, before=6, after=6, line=1.0)
    set_style("Reference Entry", 12, align=WD_ALIGN_PARAGRAPH.LEFT, after=6, line=1.5,
              left_indent=36, hanging=36)
    set_style("toc 1", 12, bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, after=3, line=1.15)
    set_style("toc 2", 12, align=WD_ALIGN_PARAGRAPH.LEFT, after=3, line=1.15, left_indent=14)
    set_style("toc 3", 12, align=WD_ALIGN_PARAGRAPH.LEFT, after=3, line=1.15, left_indent=28)
    set_style("table of figures", 12, align=WD_ALIGN_PARAGRAPH.LEFT, after=3, line=1.15)
    set_style("List Bullet", 12, align=WD_ALIGN_PARAGRAPH.JUSTIFY, after=3, line=1.5)
    set_style("List Number", 12, align=WD_ALIGN_PARAGRAPH.JUSTIFY, after=3, line=1.5)
    set_style("Header", 10, italic=True, align=WD_ALIGN_PARAGRAPH.CENTER, after=0, line=1.0, color="595959")
    set_style("Footer", 10, align=WD_ALIGN_PARAGRAPH.CENTER, after=0, line=1.0)
    set_style("Front Title", 16, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, after=12, line=1.5)
    set_style("Chapter Cover Number", 24, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, after=6, line=1.0)
    set_style("Chapter Cover Title", 20, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, after=12, line=1.15)
    set_style("Table Text", 10, align=WD_ALIGN_PARAGRAPH.RIGHT, after=0, line=1.0)
    set_style("Table Header", 10, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, after=0, line=1.0)
    set_style("Template Note", 10.5, italic=True, align=WD_ALIGN_PARAGRAPH.JUSTIFY,
              before=2, after=8, line=1.15, color="595959")


def set_page_setup(section) -> None:
    section.page_width = Cm(21.0)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(2.5)
    section.bottom_margin = Cm(2.5)
    section.right_margin = Cm(2.5)
    section.left_margin = Cm(3.0)
    section.header_distance = Cm(1.25)
    section.footer_distance = Cm(1.25)


def set_pg_num(section, fmt: str | None = None, start: int | None = None) -> None:
    sect_pr = section._sectPr
    node = sect_pr.find(qn("w:pgNumType"))
    if node is None:
        node = OxmlElement("w:pgNumType")
        cols = sect_pr.find(qn("w:cols"))
        if cols is not None:
            cols.addprevious(node)
        else:
            sect_pr.append(node)
    if fmt:
        node.set(qn("w:fmt"), fmt)
    if start is not None:
        node.set(qn("w:start"), str(start))
    elif node.get(qn("w:start")) is not None:
        del node.attrib[qn("w:start")]


def add_bottom_border(paragraph) -> None:
    ppr = paragraph._p.get_or_add_pPr()
    pbdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "4")
    bottom.set(qn("w:space"), "1")
    bottom.set(qn("w:color"), "A6A6A6")
    pbdr.append(bottom)
    ppr.append(pbdr)


def clear_paragraph(paragraph) -> None:
    for run in list(paragraph.runs):
        run._element.getparent().remove(run._element)


def setup_header_footer(section, *, header_text: str | None,
                        footer_prefix: str | None = None,
                        hide_page_number: bool = False,
                        first_page_blank: bool = False) -> None:
    section.header.is_linked_to_previous = False
    section.footer.is_linked_to_previous = False
    section.different_first_page_header_footer = first_page_blank

    hp = section.header.paragraphs[0]
    clear_paragraph(hp)
    hp.style = "Header"
    if header_text:
        r = hp.add_run(header_text)
        set_run_font(r, size=10, italic=True, color="595959")
        add_bottom_border(hp)

    fp = section.footer.paragraphs[0]
    clear_paragraph(fp)
    fp.style = "Footer"
    if not hide_page_number:
        if footer_prefix:
            r = fp.add_run(footer_prefix)
            set_run_font(r, size=10, bold=True)
        add_field(fp, "PAGE", "1", size=10)

    if first_page_blank:
        for first in (section.first_page_header, section.first_page_footer):
            for p in first.paragraphs:
                clear_paragraph(p)


def configure_section(section, *, start: int | None = None, fmt: str = "decimal",
                      header_text: str | None = None, footer_prefix: str | None = None,
                      hide_page_number: bool = False, first_page_blank: bool = False) -> None:
    set_page_setup(section)
    section.start_type = WD_SECTION.NEW_PAGE
    set_pg_num(section, fmt=fmt, start=start)
    setup_header_footer(section, header_text=header_text, footer_prefix=footer_prefix,
                        hide_page_number=hide_page_number, first_page_blank=first_page_blank)


# ---------------------------------------------------------------------------
# Table helpers
# ---------------------------------------------------------------------------
def set_cell_shading(cell, fill: str) -> None:
    tcpr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    tcpr.append(shd)


def set_cell_margins(cell, top=60, start=80, bottom=60, end=80) -> None:
    tcpr = cell._tc.get_or_add_tcPr()
    mar = OxmlElement("w:tcMar")
    for tag, val in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = OxmlElement(f"w:{tag}")
        node.set(qn("w:w"), str(val))
        node.set(qn("w:type"), "dxa")
        mar.append(node)
    tcpr.append(mar)


def prevent_row_split(row) -> None:
    trpr = row._tr.get_or_add_trPr()
    trpr.append(OxmlElement("w:cantSplit"))


def repeat_header_row(row) -> None:
    trpr = row._tr.get_or_add_trPr()
    trpr.append(OxmlElement("w:tblHeader"))


def set_table_borders_none(table) -> None:
    tblpr = table._tbl.tblPr
    borders = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        node = OxmlElement(f"w:{edge}")
        node.set(qn("w:val"), "none")
        borders.append(node)
    tblpr.append(borders)


def add_markdown_table(doc: Document, rows: list[list[str]]) -> None:
    if not rows:
        return
    header = rows[0]
    body = [r for r in rows[1:]
            if not all(c.strip() and set(c.strip()) <= set("-: ") for c in r)]
    cols = max(len(header), *(len(r) for r in body)) if body else len(header)
    table = doc.add_table(rows=1 + len(body), cols=cols)
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = True

    for c in range(cols):
        cell = table.cell(0, c)
        cell.text = ""
        p = cell.paragraphs[0]
        p.style = "Table Header"
        add_formatted_text(p, header[c] if c < len(header) else "", size=10, bold=True)
        add_paragraph_bidi_from_runs(p)
        set_cell_shading(cell, "E7E6E6")
        set_cell_margins(cell)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    repeat_header_row(table.rows[0])
    prevent_row_split(table.rows[0])

    for r_idx, row in enumerate(body, start=1):
        prevent_row_split(table.rows[r_idx])
        for c in range(cols):
            cell = table.cell(r_idx, c)
            cell.text = ""
            p = cell.paragraphs[0]
            p.style = "Table Text"
            add_formatted_text(p, row[c] if c < len(row) else "", size=10)
            add_paragraph_bidi_from_runs(p)
            set_cell_margins(cell)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER


def add_paragraph_bidi_from_runs(paragraph) -> None:
    if any(ARABIC_RE.search(run.text) for run in paragraph.runs):
        set_paragraph_bidi(paragraph, True)


def add_image_table(doc: Document, path: Path) -> None:
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    set_table_borders_none(table)
    cell = table.cell(0, 0)
    cell.text = ""
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run()
    run.add_picture(str(path), width=Cm(15.0))
    set_cell_margins(cell, top=20, bottom=20)


# ---------------------------------------------------------------------------
# Content helpers
# ---------------------------------------------------------------------------
def add_caption(doc: Document, text: str) -> None:
    p = doc.add_paragraph(style="Caption")
    kind = "Figure" if text.startswith("Figure") else "Table" if text.startswith("Table") else None
    if kind:
        add_field(p, rf'SEQ {kind} \* ARABIC', "1", hidden=True)
    add_formatted_text(p, text, size=10, bold=True)
    add_paragraph_bidi_from_runs(p)


def add_field_paragraph(doc: Document, instruction: str, placeholder: str) -> None:
    p = doc.add_paragraph(style="Normal")
    add_field(p, instruction, placeholder, size=12)
    hint = p.add_run("  \u2014 \u064a\u0631\u062c\u0649 \u062a\u062d\u062f\u064a\u062b \u0627\u0644\u062d\u0642\u0644 \u0645\u0646 Word")
    set_run_font(hint, size=9, italic=True, color="808080")
    mark_arabic_run(hint, hint.text)
    set_paragraph_bidi(p, True)


def add_heading(doc: Document, level: int, text: str) -> None:
    p = doc.add_paragraph(style=f"Heading {level}")
    add_formatted_text(p, text, bold=True)
    add_paragraph_bidi_from_runs(p)


def add_page_break(doc: Document) -> None:
    p = doc.add_paragraph()
    p.add_run().add_break(WD_BREAK.PAGE)


def add_chapter_cover(doc: Document, number: int, arabic_title: str, english_title: str) -> None:
    for _ in range(4):
        doc.add_paragraph()
    p = doc.add_paragraph(style="Chapter Cover Number")
    add_formatted_text(p, f"Chapter {number}", size=24, bold=True)
    p = doc.add_paragraph(style="Chapter Cover Title")
    add_formatted_text(p, arabic_title, size=20, bold=True)
    p = doc.add_paragraph(style="Chapter Cover Title")
    add_formatted_text(p, english_title, size=16, italic=True)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_bottom_border(p)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("Graduation Project Report")
    set_run_font(r, size=12, italic=True)
    add_page_break(doc)


def preprocess_lines(lines: list[str]) -> list[str]:
    """Drop page breaks immediately before a section/chapter/appendix marker."""
    section_prefixes = ("<!-- SECTION:", "<!-- CHAPTER:", "<!-- SECTION:REFS",
                        "<!-- SECTION:APPENDIX_DIVIDER", "<!-- APPENDIX:")
    out: list[str] = []
    for i, line in enumerate(lines):
        if line.strip() == "<!-- PAGEBREAK -->":
            nxt = ""
            for j in range(i + 1, len(lines)):
                if lines[j].strip():
                    nxt = lines[j].strip()
                    break
            if nxt.startswith(section_prefixes):
                continue
        out.append(line)
    return out


def strip_table_separator(rows: list[list[str]]) -> list[list[str]]:
    return [r for r in rows
            if not all(c.strip() and set(c.strip()) <= set("-: ") for c in r)]


def parse_markdown(doc: Document, lines: Iterable[str], assets_dir: Path) -> None:
    lines = preprocess_lines(list(lines))
    i = 0
    while i < len(lines):
        raw = lines[i]
        line = raw.rstrip()
        stripped = line.strip()
        i += 1
        if not stripped:
            continue

        # Section and structural markers
        if stripped == "<!-- SECTION:COVER -->":
            continue
        if stripped == "<!-- SECTION:PRELIM -->":
            configure_section(doc.add_section(), fmt="lowerRoman", start=1,
                              header_text="EventFlow \u2014 Graduation Project Report")
            continue
        if stripped.startswith("<!-- CHAPTER:"):
            parts = stripped[len("<!-- CHAPTER:"):-3].split("|")
            number = int(parts[0].strip())
            arabic_title = parts[1].strip() if len(parts) > 1 else ""
            english_title = parts[2].strip() if len(parts) > 2 else ""
            configure_section(doc.add_section(), start=1 if number == 1 else None,
                              header_text="EventFlow \u2014 Graduation Project Report",
                              first_page_blank=True)
            add_chapter_cover(doc, number, arabic_title, english_title)
            add_heading(doc, 1, arabic_title)
            continue
        if stripped == "<!-- SECTION:REFS -->":
            configure_section(doc.add_section(), header_text="References")
            add_heading(doc, 1, "\u0627\u0644\u0645\u0631\u0627\u062c\u0639")
            continue
        if stripped == "<!-- SECTION:APPENDIX_DIVIDER -->":
            configure_section(doc.add_section(), header_text="Appendices")
            add_heading(doc, 1, "\u0627\u0644\u0645\u0644\u0627\u062d\u0642")
            continue
        if stripped.startswith("<!-- APPENDIX:"):
            parts = stripped[len("<!-- APPENDIX:"):-3].split("|")
            letter = parts[0].strip()
            english_title = parts[1].strip() if len(parts) > 1 else ""
            arabic_title = parts[2].strip() if len(parts) > 2 else ""
            configure_section(doc.add_section(), start=1, header_text=english_title,
                              footer_prefix=f"{letter} ")
            add_heading(doc, 1, f"\u0627\u0644\u0645\u0644\u062d\u0642 {letter}: {arabic_title}")
            continue
        if stripped == "<!-- PAGEBREAK -->":
            add_page_break(doc)
            continue
        if stripped.startswith("<!-- FMT:"):
            parts = stripped[len("<!-- FMT:"):-3].split("|")
            if len(parts) >= 4:
                size = float(parts[0])
                bold = parts[1].strip().lower() == "bold"
                align_map = {
                    "center": WD_ALIGN_PARAGRAPH.CENTER,
                    "left": WD_ALIGN_PARAGRAPH.LEFT,
                    "right": WD_ALIGN_PARAGRAPH.RIGHT,
                }
                align = align_map.get(parts[2].strip().lower(), WD_ALIGN_PARAGRAPH.RIGHT)
                text = "|".join(parts[3:])
                p = doc.add_paragraph()
                p.alignment = align
                add_formatted_text(p, text, size=size, bold=bold)
                add_paragraph_bidi_from_runs(p)
            continue
        if stripped.startswith("<!-- FIELD:"):
            kind = stripped[len("<!-- FIELD:"):-3].strip()
            fields = {
                "TOC": (r'TOC \o "1-3" \h \z \u', "TOC"),
                "LOF": (r'TOC \h \z \c "Figure"', "List of Figures"),
                "LOT": (r'TOC \h \z \c "Table"', "List of Tables"),
            }
            if kind in fields:
                add_field_paragraph(doc, *fields[kind])
            continue
        if stripped.startswith("<!-- IMAGE_TABLE:"):
            rel = stripped[len("<!-- IMAGE_TABLE:"):-3].strip()
            path = (ROOT / rel).resolve()
            if not path.exists():
                path = (assets_dir / Path(rel).name).resolve()
            if not path.exists():
                raise FileNotFoundError(f"Image not found: {rel}")
            add_image_table(doc, path)
            continue
        if stripped.startswith("<!-- IMAGE:"):
            rel = stripped[len("<!-- IMAGE:"):-3].strip()
            path = (ROOT / rel).resolve()
            if not path.exists():
                path = (assets_dir / Path(rel).name).resolve()
            if not path.exists():
                raise FileNotFoundError(f"Image not found: {rel}")
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_before = Pt(6)
            p.paragraph_format.space_after = Pt(6)
            p.add_run().add_picture(str(path), width=Cm(14.5))
            continue
        if stripped.startswith("Caption:"):
            add_caption(doc, stripped[len("Caption:"):].strip())
            continue
        if re.match(r"^(Table|Figure)\s+[A-Za-z0-9-]+:", stripped):
            add_caption(doc, stripped)
            continue

        # Markdown pipe tables
        if stripped.startswith("|"):
            block = [stripped]
            while i < len(lines) and lines[i].strip().startswith("|"):
                block.append(lines[i].strip())
                i += 1
            parsed = [[c.strip() for c in row.strip().strip("|").split("|")] for row in block]
            add_markdown_table(doc, strip_table_separator(parsed))
            continue

        # Headings
        if stripped.startswith("### "):
            add_heading(doc, 3, stripped[4:].strip())
            continue
        if stripped.startswith("## "):
            add_heading(doc, 2, stripped[3:].strip())
            continue
        if stripped.startswith("# "):
            add_heading(doc, 1, stripped[2:].strip())
            continue

        # Lists
        if re.match(r"^[-*]\s+", stripped):
            p = doc.add_paragraph(style="List Bullet")
            add_formatted_text(p, re.sub(r"^[-*]\s+", "", stripped))
            add_paragraph_bidi_from_runs(p)
            continue
        if re.match(r"^\d+\.\s+", stripped):
            p = doc.add_paragraph(style="List Number")
            add_formatted_text(p, re.sub(r"^\d+\.\s+", "", stripped))
            add_paragraph_bidi_from_runs(p)
            continue

        if stripped == "---":
            continue

        # Reference entries use their dedicated style.
        if re.match(r"^\[\d+\]\s+", stripped):
            p = doc.add_paragraph(style="Reference Entry")
            add_formatted_text(p, stripped)
            add_paragraph_bidi_from_runs(p)
            continue

        p = doc.add_paragraph(style="Normal")
        add_formatted_text(p, stripped)
        add_paragraph_bidi_from_runs(p)


def main() -> None:
    parts = []
    for name in SOURCE_FILES:
        path = SOURCE_DIR / name
        if not path.exists():
            raise FileNotFoundError(f"Missing source part: {path}")
        parts.append(path.read_text(encoding="utf-8").strip())
    MD_PATH.write_text("\n\n---\n\n".join(parts) + "\n", encoding="utf-8")

    doc = Document()
    configure_styles(doc)
    props = doc.core_properties
    props.title = "EventFlow: An Integrated Web-Based Event Management System"
    props.subject = "Graduation Project Report"
    props.author = ""
    props.keywords = "EventFlow, event management, graduation project, React, Supabase"
    props.language = "en-US"
    configure_section(doc.sections[0], start=1, hide_page_number=True)

    all_lines = "\n".join(parts).splitlines()
    parse_markdown(doc, all_lines, ROOT / "assets")
    doc.save(DOCX_PATH)

    captions = [p for p in doc.paragraphs if p.style.name == "Caption"]
    refs = [p for p in doc.paragraphs if p.style.name == "Reference Entry"]
    covers = [p for p in doc.paragraphs if p.style.name == "Chapter Cover Number"]
    print(f"Wrote {DOCX_PATH.name}: sections={len(doc.sections)}, tables={len(doc.tables)}, "
          f"captions={len(captions)}, references={len(refs)}, chapter_covers={len(covers)}")
    print(f"Wrote {MD_PATH.name}")


if __name__ == "__main__":
    main()
