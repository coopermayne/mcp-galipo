"""
RFP Response document generator.

Generates formatted DOCX responses to Requests for Production using docxtpl.
"""

from io import BytesIO
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional, List

from docxtpl import DocxTemplate

TEMPLATES_DIR = Path(__file__).parent.parent / "templates" / "rfp"


@dataclass
class RFPRequestData:
    """Data for a single RFP request in the response document."""
    number: int = 0
    text: str = ""
    objections: List[str] = field(default_factory=list)  # List of formal_language strings
    will_produce: bool = False
    withheld_on_objections: bool = False


@dataclass
class RFPContext:
    """Context data for rendering an RFP response document."""

    # Court info
    court_name: str = ""
    case_no: str = ""

    # Parties (caption)
    header_plaintiffs: str = ""
    header_defendants: str = ""
    multiple_plaintiffs: bool = False
    multiple_defendants: bool = False

    # RFP-specific
    propounding_party: str = ""
    responding_party: str = ""
    set_number: str = "One"
    document_title: str = ""

    # Attorney info
    firm_name: str = "LAW OFFICES OF DALE K. GALIPO"
    associate_name: str = ""
    associate_bar: str = ""
    associate_email: str = ""
    firm_address: str = "21800 Burbank Boulevard, Suite 310"
    firm_city_state_zip: str = "Woodland Hills, California 91367"
    firm_phone: str = "(818) 347-3333"
    firm_fax: str = "(818) 347-4118"

    # Requests
    requests: List[RFPRequestData] = field(default_factory=list)

    def to_dict(self) -> dict:
        """Convert to dictionary for template rendering."""
        return {
            "court_name": self.court_name,
            "case_no": self.case_no,
            "header_plaintiffs": self.header_plaintiffs,
            "header_defendants": self.header_defendants,
            "multiple_plaintiffs": self.multiple_plaintiffs,
            "multiple_defendants": self.multiple_defendants,
            "propounding_party": self.propounding_party,
            "responding_party": self.responding_party,
            "set_number": self.set_number,
            "document_title": self.document_title or f"RESPONSES TO REQUEST FOR PRODUCTION OF DOCUMENTS, SET {self.set_number.upper()}",
            "firm_name": self.firm_name,
            "associate_name": self.associate_name,
            "associate_bar": self.associate_bar,
            "associate_email": self.associate_email,
            "firm_address": self.firm_address,
            "firm_city_state_zip": self.firm_city_state_zip,
            "firm_phone": self.firm_phone,
            "firm_fax": self.firm_fax,
            "requests": [
                {
                    "number": req.number,
                    "question": req.text,
                    "response": _build_response_text(req, self.responding_party),
                }
                for req in self.requests
            ],
            "date_formatted": datetime.now().strftime("%B %d, %Y"),
            "year": datetime.now().year,
        }


def _build_response_text(req: RFPRequestData, responding_party: str) -> str:
    """Build the response text for a single request."""
    parts = []

    if req.objections:
        objection_text = " ".join(req.objections)
        parts.append(objection_text)

    if req.will_produce and req.objections:
        parts.append(
            f"Subject to and without waiving the foregoing objections, "
            f"{responding_party} will produce all responsive, non-privileged "
            f"documents in their possession, custody, or control."
        )
    elif req.will_produce and not req.objections:
        parts.append(
            f"{responding_party} will produce all responsive, non-privileged "
            f"documents in their possession, custody, or control."
        )
    elif req.withheld_on_objections and req.objections:
        parts.append(
            f"Based on the foregoing objections, {responding_party} declines "
            f"to produce documents responsive to this request."
        )
    elif not req.objections and not req.will_produce:
        parts.append(
            f"{responding_party} responds that there are no documents "
            f"responsive to this request in their possession, custody, or control."
        )

    return "\n\n".join(parts)


def generate_rfp_response(
    context: RFPContext,
    template_name: str = "rfp_response.docx",
) -> BytesIO:
    """
    Generate an RFP response document from template and context.

    Args:
        context: RFPContext with all document data
        template_name: Name of the template file in templates/rfp/

    Returns:
        BytesIO containing the rendered .docx file
    """
    template_path = TEMPLATES_DIR / template_name

    if not template_path.exists():
        raise FileNotFoundError(f"Template not found: {template_path}")

    doc = DocxTemplate(str(template_path))
    ctx = context.to_dict()
    doc.render(ctx)

    buf = BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf
