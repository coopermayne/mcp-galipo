"""
Build the DOCX template for case report export.

Generates templates/exports/case_report_template.docx programmatically
using python-docx. The template contains Jinja2 tags that docxtpl renders
at export time with real case data and RichText objects.

Run:  python scripts/build_docx_template.py
"""

from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, Emu, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn, nsdecls
from docx.oxml import parse_xml, OxmlElement

OUTPUT = Path(__file__).parent.parent / "templates" / "exports" / "case_report_template.docx"

# Colors
NAVY = RGBColor(0x0F, 0x17, 0x2A)
GREY = RGBColor(0x94, 0xA3, 0xB8)
DARK_GREY = RGBColor(0x47, 0x55, 0x69)
BLUE = RGBColor(0x2F, 0x4F, 0xF5)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
NAVY_HEX = "0F172A"
GREY_BORDER = "E2E8F0"
LIGHT_BG = "F8FAFC"


def set_cell_shading(cell, color_hex):
    """Set cell background color."""
    shading = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>')
    cell._tc.get_or_add_tcPr().append(shading)


def set_cell_borders(cell, top=None, bottom=None, left=None, right=None):
    """Set individual cell borders. Each arg is (color_hex, size_eighths)."""
    tc_pr = cell._tc.get_or_add_tcPr()
    borders = OxmlElement("w:tcBorders")
    for side, val in [("top", top), ("bottom", bottom), ("left", left), ("right", right)]:
        if val:
            color, sz = val
            el = OxmlElement(f"w:{side}")
            el.set(qn("w:val"), "single")
            el.set(qn("w:sz"), str(sz))
            el.set(qn("w:color"), color)
            el.set(qn("w:space"), "0")
            borders.append(el)
    tc_pr.append(borders)


def set_cell_margins(cell, top=0, bottom=0, left=60, right=60):
    """Set cell margins in twips."""
    tc_pr = cell._tc.get_or_add_tcPr()
    margins = OxmlElement("w:tcMar")
    for side, val in [("top", top), ("bottom", bottom), ("start", left), ("end", right)]:
        el = OxmlElement(f"w:{side}")
        el.set(qn("w:w"), str(val))
        el.set(qn("w:type"), "dxa")
        margins.append(el)
    tc_pr.append(margins)


def set_cell_width(cell, inches):
    """Set preferred cell width."""
    tc_pr = cell._tc.get_or_add_tcPr()
    width = OxmlElement("w:tcW")
    width.set(qn("w:w"), str(int(inches * 1440)))
    width.set(qn("w:type"), "dxa")
    tc_pr.append(width)


def set_table_borders(table, color="E2E8F0", sz=4):
    """Set uniform borders on entire table."""
    tbl = table._tbl
    tbl_pr = tbl.tblPr if tbl.tblPr is not None else OxmlElement("w:tblPr")
    borders = OxmlElement("w:tblBorders")
    for side in ["top", "left", "bottom", "right", "insideH", "insideV"]:
        el = OxmlElement(f"w:{side}")
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), str(sz))
        el.set(qn("w:color"), color)
        el.set(qn("w:space"), "0")
        borders.append(el)
    tbl_pr.append(borders)


def remove_table_borders(table):
    """Remove all borders from a table."""
    tbl = table._tbl
    tbl_pr = tbl.tblPr if tbl.tblPr is not None else OxmlElement("w:tblPr")
    borders = OxmlElement("w:tblBorders")
    for side in ["top", "left", "bottom", "right", "insideH", "insideV"]:
        el = OxmlElement(f"w:{side}")
        el.set(qn("w:val"), "none")
        el.set(qn("w:sz"), "0")
        el.set(qn("w:color"), "auto")
        el.set(qn("w:space"), "0")
        borders.append(el)
    tbl_pr.append(borders)


def add_run(para, text, size=None, bold=False, italic=False, color=None, font_name=None):
    """Add a styled run to a paragraph."""
    run = para.add_run(text)
    if size:
        run.font.size = Pt(size)
    if bold:
        run.font.bold = True
    if italic:
        run.font.italic = True
    if color:
        run.font.color.rgb = color
    if font_name:
        run.font.name = font_name
    else:
        run.font.name = "Calibri"
    return run


def set_paragraph_spacing(para, before=0, after=0, line=None):
    """Set paragraph spacing in points."""
    fmt = para.paragraph_format
    fmt.space_before = Pt(before)
    fmt.space_after = Pt(after)
    if line:
        fmt.line_spacing = Pt(line)


def set_paragraph_border_bottom(para, color="E2E8F0", sz=4):
    """Add a bottom border to a paragraph."""
    p_pr = para._p.get_or_add_pPr()
    borders = OxmlElement("w:pBorders")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), str(sz))
    bottom.set(qn("w:color"), color)
    bottom.set(qn("w:space"), "1")
    borders.append(bottom)
    p_pr.append(borders)


def set_page_break_before(para):
    """Set page break before paragraph."""
    p_pr = para._p.get_or_add_pPr()
    pb = OxmlElement("w:pageBreakBefore")
    p_pr.append(pb)


def build_header_footer(doc):
    """Add header and footer to the default section."""
    section = doc.sections[0]
    # Header: right-aligned, 7pt grey
    header = section.header
    header.is_linked_to_previous = False
    hp = header.paragraphs[0]
    hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    add_run(hp, "{{ creation_date }} — {{ attorney_name }}'s Case Portfolio", size=7, color=GREY)

    # Footer: right-aligned page number
    footer = section.footer
    footer.is_linked_to_previous = False
    fp = footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = fp.add_run()
    run.font.size = Pt(7)
    run.font.color.rgb = GREY
    run.font.name = "Calibri"
    # Insert PAGE field
    fld_char_begin = OxmlElement("w:fldChar")
    fld_char_begin.set(qn("w:fldCharType"), "begin")
    run._r.append(fld_char_begin)
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " PAGE "
    run._r.append(instr)
    fld_char_end = OxmlElement("w:fldChar")
    fld_char_end.set(qn("w:fldCharType"), "end")
    run._r.append(fld_char_end)


def build_cover_page(doc):
    """Build the cover page with title and summary table."""
    # Title
    title_p = doc.add_paragraph()
    set_paragraph_spacing(title_p, after=2)
    add_run(title_p, "Active Case Portfolio", size=18, bold=True, color=NAVY)

    # Subtitle
    sub_p = doc.add_paragraph()
    set_paragraph_spacing(sub_p, after=1)
    add_run(sub_p, "{{ attorney_name }} — {{ creation_date }}", size=9, color=GREY)

    # Case count
    count_p = doc.add_paragraph()
    set_paragraph_spacing(count_p, after=4)
    add_run(count_p, "{{ case_count }} active matters", size=8, color=GREY)

    # Navy rule
    rule_p = doc.add_paragraph()
    set_paragraph_spacing(rule_p, after=6)
    set_paragraph_border_bottom(rule_p, color=NAVY_HEX, sz=8)

    # Summary table
    table = doc.add_table(rows=4, cols=6)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = True
    set_table_borders(table, color=GREY_BORDER, sz=2)

    # Set column widths (total ~7 inches for letter with 0.65 margins)
    col_widths = [1.6, 0.7, 1.1, 1.0, 1.3, 0.9]  # inches

    # Header row
    headers = ["Case", "Status", "Case No.", "Judge", "Clients", "DOI"]
    for i, h in enumerate(headers):
        cell = table.cell(0, i)
        set_cell_shading(cell, NAVY_HEX)
        set_cell_margins(cell, top=30, bottom=30, left=50, right=50)
        set_cell_width(cell, col_widths[i])
        p = cell.paragraphs[0]
        set_paragraph_spacing(p, before=0, after=0)
        add_run(p, h, size=7, bold=True, color=WHITE)

    # {%tr for case in cases %}
    for_cell = table.cell(1, 0)
    p = for_cell.paragraphs[0]
    set_paragraph_spacing(p, before=0, after=0)
    add_run(p, "{%tr for case in cases %}", size=8)
    for i in range(1, 6):
        c = table.cell(1, i)
        set_paragraph_spacing(c.paragraphs[0], before=0, after=0)

    # Data row with tags
    data_tags = [
        ("{{ case.short_name }}", 8, True, None, "Calibri"),
        ("{{ case.status }}", 8, False, None, "Calibri"),
        ("{{ case.case_number }}", 7.5, False, None, "Consolas"),
        ("{{ case.judge }}", 8, False, None, "Calibri"),
        ("{{ case.clients }}", 8, False, None, "Calibri"),
        ("{{ case.doi }}", 8, False, None, "Calibri"),
    ]
    for i, (tag, sz, bold, clr, font) in enumerate(data_tags):
        cell = table.cell(2, i)
        set_cell_margins(cell, top=20, bottom=20, left=50, right=50)
        set_cell_width(cell, col_widths[i])
        p = cell.paragraphs[0]
        set_paragraph_spacing(p, before=0, after=0)
        add_run(p, tag, size=sz, bold=bold, font_name=font)

    # {%tr endfor %}
    end_cell = table.cell(3, 0)
    p = end_cell.paragraphs[0]
    set_paragraph_spacing(p, before=0, after=0)
    add_run(p, "{%tr endfor %}", size=8)
    for i in range(1, 6):
        c = table.cell(3, i)
        set_paragraph_spacing(c.paragraphs[0], before=0, after=0)


def build_section_heading(doc, text):
    """Add a section heading like 'KEY DATES & EVENTS'."""
    p = doc.add_paragraph()
    set_paragraph_spacing(p, before=6, after=3)
    set_paragraph_border_bottom(p, color=GREY_BORDER, sz=2)
    add_run(p, text, size=9, bold=True, color=DARK_GREY)


def build_events_table(doc):
    """Build the events table with {%tr for} loop and RichText + cellbg."""
    table = doc.add_table(rows=4, cols=3)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = True
    set_table_borders(table, color=GREY_BORDER, sz=2)

    col_widths = [1.5, 3.5, 1.6]
    headers = ["Date", "Description", "Location"]

    # Header row
    for i, h in enumerate(headers):
        cell = table.cell(0, i)
        set_cell_shading(cell, NAVY_HEX)
        set_cell_margins(cell, top=25, bottom=25, left=50, right=50)
        set_cell_width(cell, col_widths[i])
        p = cell.paragraphs[0]
        set_paragraph_spacing(p, before=0, after=0)
        add_run(p, h, size=7, bold=True, color=WHITE)

    # {%tr for event in case.events %}
    p = table.cell(1, 0).paragraphs[0]
    set_paragraph_spacing(p, before=0, after=0)
    add_run(p, "{%tr for event in case.events %}", size=8)
    for i in range(1, 3):
        set_paragraph_spacing(table.cell(1, i).paragraphs[0], before=0, after=0)

    # Data row with RichText tags + cellbg
    data_cells = [
        ("{{r event.date_rt }}", 1.5),
        ("{{r event.desc_rt }}", 3.5),
        ("{{r event.loc_rt }}", 1.6),
    ]
    for i, (tag, w) in enumerate(data_cells):
        cell = table.cell(2, i)
        set_cell_margins(cell, top=15, bottom=15, left=50, right=50)
        set_cell_width(cell, w)
        p = cell.paragraphs[0]
        set_paragraph_spacing(p, before=0, after=0)
        # Add cellbg tag first in the cell
        add_run(p, "{% cellbg event.bg %}", size=8)
        add_run(p, tag, size=8)

    # {%tr endfor %}
    p = table.cell(3, 0).paragraphs[0]
    set_paragraph_spacing(p, before=0, after=0)
    add_run(p, "{%tr endfor %}", size=8)
    for i in range(1, 3):
        set_paragraph_spacing(table.cell(3, i).paragraphs[0], before=0, after=0)


def build_tasks_table(doc):
    """Build the tasks table with {%tr for} loop and RichText + cellbg."""
    table = doc.add_table(rows=4, cols=3)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = True
    set_table_borders(table, color=GREY_BORDER, sz=2)

    col_widths = [1.5, 3.8, 1.3]
    headers = ["Due Date", "Description", "Urgency"]

    # Header row
    for i, h in enumerate(headers):
        cell = table.cell(0, i)
        set_cell_shading(cell, NAVY_HEX)
        set_cell_margins(cell, top=25, bottom=25, left=50, right=50)
        set_cell_width(cell, col_widths[i])
        p = cell.paragraphs[0]
        set_paragraph_spacing(p, before=0, after=0)
        add_run(p, h, size=7, bold=True, color=WHITE)

    # {%tr for task in case.tasks %}
    p = table.cell(1, 0).paragraphs[0]
    set_paragraph_spacing(p, before=0, after=0)
    add_run(p, "{%tr for task in case.tasks %}", size=8)
    for i in range(1, 3):
        set_paragraph_spacing(table.cell(1, i).paragraphs[0], before=0, after=0)

    # Data row
    data_cells = [
        ("{{r task.date_rt }}", 1.5),
        ("{{r task.desc_rt }}", 3.8),
        ("{{r task.urgency_rt }}", 1.3),
    ]
    for i, (tag, w) in enumerate(data_cells):
        cell = table.cell(2, i)
        set_cell_margins(cell, top=15, bottom=15, left=50, right=50)
        set_cell_width(cell, w)
        p = cell.paragraphs[0]
        set_paragraph_spacing(p, before=0, after=0)
        add_run(p, "{% cellbg task.bg %}", size=8)
        add_run(p, tag, size=8)

    # {%tr endfor %}
    p = table.cell(3, 0).paragraphs[0]
    set_paragraph_spacing(p, before=0, after=0)
    add_run(p, "{%tr endfor %}", size=8)
    for i in range(1, 3):
        set_paragraph_spacing(table.cell(3, i).paragraphs[0], before=0, after=0)


