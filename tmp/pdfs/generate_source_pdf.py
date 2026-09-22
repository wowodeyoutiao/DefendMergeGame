from __future__ import annotations

import html
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "output" / "pdf"
OUTPUT_PATH = OUTPUT_DIR / "合战守格小游戏软件_V1.0_源代码.pdf"
SOFTWARE_NAME = "合战守格小游戏软件"
VERSION = "V1.0"
LINES_PER_PAGE = 50
FRONT_PAGES = 30
BACK_PAGES = 30
MAX_COLUMNS = 112
SOURCE_FILES = [ROOT / "index.html", ROOT / "styles.css", ROOT / "app.js"]


@dataclass(frozen=True)
class SourceLine:
    file_name: str
    line_number: int
    code: str


def display_width(text: str) -> int:
    return sum(2 if unicodedata.east_asian_width(char) in {"W", "F"} else 1 for char in text)


def split_to_width(text: str, width: int) -> list[str]:
    if display_width(text) <= width:
        return [text]
    chunks: list[str] = []
    remaining = text
    while remaining:
        current: list[str] = []
        current_width = 0
        last_break = -1
        for index, char in enumerate(remaining):
            char_width = 2 if unicodedata.east_asian_width(char) in {"W", "F"} else 1
            if current_width + char_width > width:
                break
            current.append(char)
            current_width += char_width
            if char in " ,;)}]>+-*/":
                last_break = index + 1
        else:
            chunks.append(remaining)
            break
        take = last_break if last_break >= max(12, len(current) // 2) else len(current)
        chunks.append(remaining[:take].rstrip())
        remaining = "  " + remaining[take:].lstrip()
    return chunks


def strip_comments(file_name: str, text: str) -> str:
    if file_name.endswith(".html"):
        return re.sub(r"<!--.*?-->", "", text, flags=re.DOTALL)
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)
    return "\n".join(line for line in text.splitlines() if not line.lstrip().startswith("//"))


def collect_source_lines() -> list[SourceLine]:
    source_lines: list[SourceLine] = []
    for source_path in SOURCE_FILES:
        original_text = source_path.read_text(encoding="utf-8")
        cleaned_text = strip_comments(source_path.name, original_text)
        original_lines = original_text.splitlines()
        cleaned_lookup = cleaned_text.splitlines()
        cleaned_index = 0
        in_html_comment = False
        in_block_comment = False

        for line_number, original_line in enumerate(original_lines, start=1):
            stripped = original_line.strip()
            if source_path.suffix == ".html":
                if "<!--" in original_line:
                    in_html_comment = "-->" not in original_line.split("<!--", 1)[1]
                    continue
                if in_html_comment:
                    if "-->" in original_line:
                        in_html_comment = False
                    continue
            else:
                if in_block_comment:
                    if "*/" in original_line:
                        in_block_comment = False
                    continue
                if "/*" in original_line:
                    in_block_comment = "*/" not in original_line.split("/*", 1)[1]
                    continue
                if stripped.startswith("//"):
                    continue
            if not stripped:
                continue
            if cleaned_index < len(cleaned_lookup):
                cleaned_index += 1
            normalized = html.unescape(original_line.rstrip()).replace("\t", "  ")
            for chunk in split_to_width(normalized, MAX_COLUMNS):
                source_lines.append(SourceLine(source_path.name, line_number, chunk))
    return source_lines


def register_fonts() -> tuple[str, str]:
    regular_path = Path(r"C:\Windows\Fonts\simsun.ttc")
    bold_path = Path(r"C:\Windows\Fonts\simhei.ttf")
    pdfmetrics.registerFont(TTFont("SourceCN", str(regular_path), subfontIndex=0))
    pdfmetrics.registerFont(TTFont("SourceCNBold", str(bold_path)))
    return "SourceCN", "SourceCNBold"


def select_submission_lines(all_lines: list[SourceLine]) -> list[SourceLine]:
    required = (FRONT_PAGES + BACK_PAGES) * LINES_PER_PAGE
    section_size = FRONT_PAGES * LINES_PER_PAGE
    if len(all_lines) < required:
        raise RuntimeError(f"有效源代码行数不足：需要 {required} 行，实际 {len(all_lines)} 行")
    front = all_lines[:section_size]
    back = all_lines[-section_size:]
    if front[-1] == back[0] or all_lines.index(back[0]) <= section_size - 1:
        raise RuntimeError("前后源代码摘录发生重叠")
    return front + back


def draw_pdf(lines: list[SourceLine], regular_font: str, bold_font: str) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    page_width, page_height = A4
    left_margin = 23
    right_margin = 23
    header_y = page_height - 24
    rule_y = page_height - 34
    code_top = page_height - 46
    footer_y = 16
    line_height = (code_top - 28) / LINES_PER_PAGE
    code_font_size = 6.35
    page_count = FRONT_PAGES + BACK_PAGES

    pdf = canvas.Canvas(str(OUTPUT_PATH), pagesize=A4, pageCompression=1)
    pdf.setTitle(f"{SOFTWARE_NAME} {VERSION} 源代码")
    pdf.setAuthor(SOFTWARE_NAME)
    pdf.setSubject("软件著作权登记源程序鉴别材料")

    for page_index in range(page_count):
        start = page_index * LINES_PER_PAGE
        page_lines = lines[start:start + LINES_PER_PAGE]
        section_name = "前30页" if page_index < FRONT_PAGES else "后30页"

        pdf.setFillColorRGB(0, 0, 0)
        pdf.setFont(bold_font, 9.2)
        pdf.drawString(left_margin, header_y, f"{SOFTWARE_NAME} {VERSION} 源程序")
        pdf.setFont(regular_font, 7.2)
        pdf.drawRightString(page_width - right_margin, header_y, section_name)
        pdf.setLineWidth(0.55)
        pdf.line(left_margin, rule_y, page_width - right_margin, rule_y)

        y = code_top
        for submission_line, source_line in enumerate(page_lines, start=1):
            absolute_line = start + submission_line
            prefix = f"{absolute_line:04d}  {source_line.file_name:<10} {source_line.line_number:04d}  "
            pdf.setFont(regular_font, code_font_size)
            pdf.drawString(left_margin, y, prefix + source_line.code)
            y -= line_height

        pdf.setLineWidth(0.35)
        pdf.line(left_margin, 25, page_width - right_margin, 25)
        pdf.setFont(regular_font, 7.2)
        pdf.drawString(left_margin, footer_y, "源代码鉴别材料")
        pdf.drawRightString(page_width - right_margin, footer_y, f"第 {page_index + 1} 页 / 共 {page_count} 页")
        pdf.showPage()

    pdf.save()


def main() -> None:
    all_lines = collect_source_lines()
    selected_lines = select_submission_lines(all_lines)
    regular_font, bold_font = register_fonts()
    draw_pdf(selected_lines, regular_font, bold_font)
    print(f"output={OUTPUT_PATH}")
    print(f"all_display_lines={len(all_lines)}")
    print(f"submission_lines={len(selected_lines)}")
    print(f"pages={len(selected_lines) // LINES_PER_PAGE}")


if __name__ == "__main__":
    main()
