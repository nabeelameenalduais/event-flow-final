#!/usr/bin/env python3
"""Prepare verified PNG assets for the EventFlow graduation report.

SVG diagrams are rendered with headless Microsoft Edge because the environment
has no working Cairo library for CairoSVG. No application screenshots are
fabricated: a clearly labelled placeholder is produced where a screenshot would
otherwise be required.
"""
from __future__ import annotations

import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
ASSETS = ROOT / "assets"
SOURCES = ASSETS / "sources"
TEMP = Path(tempfile.gettempdir()) / "opencode" / "eventflow-assets"
TEMP.mkdir(parents=True, exist_ok=True)

SVG_DIR = REPO / "uml-exhaustive" / "final" / "svg"

DIAGRAMS = {
    "fig3-1.png": SVG_DIR / "EventFlow-Core-UseCases.svg",
    "erd.png": SVG_DIR / "03_erd.svg",
    "seq_auth.png": SVG_DIR / "04a_sequence_auth.svg",
    "seq_registration.png": SVG_DIR / "04b_sequence_registration.svg",
    "seq_checkin.png": SVG_DIR / "04c_sequence_checkin.svg",
    "seq_chat.png": SVG_DIR / "04d_sequence_chat.svg",
    "seq_evaluation.png": SVG_DIR / "04e_sequence_evaluation.svg",
    "seq_chatbot.png": SVG_DIR / "04f_sequence_chatbot.svg",
    "act_registration.png": SVG_DIR / "05a_activity_registration.svg",
    "act_checkin.png": SVG_DIR / "05b_activity_checkin.svg",
    "architecture.png": SVG_DIR / "06_architecture.svg",
    "state_machine.png": SVG_DIR / "07_state_machine.svg",
    "component.png": SVG_DIR / "08_component.svg",
    "deployment.png": SVG_DIR / "09_deployment.svg",
}

PHASES = [
    ("1. Initiation", 2),
    ("2. Requirements", 3),
    ("3. Analysis and modeling", 4),
    ("4. Design", 4),
    ("5. Implementation", 8),
    ("6. Testing", 3),
    ("7. Documentation", 4),
    ("8. Defense preparation", 2),
]


def edge_path() -> Path:
    candidates = [
        Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
        Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
    ]
    for p in candidates:
        if p.exists():
            return p
    raise FileNotFoundError("Microsoft Edge was not found; cannot render SVG assets.")


def svg_size(svg: Path) -> tuple[float, float]:
    root = ET.parse(svg).getroot()
    view_box = root.attrib.get("viewBox")
    if view_box:
        nums = [float(x) for x in view_box.replace(",", " ").split()]
        if len(nums) >= 4 and nums[2] > 0 and nums[3] > 0:
            return nums[2], nums[3]
    style = root.attrib.get("style", "")
    if "max-width:" in style:
        raw = style.split("max-width:", 1)[1].split(";", 1)[0].replace("px", "").strip()
        try:
            return float(raw), float(raw) * 0.5
        except ValueError:
            pass
    return 1600.0, 900.0