def build_metadata_grid(doc):
    """Build the 2x3 metadata grid table."""
    table = doc.add_table(rows=2, cols=3)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = True
    set_table_borders(table, color=GREY_BORDER, sz=2)

    # Labels and value tags for the 2x3 grid
    grid = [
        [("CASE NO.", "{{ case.case_number }}", "Consolas"),
         ("JUDGE", "{{ case.judge }}", "Calibri"),
         ("DATE OF INJURY", "{{ case.doi }}", "Calibri")],
        [("JURISDICTION", "{{ case.jurisdiction }}", "Calibri"),
         ("OPP. COUNSEL", "{{ case.opp_counsel }}", "Calibri"),
         ("CLIENTS", "{{ case.clients }}", "Calibri")],
    ]

    col_width = 2.23  # ~6.7 / 3

    for row_idx, row_data in enumerate(grid):
        for col_idx, (label, tag, font) in enumerate(row_data):
            cell = table.cell(row_idx, col_idx)
            set_cell_shading(cell, LIGHT_BG)
            set_cell_margins(cell, top=30, bottom=30, left=60, right=60)
            set_cell_width(cell, col_width)

            # Label paragraph
            p_label = cell.paragraphs[0]
            set_paragraph_spacing(p_label, before=0, after=1)
            add_run(p_label, label, size=6.5, bold=True, color=GREY)

            # Value paragraph
            p_val = cell.add_paragraph()
            set_paragraph_spacing(p_val, before=0, after=0)
            add_run(p_val, tag, size=9, font_name=font)


def build_case_detail(doc):
    """Build the per-case detail section with all subsections."""
    # --- Case loop start ---
    loop_start = doc.add_paragraph()
    set_paragraph_spacing(loop_start, before=0, after=0)
    add_run(loop_start, "{% for case in cases %}", size=1, color=WHITE)

    # Page break (for each case after the first)
    # We use a conditional: first case no break, rest break
    break_p = doc.add_paragraph()
    set_paragraph_spacing(break_p, before=0, after=0)
    add_run(break_p, "{% if not loop.first %}", size=1, color=WHITE)

    # Actual page break paragraph
    pb_p = doc.add_paragraph()
    set_paragraph_spacing(pb_p, before=0, after=0)
    set_page_break_before(pb_p)
    add_run(pb_p, "{% endif %}", size=1, color=WHITE)

    # --- 1. Title bar ---
    title_p = doc.add_paragraph()
    set_paragraph_spacing(title_p, before=2, after=4)
    set_paragraph_border_bottom(title_p, color=NAVY_HEX, sz=6)
    add_run(title_p, "{{r case.title_rt }}", size=14)

    # --- 2. Metadata grid ---
    build_metadata_grid(doc)

    # --- 3. Other Proceedings (conditional) ---
    op_p = doc.add_paragraph()
    set_paragraph_spacing(op_p, before=4, after=2)
    add_run(op_p, "{% if case.other_proceedings %}", size=1, color=WHITE)

    op_content = doc.add_paragraph()
    set_paragraph_spacing(op_content, before=0, after=4)
    add_run(op_content, "Other Proceedings: ", size=8, bold=True, color=DARK_GREY)
    add_run(op_content, "{{ case.other_proceedings }}", size=8, font_name="Consolas")

    op_end = doc.add_paragraph()
    set_paragraph_spacing(op_end, before=0, after=0)
    add_run(op_end, "{% endif %}", size=1, color=WHITE)

    # --- 4. Case Summary (conditional) ---
    sum_if = doc.add_paragraph()
    set_paragraph_spacing(sum_if, before=0, after=0)
    add_run(sum_if, "{% if case.summary %}", size=1, color=WHITE)

    sum_p = doc.add_paragraph()
    set_paragraph_spacing(sum_p, before=2, after=6)
    # Blue left border accent
    p_pr = sum_p._p.get_or_add_pPr()
    borders = OxmlElement("w:pBorders")
    left_b = OxmlElement("w:left")
    left_b.set(qn("w:val"), "single")
    left_b.set(qn("w:sz"), "12")
    left_b.set(qn("w:color"), "4771FF")
    left_b.set(qn("w:space"), "4")
    borders.append(left_b)
    p_pr.append(borders)
    add_run(sum_p, "{{ case.summary }}", size=8, italic=True, color=DARK_GREY)

    sum_end = doc.add_paragraph()
    set_paragraph_spacing(sum_end, before=0, after=0)
    add_run(sum_end, "{% endif %}", size=1, color=WHITE)

    # --- 5. Key Dates & Events ---
    ev_if = doc.add_paragraph()
    set_paragraph_spacing(ev_if, before=0, after=0)
    add_run(ev_if, "{% if case.has_events %}", size=1, color=WHITE)

    build_section_heading(doc, "KEY DATES & EVENTS")
    build_events_table(doc)

    ev_end = doc.add_paragraph()
    set_paragraph_spacing(ev_end, before=0, after=0)
    add_run(ev_end, "{% endif %}", size=1, color=WHITE)

    # --- 6. Open Tasks ---
    tk_if = doc.add_paragraph()
    set_paragraph_spacing(tk_if, before=0, after=0)
    add_run(tk_if, "{% if case.has_tasks %}", size=1, color=WHITE)

    build_section_heading(doc, "OPEN TASKS")
    build_tasks_table(doc)

    tk_end = doc.add_paragraph()
    set_paragraph_spacing(tk_end, before=0, after=0)
    add_run(tk_end, "{% endif %}", size=1, color=WHITE)

    # --- 7. Recent Notes ---
    nt_if = doc.add_paragraph()
    set_paragraph_spacing(nt_if, before=0, after=0)
    add_run(nt_if, "{% if case.notes %}", size=1, color=WHITE)

    build_section_heading(doc, "RECENT NOTES")

    # Notes loop (paragraph-level, not table)
    nt_loop = doc.add_paragraph()
    set_paragraph_spacing(nt_loop, before=0, after=0)
    add_run(nt_loop, "{% for note in case.notes %}", size=1, color=WHITE)

    # Note date label
    note_date_p = doc.add_paragraph()
    set_paragraph_spacing(note_date_p, before=2, after=1)
    add_run(note_date_p, "{{ note.date }}", size=7, bold=True, color=GREY)

    # Note content with left border accent
    note_content_p = doc.add_paragraph()
    set_paragraph_spacing(note_content_p, before=0, after=3)
    p_pr2 = note_content_p._p.get_or_add_pPr()
    borders2 = OxmlElement("w:pBorders")
    left_b2 = OxmlElement("w:left")
    left_b2.set(qn("w:val"), "single")
    left_b2.set(qn("w:sz"), "8")
    left_b2.set(qn("w:color"), GREY_BORDER)
    left_b2.set(qn("w:space"), "4")
    borders2.append(left_b2)
    p_pr2.append(borders2)
    add_run(note_content_p, "{{ note.content }}", size=8, color=DARK_GREY)

    nt_loop_end = doc.add_paragraph()
    set_paragraph_spacing(nt_loop_end, before=0, after=0)
    add_run(nt_loop_end, "{% endfor %}", size=1, color=WHITE)

    nt_end = doc.add_paragraph()
    set_paragraph_spacing(nt_end, before=0, after=0)
    add_run(nt_end, "{% endif %}", size=1, color=WHITE)

    # --- End case loop ---
    loop_end = doc.add_paragraph()
    set_paragraph_spacing(loop_end, before=0, after=0)
    add_run(loop_end, "{% endfor %}", size=1, color=WHITE)


def build():
    """Build the complete template document."""
    doc = Document()

    # Page setup
    section = doc.sections[0]
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    section.top_margin = Inches(0.6)
    section.bottom_margin = Inches(0.5)
    section.left_margin = Inches(0.65)
    section.right_margin = Inches(0.65)

    # Default font
    style = doc.styles["Normal"]
    font = style.font
    font.name = "Calibri"
    font.size = Pt(9)
    font.color.rgb = NAVY
    style.paragraph_format.space_before = Pt(0)
    style.paragraph_format.space_after = Pt(0)

    # Header & footer
    build_header_footer(doc)

    # Cover page
    build_cover_page(doc)

    # Per-case detail pages
    build_case_detail(doc)

    # Save
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(OUTPUT))
    print(f"Template saved to {OUTPUT}")


if __name__ == "__main__":
    build()
