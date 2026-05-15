"""
Cost report PDF generator.

Generates a per-case cost report PDF styled to match the intake PDF reports.
Uses WeasyPrint to render HTML/CSS to PDF.
"""

from io import BytesIO
from html import escape
from datetime import datetime
from lib.tz import LA


def generate_cost_report_pdf(
    case_name: str,
    invoices: list[dict],
    cost_summary: dict,
    cost_sharing: dict,
) -> BytesIO:
    from weasyprint import HTML

    html = _build_html(case_name, invoices, cost_summary, cost_sharing)
    buf = BytesIO()
    HTML(string=html).write_pdf(buf)
    buf.seek(0)
    return buf


def _build_html(
    case_name: str,
    invoices: list[dict],
    cost_summary: dict,
    cost_sharing: dict,
) -> str:
    now = datetime.now(LA)
    date_str = now.strftime('%B %d, %Y')

    real_invoices = [inv for inv in invoices if not inv.get('is_transfer')]
    transfers = [inv for inv in invoices if inv.get('is_transfer')]

    unpaid = [inv for inv in real_invoices if inv.get('status') == 'unpaid']
    paid = [inv for inv in real_invoices if inv.get('status') == 'paid']

    total_count = len(real_invoices)
    subtitle = f'{total_count} invoice{"s" if total_count != 1 else ""}'

    is_advanced = cost_sharing.get('kind') == 'advanced'
    partner = cost_sharing.get('partner')
    our_pct = cost_sharing.get('our_pct')
    has_sharing = is_advanced or (partner is not None and our_pct is not None)

    summary_html = _render_summary(cost_summary, cost_sharing)

    sections = []

    if unpaid:
        rows = '\n'.join(_render_row(inv, idx) for idx, inv in enumerate(unpaid))
        unpaid_total = sum(_effective_amount(inv) for inv in unpaid)
        sections.append(f"""
        <div class="section">
          <div class="section-header">
            <h2 class="section-title">Unpaid ({len(unpaid)})</h2>
            <span class="section-total">{_fmt_money(unpaid_total)}</span>
          </div>
          <table class="cost-table">
            <thead><tr>
              <th>Date</th>
              <th>Category</th>
              <th>Payee</th>
              <th>Description</th>
              <th class="amt-header">Amount</th>
              <th>Due Date</th>
            </tr></thead>
            <tbody>{rows}</tbody>
          </table>
        </div>""")

    if paid:
        rows = '\n'.join(_render_row(inv, idx, show_paid_by=has_sharing) for idx, inv in enumerate(paid))
        paid_total = sum(_effective_amount(inv) for inv in paid)
        paid_cols = """
              <th>Date</th>
              <th>Category</th>
              <th>Payee</th>
              <th>Description</th>
              <th class="amt-header">Amount</th>"""
        if has_sharing:
            paid_cols += '\n              <th>Paid By</th>'
        paid_cols += '\n              <th>Paid Date</th>'
        paid_cols += '\n              <th>Check #</th>'
        sections.append(f"""
        <div class="section">
          <div class="section-header">
            <h2 class="section-title">Paid ({len(paid)})</h2>
            <span class="section-total">{_fmt_money(paid_total)}</span>
          </div>
          <table class="cost-table">
            <thead><tr>{paid_cols}
            </tr></thead>
            <tbody>{rows}</tbody>
          </table>
        </div>""")

    if has_sharing and transfers:
        transfer_rows = '\n'.join(_render_transfer_row(inv, idx) for idx, inv in enumerate(transfers))
        sections.append(f"""
        <div class="section">
          <div class="section-header">
            <h2 class="section-title">Transfers ({len(transfers)})</h2>
          </div>
          <table class="cost-table">
            <thead><tr>
              <th>Date</th>
              <th>From</th>
              <th>To</th>
              <th>Description</th>
              <th class="amt-header">Amount</th>
              <th>Check #</th>
            </tr></thead>
            <tbody>{transfer_rows}</tbody>
          </table>
        </div>""")

    if real_invoices:
        breakdown_html = _render_category_breakdown(real_invoices)
        sections.append(breakdown_html)

    sections_str = '\n'.join(sections)

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
{_get_css()}
</style>
</head>
<body>

