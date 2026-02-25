"""
Pleading document generator with modular fragment support.

Generates legal pleadings using a base template and optional subdocument
fragments (notice, meet & confer, TOC, TOA, certificate of compliance)
that are conditionally included based on user selection.
"""

import tempfile
from io import BytesIO
from datetime import datetime
from pathlib import Path
from typing import Optional
from dataclasses import dataclass

from docxtpl import DocxTemplate

TEMPLATES_DIR = Path(__file__).parent.parent / "templates" / "pleadings"
FRAGMENTS_DIR = TEMPLATES_DIR / "fragments"

# Fragment files for each optional section
FRAGMENT_FILES = {
    "notice": "notice.docx",
    "meet_confer": "meet_confer.docx",
    "toc": "toc.docx",
    "toa": "toa.docx",
    "memo": "memo.docx",
    "declaration": "declaration.docx",
    "joint_stip": "joint_stip.docx",
    "generic": "generic.docx",
    "cert_compliance": "cert_compliance.docx",
}


@dataclass
class PleadingContext:
    """Context data for rendering a pleading document."""

    # Court and case info
    court_name: str = ""
    case_number: str = ""
    judge_name: str = ""
    mag_judge_name: str = ""

    # Parties
    plaintiff_caption: str = ""
    defendant_caption: str = ""
    multiple_plaintiffs: bool = False
    multiple_defendants: bool = False

    # Document info
    document_title: str = ""

    # Hearing info (optional)
    hearing_date: Optional[str] = None
    hearing_time: Optional[str] = None
    hearing_location: Optional[str] = None

    # Attorney info
    firm_name: str = "LAW OFFICES OF DALE K. GALIPO"
    attorney_name: str = ""
    associate_name: str = ""
    bar_number: str = ""
    attorney_email: str = ""
    firm_address: str = "21800 Burbank Boulevard, Suite 310"
    firm_city_state_zip: str = "Woodland Hills, California 91367"
    firm_phone: str = "(818) 347-3333"
    firm_fax: str = "(818) 347-4118"

    # Section toggles
    include_notice: bool = False
    include_meet_confer: bool = False
    include_toc: bool = True
    include_toa: bool = True
    include_memo: bool = True
    include_declaration: bool = False
    include_joint_stip: bool = False
    include_generic: bool = False
    include_cert_compliance: bool = False
    include_proof_of_service: bool = False

    # Content sections (for the memo body)
    introduction: str = ""
    legal_standard: str = ""
    argument: str = ""
    conclusion: str = ""

    def to_dict(self) -> dict:
        """Convert to dictionary for template rendering."""
        return {
            # Court and case
            "court_name": self.court_name,
            "case_number": self.case_number,
            "judge_name": self.judge_name,
            "mag_judge_name": self.mag_judge_name,

            # Parties
            "plaintiff_caption": self.plaintiff_caption,
            "defendant_caption": self.defendant_caption,
            "multiple_plaintiffs": self.multiple_plaintiffs,
            "multiple_defendants": self.multiple_defendants,

            # Document
            "document_title": self.document_title,

            # Hearing
            "hearing_info": bool(self.hearing_date),
            "hearing_date": self.hearing_date or "",
            "hearing_time": self.hearing_time or "",
            "hearing_location": self.hearing_location or "",

            # Attorney
            "firm_name": self.firm_name,
            "attorney_name": self.attorney_name,
            "associate_name": self.associate_name,
            "bar_number": self.bar_number,
            "associate_bar": self.bar_number,
            "attorney_email": self.attorney_email,
            "associate_email": self.attorney_email,
            "firm_address": self.firm_address,
            "firm_city_state_zip": self.firm_city_state_zip,
            "firm_phone": self.firm_phone,
            "firm_fax": self.firm_fax,

            # Section toggles (names match Jinja2 conditionals in template)
            "include_notice": self.include_notice,
            "include_meet_confer": self.include_meet_confer,
            "include_toc": self.include_toc,
            "include_toa": self.include_toa,
            "include_memo": self.include_memo,
            "include_declaration": self.include_declaration,
            "include_joint_stip": self.include_joint_stip,
            "include_generic": self.include_generic,
            "include_cert_compliance": self.include_cert_compliance,
            "include_proof_of_service": self.include_proof_of_service,

            # Content
            "introduction": self.introduction,
            "legal_standard": self.legal_standard,
            "argument": self.argument,
            "conclusion": self.conclusion,

            # Computed
            "date_formatted": datetime.now().strftime("%B %d, %Y"),
            "year": datetime.now().year,
        }