def render_svg(svg: Path, out: Path) -> None:
    if not svg.exists():
        raise FileNotFoundError(f"Missing SVG source: {svg}")
    w, h = svg_size(svg)
    max_w = 2200 if w / h >= 1.6 else 1500
    max_h = 3200
    scale = min(max_w / w, max_h / h, 1.6)
    target_w = max(900, int(w * scale))
    target_h = max(500, int(h * scale))
    profile = TEMP / f"edge-{out.stem}"
    wrapper = TEMP / f"{out.stem}.html"
    svg_uri = svg.resolve().as_uri()
    wrapper.write_text(
        "<!doctype html><html><head><meta charset='utf-8'>"
        "<style>html,body{margin:0;padding:0;background:#fff;}"
        f"img{{display:block;width:{target_w}px;height:auto;}}</style></head>"
        f"<body><img src='{svg_uri}'></body></html>",
        encoding="utf-8",
    )
    if out.exists():
        out.unlink()
    cmd = [
        str(edge_path()),
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--hide-scrollbars",
        "--allow-file-access-from-files",
        "--force-device-scale-factor=1",
        f"--user-data-dir={profile}",
        f"--window-size={target_w},{target_h}",
        f"--screenshot={out}",
        wrapper.resolve().as_uri(),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
    if not out.exists() or out.stat().st_size < 2000:
        raise RuntimeError(
            f"Edge failed to render {svg.name}: {result.stderr[-500:] or result.stdout[-500:]}"
        )
    print(f"rendered {svg.name} -> {out.name} ({target_w}x{target_h})")


def render_gantt(out: Path) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    labels = [p[0] for p in PHASES][::-1]
    durations = [p[1] for p in PHASES][::-1]
    starts = []
    cursor = 0
    for _, duration in PHASES:
        starts.append(cursor)
        cursor += duration
    starts = starts[::-1]
    fig, ax = plt.subplots(figsize=(12, 5.6))
    colors = ["#4472C4", "#70AD47", "#ED7D31", "#A5A5A5", "#5B9BD5",
              "#FFC000", "#264478", "#9E480E"]
    for i, (label, start, duration) in enumerate(zip(labels, starts, durations)):
        ax.barh(i, duration, left=start, height=0.58, color=colors[i % len(colors)])
        ax.text(start + duration + 0.25, i, f"{duration} wk", va="center", fontsize=10)
    ax.set_yticks(range(len(labels)), labels)
    ax.set_xlabel("Planned duration (weeks, relative sequence)")
    ax.set_xlim(0, cursor + 3)
    ax.grid(axis="x", linestyle="--", alpha=0.35)
    ax.set_title("EventFlow Project Timeline (relative plan from approved template)")
    fig.tight_layout()
    fig.savefig(out, dpi=170, bbox_inches="tight")
    plt.close(fig)
    print(f"rendered {out.name} from documented phase durations")


def render_placeholder(out: Path) -> None:
    from PIL import Image, ImageDraw

    img = Image.new("RGB", (1200, 520), "white")
    draw = ImageDraw.Draw(img)
    draw.rectangle((24, 24, 1176, 496), outline="#777777", width=3)
    draw.text((80, 190), "APPLICATION SCREENSHOT PLACEHOLDER",
              fill="#333333", stroke_width=0)
    draw.text((80, 250), "No verified application screenshot exists in the repository.",
              fill="#555555")
    draw.text((80, 300), "This frame is intentionally labelled and is not a product mockup.",
              fill="#555555")
    img.save(out)
    print(f"rendered {out.name} (labelled placeholder)")


def copy_sources() -> None:
    SOURCES.mkdir(parents=True, exist_ok=True)
    for path in sorted(SVG_DIR.glob("*.svg")):
        shutil.copy2(path, SOURCES / path.name)
    for path in sorted((REPO / "uml-exhaustive").glob("final/*.mmd")):
        shutil.copy2(path, SOURCES / path.name)
    print(f"copied {len(list(SOURCES.iterdir()))} original diagram sources")


def write_manifest() -> None:
    lines = [
        "# Documentation Asset Manifest",
        "",
        "All diagram PNGs below were rendered directly from the repository's final UML sources "
        "using headless Microsoft Edge. No diagram was redrawn or inferred.",
        "",
        "| Asset | Source | Status |",
        "| --- | --- | --- |",
    ]
    for name, src in DIAGRAMS.items():
        lines.append(f"| `{name}` | `{src.relative_to(REPO)}` | Rendered from SVG |")
    lines.append("| `gantt.png` | Phase durations in the approved documentation template | Generated from documented durations; no calendar dates supplied |")
    lines.append("| `screenshot_placeholder.png` | Repository inspection | Labelled placeholder; no verified application screenshot exists |")
    lines += [
        "",
        "Original SVG and Mermaid sources are preserved in `assets/sources/` for traceability.",
        "",
    ]
    (ASSETS / "ASSET_MANIFEST.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    copy_sources()
    for name, svg in DIAGRAMS.items():
        render_svg(svg, ASSETS / name)
    render_gantt(ASSETS / "gantt.png")
    render_placeholder(ASSETS / "screenshot_placeholder.png")
    write_manifest()
    print(f"Assets ready in {ASSETS}")


if __name__ == "__main__":
    main()
