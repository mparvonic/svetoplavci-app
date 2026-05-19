#!/usr/bin/env python3
import json
import re
import sys
import unicodedata
from pathlib import Path

import fitz


BLUE = (0 / 255, 32 / 255, 96 / 255)
BLACK = (0, 0, 0)
SUBJECT_RED = (230 / 255, 0 / 255, 0 / 255)
WHITE = (1, 1, 1)
STATUS_COLORS = {
    1: (214 / 255, 223 / 255, 240 / 255),
    2: (74 / 255, 90 / 255, 124 / 255),
    3: (14 / 255, 42 / 255, 92 / 255),
    4: (200 / 255, 55 / 255, 45 / 255),
}
FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial.ttf",
]


def clamp_status(value):
    try:
        return max(0, min(4, int(round(float(value)))))
    except Exception:
        return 0


def row_key(row):
    return (
        normalize_key(row.get("predmet") or ""),
        normalize_key(row.get("podpredmet") or ""),
        normalize_key(row.get("oblast") or ""),
    )


def is_in_map(row):
    return row.get("jeVMape") is not False


def normalize_key(value):
    normalized = unicodedata.normalize("NFKD", value)
    without_marks = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", " ", without_marks.lower()).strip()


def rect_from_box(box, inset=0.65):
    return fitz.Rect(
        box["x0"] + inset,
        box["y0"] + inset,
        box["x1"] - inset,
        box["y1"] - inset,
    )


def draw_box(page, box, color):
    page.draw_rect(
        rect_from_box(box),
        color=WHITE,
        fill=color,
        width=0.55,
        overlay=True,
    )


def draw_empty_box(page, box, outline_color=BLUE):
    rect = rect_from_box(box, inset=0.15)
    page.draw_rect(
        rect,
        color=outline_color,
        fill=WHITE,
        width=0.55,
        overlay=True,
    )


def clear_box(page, box):
    rect = rect_from_box(box, inset=-0.45)
    page.draw_rect(
        rect,
        color=WHITE,
        fill=WHITE,
        width=0,
        overlay=True,
    )


def stage1_chevron_points(box, index):
    x0, y0, x1, y1 = box["x0"], box["y0"], box["x1"], box["y1"]
    width = x1 - x0
    segment = width / 4.0
    mid_y = (y0 + y1) / 2.0
    inset_x = 0.75
    inset_y = 0.75
    notch = segment * 0.30
    left = x0 + index * segment + inset_x
    right = x0 + (index + 1) * segment - inset_x
    top = y0 + inset_y
    bottom = y1 - inset_y
    if index == 0:
        return [
            (left, top),
            (right, top),
            (right + notch, mid_y),
            (right, bottom),
            (left, bottom),
        ]
    return [
        (left - notch, top),
        (right, top),
        (right + notch, mid_y),
        (right, bottom),
        (left - notch, bottom),
        (left, mid_y),
    ]


def draw_stage1_chevrons(page, box, status):
    for i in range(status):
        page.draw_polyline(
            stage1_chevron_points(box, i),
            color=WHITE,
            fill=STATUS_COLORS[i + 1],
            width=1.05,
            closePath=True,
            overlay=True,
        )


def draw_name(page, geometry, child_name):
    name_spec = geometry.get("name")
    if not name_spec or name_spec.get("page") != 1:
        return
    font_path = next((candidate for candidate in FONT_CANDIDATES if Path(candidate).exists()), None)
    base_size = float(name_spec.get("size", 15))
    rect = fitz.Rect(
        float(name_spec["x"]),
        float(name_spec.get("y0", name_spec["y"] - base_size - 2)),
        float(name_spec.get("x1", page.rect.width - 12)),
        float(name_spec.get("y1", name_spec["y"] + base_size * 0.55)),
    )
    font_kwargs = (
        {"fontname": "DejaVuSans", "fontfile": font_path}
        if font_path
        else {"fontname": "helv"}
    )
    for step in range(13):
        size = max(8, base_size - step * 0.5)
        remaining = page.insert_textbox(
            rect,
            child_name,
            fontsize=size,
            color=SUBJECT_RED,
            overlay=True,
            **font_kwargs,
        )
        if remaining >= 0:
            return
    page.insert_textbox(
        rect,
        child_name,
        fontsize=8,
        color=SUBJECT_RED,
        overlay=True,
        **font_kwargs,
    )