def generate_pleading(
    context: PleadingContext,
    template_name: str = "base_subdoc.docx"
) -> BytesIO:
    """
    Generate a pleading document from template and context.

    Uses subdocuments for modular section inclusion. Each optional section
    (notice, meet_confer, toc, toa, cert_compliance) is loaded as a subdoc
    and conditionally included based on context flags.

    Args:
        context: PleadingContext with all document data
        template_name: Name of the template file in templates/pleadings/

    Returns:
        BytesIO containing the rendered .docx file
    """
    template_path = TEMPLATES_DIR / template_name

    if not template_path.exists():
        raise FileNotFoundError(f"Template not found: {template_path}")

    doc = DocxTemplate(str(template_path))

    # Build context dict
    ctx = context.to_dict()

    # Load subdocs for each section that's enabled.
    # Most fragments are pre-rendered (Jinja2 resolved) before insertion,
    # since docxtpl subdocs don't process template tags.
    # TOC and TOA are inserted directly (no pre-rendering) to preserve Word field codes.
    STATIC_FRAGMENTS = {"toc", "toa"}

    subdoc_mapping = {
        "notice": ("subdoc_notice", context.include_notice),
        "meet_confer": ("subdoc_meet_confer", context.include_meet_confer),
        "toc": ("subdoc_toc", context.include_toc),
        "toa": ("subdoc_toa", context.include_toa),
        "memo": ("subdoc_memo", context.include_memo),
        "declaration": ("subdoc_declaration", context.include_declaration),
        "joint_stip": ("subdoc_joint_stip", context.include_joint_stip),
        "generic": ("subdoc_generic", context.include_generic),
        "cert_compliance": ("subdoc_cert_compliance", context.include_cert_compliance),
    }

    temp_files = []
    try:
        for section_key, (subdoc_var, is_included) in subdoc_mapping.items():
            if is_included:
                fragment_path = FRAGMENTS_DIR / FRAGMENT_FILES[section_key]
                if fragment_path.exists():
                    if section_key in STATIC_FRAGMENTS:
                        # Insert directly to preserve Word field codes
                        subdoc = doc.new_subdoc(str(fragment_path))
                    else:
                        # Pre-render to resolve Jinja2 variables
                        frag_doc = DocxTemplate(str(fragment_path))
                        frag_doc.render(ctx)
                        tmp = tempfile.NamedTemporaryFile(suffix='.docx', delete=False)
                        frag_doc.save(tmp.name)
                        temp_files.append(tmp.name)
                        subdoc = doc.new_subdoc(tmp.name)
                    ctx[subdoc_var] = subdoc
                else:
                    ctx[subdoc_var] = ""
            else:
                ctx[subdoc_var] = ""

        # Render base template with subdocs
        doc.render(ctx)
    finally:
        import os
        for tmp_path in temp_files:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    buf = BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf


# Helper to create context from the Templates page data
def context_from_case_info(
    case_info: dict,
    signing_attorney: dict,
    document_name: str = "",
) -> PleadingContext:
    """
    Create a PleadingContext from the case info extracted on the Templates page.

    Args:
        case_info: Dict with court, case_number, plaintiffs, defendants, etc.
        signing_attorney: Dict with name, bar_number, email
        document_name: The title for the document being created (e.g., "Opposition to MSJ")

    Returns:
        PleadingContext ready for document generation
    """
    # Parse court name (may have newlines)
    court = case_info.get("court") or ""

    # Determine if multiple plaintiffs/defendants (look for semicolons, commas, "et al")
    plaintiffs = case_info.get("plaintiffs") or ""
    defendants = case_info.get("defendants") or ""
    multiple_plt = any(x in plaintiffs.lower() for x in [";", " and ", "et al"])
    multiple_def = any(x in defendants.lower() for x in [";", " and ", "et al"])

    # Use provided document_name, or fall back to motion_title from extraction
    title = document_name or case_info.get("motion_title") or ""

    # Auto-detect document type to set appropriate flags
    title_lower = title.lower()
    is_motion = "motion" in title_lower and "opposition" not in title_lower and "reply" not in title_lower
    is_reply = "reply" in title_lower

    return PleadingContext(
        court_name=court,
        case_number=case_info.get("case_number") or "",
        judge_name=case_info.get("judge") or "",
        mag_judge_name=case_info.get("magistrate_judge") or "",

        plaintiff_caption=plaintiffs,
        defendant_caption=defendants,
        multiple_plaintiffs=multiple_plt,
        multiple_defendants=multiple_def,

        document_title=title,

        hearing_date=case_info.get("hearing_date"),
        hearing_time=case_info.get("hearing_time"),
        hearing_location=case_info.get("courtroom"),

        associate_name=signing_attorney.get("name") or "",
        bar_number=signing_attorney.get("bar_number") or "",
        attorney_email=signing_attorney.get("email") or "",

        # Auto-configure based on document type
        include_notice=is_motion,
        include_meet_confer=is_motion,
        include_toc=not is_reply,
        include_toa=not is_reply,
        include_memo=True,
    )
