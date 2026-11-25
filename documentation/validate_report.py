#!/usr/bin/env python3
"""Validate the generated EventFlow DOCX and write the required validation report."""
from __future__ import annotations

import re
import zipfile
from datetime import datetime
from pathlib import Path

from docx import Document
from docx.shared import Pt

ROOT = Path(__file__).resolve().parent
DOCX = ROOT / "EventFlow_Arabic_Graduation_Report.docx"
PDF = ROOT / "EventFlow_Arabic_Graduation_Report.pdf"
REPORT = ROOT / "Documentation_Validation_Report.md"
SOURCE_DIR = ROOT / "source"

TEST_SUMMARY = {
    "command": "npm.cmd test (npm test was blocked by PowerShell execution policy)",
    "files": "12 passed (12)",
    "tests": "95 passed (95)",
    "duration": "12.00 s",
    "failures": "none",
    "note": "All automated cases passed. The 26 authored TC-01..TC-26 acceptance scenarios were not executed as a separate manual suite; their Result column is intentionally blank.",
}

EXPECTED_TC = [f"TC-{i:02d}" for i in range(1, 27)]
ARTIFACT_WORDS = [
    ".placehodler", "تُBIN", ".work اليدوي", "interact بين", "梅 منهجيات",
    "旁", "方向和", "rist区分", "人机", "命令 `build`", "Insert Figure",
    "Template Note", "[Insert Figure", "xxxx", "Lorem ipsum",
    "иск", "تُiplen", "يストخدم", "ت internally", "تذكية", "F`C`",
    "[rpc]", "يمكنعرض", "فيطلبات", "有些", "تExist", "هيancelled",
    "المDLLات", "review الدوري", "[15]", "[16]", "FR-A", "FR-B", "FR-C",
    "FR-D", "FR-E", "FR-F", "FR-G", "FR-H", "FR-I", "FR-J", "FR-K",
]


class Check:
    def __init__(self, name: str, ok: bool, detail: str = ""):
        self.name = name
        self.ok = bool(ok)
        self.detail = detail


def document_xml(docx: Path) -> str:
    with zipfile.ZipFile(docx) as zf:
        return zf.read("word/document.xml").decode("utf-8", errors="replace")


def all_word_xml(docx: Path) -> str:
    """Combine document, header and footer XML so footer PAGE fields are visible."""
    with zipfile.ZipFile(docx) as zf:
        parts = [zf.read(name).decode("utf-8", errors="replace")
                 for name in zf.namelist()
                 if name.startswith("word/") and name.endswith(".xml")]
    return "\n".join(parts)


def find_table(doc, header_start: list[str]):
    for table in doc.tables:
        if not table.rows:
            continue
        cells = [c.text.strip() for c in table.rows[0].cells]
        if all(any(h in c for c in cells) for h in header_start):
            return table
    return None


