from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "output" / "pdf"
OUTPUT_PATH = OUTPUT_DIR / "合战守格小游戏软件_V1.0_用户手册草稿.pdf"
SOFTWARE_NAME = "合战守格小游戏软件"
VERSION = "V1.0"


def scaled_image(path: Path, max_width: float, max_height: float) -> Image:
    image = Image(str(path))
    scale = min(max_width / image.imageWidth, max_height / image.imageHeight)
    image.drawWidth = image.imageWidth * scale
    image.drawHeight = image.imageHeight * scale
    return image


def build_pdf() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    pdfmetrics.registerFont(TTFont("ManualCN", r"C:\Windows\Fonts\msyh.ttc", subfontIndex=0))
    pdfmetrics.registerFont(TTFont("ManualCNBold", r"C:\Windows\Fonts\simhei.ttf"))
    page_width, page_height = landscape(A4)
    doc = SimpleDocTemplate(
        str(OUTPUT_PATH),
        pagesize=(page_width, page_height),
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=11 * mm,
        bottomMargin=10 * mm,
        title=f"{SOFTWARE_NAME} {VERSION} 用户手册草稿",
        author=SOFTWARE_NAME,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "ManualTitle",
        parent=styles["Title"],
        fontName="ManualCNBold",
        fontSize=17,
        leading=21,
        textColor=colors.HexColor("#4d2d1c"),
        alignment=TA_CENTER,
        spaceAfter=2 * mm,
    )
    subtitle_style = ParagraphStyle(
        "ManualSubtitle",
        parent=styles["Normal"],
        fontName="ManualCN",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#76563d"),
        alignment=TA_CENTER,
    )
    section_style = ParagraphStyle(
        "Section",
        parent=styles["Heading2"],
        fontName="ManualCNBold",
        fontSize=10.5,
        leading=13,
        textColor=colors.HexColor("#8d3e25"),
        spaceBefore=0,
        spaceAfter=1.2 * mm,
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["BodyText"],
        fontName="ManualCN",
        fontSize=7.35,
        leading=10.3,
        textColor=colors.HexColor("#493527"),
        alignment=TA_LEFT,
    )
    caption_style = ParagraphStyle(
        "Caption",
        parent=styles["Normal"],
        fontName="ManualCN",
        fontSize=7.3,
        leading=9,
        textColor=colors.HexColor("#68452e"),
        alignment=TA_CENTER,
        spaceBefore=1.3 * mm,
    )
    footer_style = ParagraphStyle(
        "Footer",
        parent=body_style,
        fontSize=6.4,
        leading=8,
        textColor=colors.HexColor("#8b725a"),
        alignment=TA_CENTER,
    )

    story = [
        Paragraph(f"{SOFTWARE_NAME} {VERSION}", title_style),
        Paragraph("用户手册草稿｜功能说明与界面示意", subtitle_style),
        Spacer(1, 3 * mm),
    ]

    feature_data = [
        [Paragraph("软件定位", section_style), Paragraph("《合战守格小游戏软件》是一款竖版 Q 版卡通风格的消除塔防小游戏。玩家通过交换棋子形成横、竖或斜线消除，提升武将能力并守住防线。", body_style)],
        [Paragraph("主界面", section_style), Paragraph("顶部展示少主头像、金币、元宝和体力；中央展示当前关卡、敌情、三档宝箱目标与开始守城入口；底部常驻商店、武将、关卡、成长、包裹功能入口。关卡可通过左右箭头或左右滑动切换。", body_style)],
        [Paragraph("棋盘操作", section_style), Paragraph("拖动或点选两个棋子进行交换。三个及以上同等级、同类型棋子在横线、竖线或斜线上连续排列时自动消除；消除后的空位由棋盘下方补充，连锁过程中暂时锁定操作。", body_style)],
        [Paragraph("武将与道具", section_style), Paragraph("红剑、羽扇、岩甲通过同类棋子消除提升等级，并分别强化攻击范围、伤害或控制能力。宝箱返还步数，陷阱禁锢怪物，地雷造成一次性高额伤害。", body_style)],
        [Paragraph("战斗与成长", section_style), Paragraph("点击开始守城消耗体力进入出怪期。怪物沿路线移动，武将自动攻击；主角头像边框显示大招冷却，准备后可点击释放。关卡结算后获得金币，用于局外养成。", body_style)],
    ]
    feature_table = Table(feature_data, colWidths=[28 * mm, 238 * mm], hAlign="LEFT")
    feature_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f3dfb2")),
        ("BACKGROUND", (1, 0), (1, -1), colors.HexColor("#fff8e5")),
        ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#b98b52")),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#dfc58f")),
        ("LEFTPADDING", (0, 0), (-1, -1), 2.5 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2.5 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 1.6 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.6 * mm),
    ]))
    story.append(feature_table)
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph("界面示意", section_style))

    screenshots = [
        (ROOT / "demo-mobile.png", "战斗操作期：交换棋子并完成消除"),
        (ROOT / "demo-mobile-merge.png", "消除表现：武将升级与棋盘补位"),
        (ROOT / "demo-mobile-damage.png", "出怪战斗期：自动攻击与防线血量"),
    ]
    screenshot_cells = []
    for path, caption in screenshots:
        screenshot_cells.append([
            scaled_image(path, 80 * mm, 91 * mm),
            Paragraph(caption, caption_style),
        ])
    screenshot_table = Table([screenshot_cells], colWidths=[88 * mm, 88 * mm, 88 * mm], hAlign="CENTER")
    screenshot_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8edd1")),
        ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#b98b52")),
        ("INNERGRID", (0, 0), (-1, -1), 0.45, colors.HexColor("#dfc58f")),
        ("LEFTPADDING", (0, 0), (-1, -1), 2 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 2 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm),
    ]))
    story.append(screenshot_table)
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph("注：本页为功能与界面说明草稿，截图来自当前小游戏工程的试玩演示画面。软件名称和版本号须与申请表、源代码页眉保持一致。", footer_style))

    def draw_header_footer(pdf_canvas, _doc):
        pdf_canvas.saveState()
        pdf_canvas.setStrokeColor(colors.HexColor("#b98b52"))
        pdf_canvas.setLineWidth(0.5)
        pdf_canvas.line(14 * mm, page_height - 7 * mm, page_width - 14 * mm, page_height - 7 * mm)
        pdf_canvas.setFont("ManualCN", 6.5)
        pdf_canvas.setFillColor(colors.HexColor("#8b725a"))
        pdf_canvas.drawString(14 * mm, page_height - 5.2 * mm, f"{SOFTWARE_NAME} {VERSION}")
        pdf_canvas.drawRightString(page_width - 14 * mm, 5 * mm, "用户手册草稿")
        pdf_canvas.restoreState()

    doc.build(story, onFirstPage=draw_header_footer)
    print(f"output={OUTPUT_PATH}")
    print(f"pages=1")


if __name__ == "__main__":
    build_pdf()