<div class="report-header">
  <div>
    <div class="report-title">Cost Report</div>
    <div class="report-case">{escape(case_name)}</div>
  </div>
  <div class="report-meta">{date_str} &middot; {subtitle}</div>
</div>

{summary_html}

{sections_str}

</body>
</html>"""


def _render_summary(cost_summary: dict, cost_sharing: dict) -> str:
    total = cost_summary.get('total_costs', 0)

    # Advanced (N parties): render per-party rows from cost_summary['parties'].
    if cost_summary.get('kind') == 'advanced' and cost_summary.get('parties'):
        parties = cost_summary['parties']
        items = [f"""
        <div class="summary-item">
          <span class="summary-label">Total Costs</span>
          <span class="summary-value">{_fmt_money(total)}</span>
        </div>"""]
        owes_lines = []
        for p in parties:
            label = p.get('label') or p.get('party_id', '')
            net_paid = float(p.get('net_paid', 0))
            target = float(p.get('target', 0))
            pct = (target / total * 100) if total > 0 else 0
            items.append(f"""<div class="summary-sep"></div>
        <div class="summary-item">
          <span class="summary-label">{escape(label)} ({pct:.0f}%)</span>
          <span class="summary-value">{_fmt_money(net_paid)}</span>
        </div>""")
            diff = net_paid - target
            if diff > 0.01:
                owes_lines.append(
                    f'<div class="owes-line owes-danger">{escape(label)} is owed {_fmt_money(diff)}</div>'
                )
        return f"""
    <div class="summary-bar">
      {''.join(items)}
    </div>
    {''.join(owes_lines)}"""

    # Simple (legacy 2-party).
    partner = cost_sharing.get('partner')
    our_pct = cost_sharing.get('our_pct')
    has_sharing = partner is not None and our_pct is not None

    if not has_sharing:
        return f"""
        <div class="summary-bar">
          <div class="summary-item">
            <span class="summary-label">Total Costs</span>
            <span class="summary-value">{_fmt_money(total)}</span>
          </div>
        </div>"""

    counsel_name = partner.get('name', 'Co-Counsel')
    counsel_pct = partner.get('cost_share_pct', 0)
    our_net = cost_summary.get('our_net', 0)
    counsel_net = cost_summary.get('counsel_net', 0)
    net_transferred = cost_summary.get('net_transferred', 0)

    our_target = total * (our_pct / 100.0)
    counsel_target = total * (counsel_pct / 100.0)
    our_diff = our_net - our_target

    owes_html = ''
    if abs(our_diff) > 0.01:
        if our_diff > 0:
            owes_html = f'<div class="owes-line owes-danger">{escape(counsel_name)} owes Our Firm {_fmt_money(abs(our_diff))}</div>'
        else:
            owes_html = f'<div class="owes-line owes-danger">Our Firm owes {escape(counsel_name)} {_fmt_money(abs(our_diff))}</div>'

    return f"""
    <div class="summary-bar">
      <div class="summary-item">
        <span class="summary-label">Total Costs</span>
        <span class="summary-value">{_fmt_money(total)}</span>
      </div>
      <div class="summary-sep"></div>
      <div class="summary-item">
        <span class="summary-label">Our Firm ({our_pct:.0f}%)</span>
        <span class="summary-value">{_fmt_money(our_net)}</span>
      </div>
      <div class="summary-sep"></div>
      <div class="summary-item">
        <span class="summary-label">{escape(counsel_name)} ({counsel_pct:.0f}%)</span>
        <span class="summary-value">{_fmt_money(counsel_net)}</span>
      </div>
      {f'<div class="summary-sep"></div><div class="summary-item"><span class="summary-label">Net Transferred</span><span class="summary-value">{_fmt_money(abs(net_transferred))}</span></div>' if abs(net_transferred) > 0.01 else ''}
    </div>
    {owes_html}"""


def _render_row(inv: dict, idx: int, show_paid_by: bool = False) -> str:
    row_class = 'alt-row' if idx % 2 == 0 else ''
    is_paid = inv.get('status') == 'paid'

    date_str = _format_date(inv.get('date'))
    category = escape(inv.get('category') or '—')
    payee = escape(inv.get('payee_name') or '—')
    desc = escape(inv.get('description') or '—')
    amount = _effective_amount(inv)
    amount_str = _fmt_money(amount)

    case_amount = inv.get('case_amount')
    full_amount = inv.get('amount')
    if case_amount and full_amount and str(case_amount) != str(full_amount):
        amount_str += f' <span class="of-total">of {_fmt_money(float(full_amount))}</span>'

    cells = f"""
      <td class="date-col">{date_str}</td>
      <td>{category}</td>
      <td class="payee-col">{payee}</td>
      <td class="desc-col">{desc}</td>
      <td class="amt-col">{amount_str}</td>"""

    if is_paid:
        if show_paid_by:
            paid_by = escape(inv.get('paid_by_name') or 'Our Firm')
            cells += f'\n      <td>{paid_by}</td>'
        cells += f'\n      <td class="date-col">{_format_date(inv.get("paid_date"))}</td>'
        cells += f'\n      <td class="check-col">{escape(inv.get("check_number") or "—")}</td>'
    else:
        cells += f'\n      <td class="date-col">{_format_date(inv.get("due_date"))}</td>'

    return f'<tr class="{row_class}">{cells}\n    </tr>'


def _render_transfer_row(inv: dict, idx: int) -> str:
    row_class = 'alt-row' if idx % 2 == 0 else ''
    date_str = _format_date(inv.get('date'))
    from_name = escape(inv.get('paid_by_name') or 'Our Firm')
    to_name = escape(inv.get('transfer_to_name') or 'Our Firm')
    desc = escape(inv.get('description') or '—')
    amount = _effective_amount(inv)
    check = escape(inv.get('check_number') or '—')

    return f"""<tr class="{row_class} transfer-row">
      <td class="date-col">{date_str}</td>
      <td>{from_name}</td>
      <td>{to_name}</td>
      <td class="desc-col">{desc}</td>
      <td class="amt-col">{_fmt_money(amount)}</td>
      <td class="check-col">{check}</td>
    </tr>"""


def _render_category_breakdown(invoices: list[dict]) -> str:
    by_category: dict[str, float] = {}
    for inv in invoices:
        cat = inv.get('category') or 'Uncategorized'
        by_category[cat] = by_category.get(cat, 0) + _effective_amount(inv)

    sorted_cats = sorted(by_category.items(), key=lambda x: -x[1])
    total = sum(by_category.values())

    rows = []
    for idx, (cat, amt) in enumerate(sorted_cats):
        pct = (amt / total * 100) if total > 0 else 0
        row_class = 'alt-row' if idx % 2 == 0 else ''
        rows.append(f"""<tr class="{row_class}">
          <td>{escape(cat)}</td>
          <td class="amt-col">{_fmt_money(amt)}</td>
          <td class="pct-col">{pct:.1f}%</td>
        </tr>""")

    rows_str = '\n'.join(rows)
    return f"""
    <div class="section">
      <div class="section-header">
        <h2 class="section-title">Breakdown by Category</h2>
      </div>
      <table class="cost-table breakdown-table">
        <thead><tr>
          <th>Category</th>
          <th class="amt-header">Amount</th>
          <th class="pct-header">%</th>
        </tr></thead>
        <tbody>{rows_str}</tbody>
        <tfoot><tr class="total-row">
          <td><strong>Total</strong></td>
          <td class="amt-col"><strong>{_fmt_money(total)}</strong></td>
          <td class="pct-col"><strong>100%</strong></td>
        </tr></tfoot>
      </table>
    </div>"""


def _effective_amount(inv: dict) -> float:
    ca = inv.get('case_amount')
    a = inv.get('amount')
    val = ca if ca else a
    if val is None:
        return 0.0
    return float(val)


def _fmt_money(amount: float) -> str:
    return f'${amount:,.2f}'


def _format_date(val) -> str:
    if not val:
        return '—'
    try:
        if isinstance(val, str):
            d = datetime.strptime(val[:10], '%Y-%m-%d').date()
        else:
            d = val
        return d.strftime('%b %-d, %Y')
    except (ValueError, TypeError):
        return str(val)


def _get_css() -> str:
    return """
    @page {
      size: letter portrait;
      margin: 0.4in 0.625in;
      @bottom-right {
        content: counter(page);
        font-family: 'Inter', 'Helvetica Neue', sans-serif;
        font-size: 11px;
        color: #94a3b8;
      }
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', 'Helvetica Neue', 'Segoe UI', sans-serif;
      font-size: 12px;
      color: #0f172a;
      line-height: 1.4;
    }

    /* === Report header === */
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 6px;
      margin-bottom: 10px;
    }
    .report-title { font-size: 20px; font-weight: 700; color: #0f172a; }
    .report-case { font-size: 13px; color: #475569; margin-top: 2px; }
    .report-meta { font-size: 12px; color: #94a3b8; }

    /* === Summary bar === */
    .summary-bar {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 8px 12px;
      margin-bottom: 6px;
    }
    .summary-item { display: flex; flex-direction: column; }
    .summary-label {
      font-size: 10px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .summary-value {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      font-family: 'JetBrains Mono', 'SF Mono', monospace;
    }
    .summary-detail {
      font-size: 10px;
      color: #64748b;
      margin-top: 1px;
    }
    .summary-sep {
      width: 1px;
      align-self: stretch;
      background: #e2e8f0;
    }

    .owes-line {
      font-size: 11px;
      font-weight: 600;
      padding: 4px 12px;
      margin-bottom: 8px;
    }
    .owes-danger {
      background: #fee2e2;
      color: #dc2626;
      border: 1px solid #fecaca;
    }

    /* === Sections === */
    .section { margin-top: 14px; }
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 3px;
      margin-bottom: 4px;
    }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .section-total {
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
      font-family: 'JetBrains Mono', 'SF Mono', monospace;
    }

    /* === Cost table === */
    .cost-table {
      width: 100%;
      border-collapse: collapse;
    }
    .cost-table thead tr { background: #0f172a; }
    .cost-table th {
      padding: 3px 5px;
      text-align: left;
      font-size: 10px;
      font-weight: 600;
      color: #fff;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .cost-table td {
      padding: 3px 5px;
      font-size: 11px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: middle;
    }
    .cost-table .alt-row { background: #f8fafc; }

    .cost-table .total-row td {
      border-top: 2px solid #0f172a;
      border-bottom: none;
      padding-top: 4px;
    }

    /* Column styles */
    .date-col {
      white-space: nowrap;
      color: #475569;
      font-size: 11px;
    }
    .payee-col { font-weight: 600; max-width: 160px; }
    .desc-col {
      color: #64748b;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .amt-col {
      text-align: right;
      font-family: 'JetBrains Mono', 'SF Mono', monospace;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
    }
    .amt-header { text-align: right; }
    .pct-col {
      text-align: right;
      font-family: 'JetBrains Mono', 'SF Mono', monospace;
      font-size: 11px;
      color: #64748b;
    }
    .pct-header { text-align: right; }
    .check-col {
      font-family: 'JetBrains Mono', 'SF Mono', monospace;
      font-size: 10px;
      color: #64748b;
    }
    .of-total {
      font-size: 9px;
      font-weight: 400;
      color: #94a3b8;
    }

    .transfer-row { background: #faf5ff !important; }
    .transfer-row.alt-row { background: #f5f0ff !important; }

    .breakdown-table { max-width: 400px; }

    .em { color: #cbd5e1; }
    """