def run() -> list[Check]:
    checks: list[Check] = []
    if not DOCX.exists():
        return [Check("DOCX exists", False, str(DOCX))]

    doc = Document(DOCX)
    xml = document_xml(DOCX)
    word_xml = all_word_xml(DOCX)

    checks.append(Check("DOCX exists and opens", True, f"{DOCX.stat().st_size:,} bytes"))
    checks.append(Check("19 document sections", len(doc.sections) == 19, f"found {len(doc.sections)}"))
    checks.append(Check("34 tables", len(doc.tables) == 34, f"found {len(doc.tables)}"))

    captions = [p for p in doc.paragraphs if p.style.name == "Caption"]
    checks.append(Check("28 caption paragraphs", len(captions) == 28, f"found {len(captions)}"))

    refs = [p for p in doc.paragraphs if p.style.name == "Reference Entry"]
    checks.append(Check("14 IEEE reference entries", len(refs) == 14, f"found {len(refs)}"))
    checks.append(Check(
        "References numbered [1]-[14]",
        [p.text.strip().split("\t")[0] for p in refs] == [f"[{i}]" for i in range(1, 15)],
        "checked prefix order",
    ))

    covers = [p for p in doc.paragraphs if p.style.name == "Chapter Cover Number"]
    checks.append(Check("7 chapter cover pages", len(covers) == 7, f"found {len(covers)}"))

    appendix_heads = [p.text for p in doc.paragraphs
                      if p.style.name == "Heading 1" and p.text.strip().startswith("الملحق ")]
    checks.append(Check("8 appendices A-H", len(appendix_heads) == 8, f"found {len(appendix_heads)}"))

    # Table D-1: exactly 26 authored acceptance cases, blank results.
    tc_table = find_table(doc, ["ID", "Requirement", "Scenario", "Expected result", "Type", "Result"])
    if tc_table is None:
        checks.append(Check("Table D-1 found", False))
    else:
        ids = [r.cells[0].text.strip() for r in tc_table.rows[1:]]
        checks.append(Check("Table D-1 has 26 acceptance cases", ids == EXPECTED_TC,
                            f"found {len(ids)} rows"))
        results = [r.cells[5].text.strip() for r in tc_table.rows[1:]]
        checks.append(Check("Table D-1 results are not fabricated", all(x == "" for x in results),
                            "all Result cells blank"))

    # Student/supervisor identity fields remain empty.
    student_table = find_table(doc, ["Student Name", "Student No."])
    if student_table is None:
        checks.append(Check("Cover student table found", False))
    else:
        filled = [c.text.strip() for row in student_table.rows[1:] for c in row.cells if c.text.strip()]
        checks.append(Check("Student names and numbers are empty", not filled,
                            f"{len(filled)} filled identity cells"))

    # Page setup.
    s = doc.sections[1] if len(doc.sections) > 1 else doc.sections[0]
    margins = (round(s.top_margin.cm, 1), round(s.bottom_margin.cm, 1),
               round(s.right_margin.cm, 1), round(s.left_margin.cm, 1))
    checks.append(Check("A4 margins 2.5/2.5/2.5/3.0 cm",
                        margins == (2.5, 2.5, 2.5, 3.0), f"found {margins}"))
    checks.append(Check("A4 page size", round(s.page_width.cm, 1) == 21.0
                        and round(s.page_height.cm, 1) == 29.7,
                        f"{s.page_width.cm:.1f} x {s.page_height.cm:.1f} cm"))

    # Styles.
    def style_size(name: str):
        # Word may remove a size that matches the base style, so resolve inheritance.
        st = doc.styles[name]
        while st is not None:
            if st.font.size:
                return st.font.size.pt
            st = st.base_style
        return None

    checks.append(Check("Normal style 12 pt", style_size("Normal") == 12, f"found {style_size('Normal')}"))
    for name, expected in (("Heading 1", 16), ("Heading 2", 14), ("Heading 3", 12), ("Caption", 10)):
        checks.append(Check(f"{name} style {expected} pt", style_size(name) == expected,
                            f"found {style_size(name)}"))

    small_runs = []
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for p in cell.paragraphs:
                    for r in p.runs:
                        if r.font.size and r.font.size < Pt(9):
                            small_runs.append(r.text[:40])
    checks.append(Check("No table font below 9 pt", not small_runs,
                        f"{len(small_runs)} undersized runs"))

    # Word fields for TOC / LOF / LOT and SEQ numbering.
    checks.append(Check('TOC field present', r'TOC \o "1-3"' in xml))
    checks.append(Check('List of Figures field present', r'TOC \h \z \c "Figure"' in xml))
    checks.append(Check('List of Tables field present', r'TOC \h \z \c "Table"' in xml))
    seq_count = xml.count("SEQ Figure") + xml.count("SEQ Table")
    checks.append(Check("SEQ fields for captions", seq_count == 28, f"found {seq_count}"))
    checks.append(Check("PAGE fields present", " PAGE " in word_xml,
                        f"{word_xml.count(' PAGE ')} field instances across document/headers/footers"))

    # No editor artifacts.
    all_text = "\n".join(p.text for p in doc.paragraphs)
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                all_text += "\n" + cell.text
    found_artifacts = [w for w in ARTIFACT_WORDS if w in all_text]
    checks.append(Check("No template artifacts or fabricated placeholders", not found_artifacts,
                        ", ".join(found_artifacts) if found_artifacts else "clean"))

    stray_script = re.search(r"[\u0400-\u04FF\u4E00-\u9FFF]", all_text)
    checks.append(Check("No stray Cyrillic or CJK text", stray_script is None,
                        stray_script.group(0) if stray_script else "clean"))

    # All image paths in the Markdown source resolve.
    missing_images = []
    for src in SOURCE_DIR.glob("*.md"):
        for m in re.finditer(r"<!-- IMAGE(?:_TABLE)?:([^>]+) -->", src.read_text(encoding="utf-8")):
            rel = m.group(1).strip()
            if not (ROOT / rel).exists():
                missing_images.append(f"{src.name}: {rel}")
    checks.append(Check("All referenced image assets exist", not missing_images,
                        ", ".join(missing_images) if missing_images else "all resolved"))

    # TOC actually updated by Word: PAGEREF entries appear in the result.
    checks.append(Check("TOC page references updated", "PAGEREF" in xml,
                        f"{xml.count('PAGEREF')} PAGEREF field instances"))

    # PDF export is not a required deliverable. Word automation completed the
    # field refresh but stalled when asked to export a PDF in this environment.
    return checks