def draw_individual(doc, geometry, rows_by_code):
    stage = geometry["stage"]
    for code, spec in geometry.get("individual", {}).items():
        row = rows_by_code.get(code)
        if not row or not is_in_map(row):
            continue
        status = clamp_status(row.get("status"))
        page = doc[spec["page"] - 1]
        if stage == "I_STUPEN":
            if status <= 0:
                continue
            draw_stage1_chevrons(page, spec["box"], status)
        else:
            for box in spec.get("boxes", []):
                draw_empty_box(page, box, BLACK)
            if status <= 0:
                continue
            for index, box in enumerate(spec.get("boxes", [])[:status]):
                draw_box(page, box, STATUS_COLORS[index + 1])


def draw_summary(doc, geometry, rows):
    statuses_by_group = {}
    for row in rows:
        if not row.get("kodLodicky") or not is_in_map(row):
            continue
        status = clamp_status(row.get("status"))
        statuses_by_group.setdefault(row_key(row), []).append(status)

    for group in geometry.get("summary", []):
        key = (
            normalize_key(group.get("predmet") or ""),
            normalize_key(group.get("podpredmet") or ""),
            normalize_key(group.get("oblast") or ""),
        )
        statuses = sorted(statuses_by_group.get(key, []), reverse=True)
        page = doc[group["page"] - 1]
        outline_color = BLACK if geometry.get("stage") == "II_STUPEN" else BLUE
        for box in group.get("boxes", []):
            clear_box(page, box)
        if not statuses:
            continue
        for status, box in zip(statuses, group.get("boxes", [])):
            if status > 0:
                draw_box(page, box, STATUS_COLORS[status])
            else:
                draw_empty_box(page, box, outline_color)


def rasterize_pdf(source_path, output_path, max_bytes):
    candidates = [
        (180, 75),
        (180, 65),
        (150, 75),
        (150, 65),
        (140, 65),
        (120, 75),
    ]
    best_path = None
    best_size = None
    source = Path(source_path)
    for dpi, quality in candidates:
        rendered = fitz.open(source)
        out = fitz.open()
        matrix = fitz.Matrix(dpi / 72, dpi / 72)
        for page in rendered:
            pixmap = page.get_pixmap(matrix=matrix, alpha=False)
            image_bytes = pixmap.tobytes("jpeg", jpg_quality=quality)
            image_page = out.new_page(width=page.rect.width, height=page.rect.height)
            image_page.insert_image(page.rect, stream=image_bytes)
        candidate_path = source.with_name(f"{source.stem}-{dpi}-{quality}.pdf")
        out.save(candidate_path, garbage=4, deflate=True)
        out.close()
        rendered.close()
        candidate_size = candidate_path.stat().st_size
        if best_size is None or candidate_size < best_size:
            if best_path and best_path.exists():
                best_path.unlink()
            best_path = candidate_path
            best_size = candidate_size
        else:
            candidate_path.unlink()
        if candidate_size <= max_bytes:
            best_path.replace(output_path)
            return
    if best_path:
        best_path.replace(output_path)


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: render-development-map-pdf.py payload.json")
    payload = json.loads(Path(sys.argv[1]).read_text())
    geometry = json.loads(Path(payload["geometryPath"]).read_text())
    rows = payload["rows"]
    rows_by_code = {row["kodLodicky"]: row for row in rows if row.get("kodLodicky")}

    output_path = Path(payload["outputPath"])
    vector_output_path = output_path.with_suffix(".vector.pdf")
    doc = fitz.open(payload["templatePath"])
    draw_name(doc[0], geometry, payload.get("childName") or "")
    draw_individual(doc, geometry, rows_by_code)
    draw_summary(doc, geometry, rows)
    doc.save(vector_output_path, garbage=4, deflate=True)
    doc.close()

    max_output_bytes = payload.get("maxOutputBytes")
    if max_output_bytes and vector_output_path.stat().st_size > max_output_bytes:
        rasterize_pdf(vector_output_path, output_path, int(max_output_bytes))
        vector_output_path.unlink(missing_ok=True)
    else:
        vector_output_path.replace(output_path)


if __name__ == "__main__":
    main()