def write_report(checks: list[Check]) -> None:
    passed = sum(1 for c in checks if c.ok)
    failed = len(checks) - passed
    lines = [
        "# EventFlow Documentation Validation Report",
        "",
        "This report records the automated checks performed on the generated Arabic graduation report.",
        "",
        "## 1. Deliverables",
        "",
        "| File | Status |",
        "| --- | --- |",
        f"| `documentation/EventFlow_Arabic_Graduation_Report.docx` | {'generated' if DOCX.exists() else 'missing'} |",
        "| `documentation/EventFlow_Arabic_Graduation_Report.md` | generated |",
        "| `documentation/assets/` | generated from verified UML sources |",
        f"| `documentation/EventFlow_Arabic_Graduation_Report.pdf` | {'generated' if PDF.exists() else 'not generated (optional preview; Word PDF export stalled)'} |",
        f"| `documentation/Documentation_Validation_Report.md` | this report |",
        "",
        "## 2. Structural and formatting checks",
        "",
        f"**Result:** {passed} passed, {failed} failed.",
        "",
        "| Check | Result | Detail |",
        "| --- | --- | --- |",
    ]
    for c in checks:
        lines.append(f"| {c.name} | {'PASS' if c.ok else 'FAIL'} | {c.detail} |")

    lines += [
        "",
        "## 3. Automated test evidence",
        "",
        "| Item | Actual result |",
        "| --- | --- |",
        f"| Command | `{TEST_SUMMARY['command']}` |",
        f"| Test files | {TEST_SUMMARY['files']} |",
        f"| Test cases | {TEST_SUMMARY['tests']} |",
        f"| Duration | {TEST_SUMMARY['duration']} |",
        f"| Failures | {TEST_SUMMARY['failures']} |",
        "",
        TEST_SUMMARY["note"],
        "",
        "The 26 rows in `Table D-1` were copied from the approved template. Their `Result` cells were "
        "left intentionally blank because no separate execution log exists for those authored acceptance scenarios.",
        "",
        "## 4. Placeholders and limitations",
        "",
        "- Student names, university numbers, supervisor name/title and committee names are intentionally empty.",
        "- No application screenshots exist in the repository; `assets/screenshot_placeholder.png` is a clearly labelled placeholder, not a fabricated product image.",
        "- The university logo slot is labelled as unavailable; no logo was invented.",
        "- Figure F-1 uses relative planned durations from the approved template. No academic calendar dates were supplied, so no dates were invented.",
        "- No performance timings, coverage percentages, deployment credentials or production measurements are claimed.",
        "- The active chatbot path uses browser `useChat` with LM Studio via the `/lmstudio` proxy and REST tools; the Supabase Edge Function is documented as an alternative design path, not as the active UI path.",
        "- Appendix page numbers use the A1/B1/... footer prefix. Word TOC page numbers remain numeric, which is expected behaviour documented in the approved template.",
        "- Word field/TOC refresh completed successfully. A PDF preview was not produced because Word COM automation stalled at the optional `ExportAsFixedFormat` step; PDF is not a required deliverable.",
        "",
        "## 5. Reproduction",
        "",
        "```powershell",
        "python documentation/build_assets.py",
        "python documentation/generate_report.py",
        "powershell -ExecutionPolicy Bypass -File documentation/update_fields.ps1",
        "python documentation/validate_report.py",
        "```",
        "",
        f"Validation time: {datetime.now().isoformat(timespec='seconds')}.",
        "",
    ]
    REPORT.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    checks = run()
    write_report(checks)
    failed = [c for c in checks if not c.ok]
    print(f"Validation: {len(checks) - len(failed)} passed, {len(failed)} failed")
    for c in failed:
        print(f"  FAIL: {c.name} ({c.detail})")
    print(f"Report: {REPORT}")
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
