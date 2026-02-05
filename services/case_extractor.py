"""
Case information extraction service.

Uses Claude to extract structured case information from legal document text.
"""

import os
from anthropic import Anthropic
from typing import Optional


# Tool definition for case info extraction
EXTRACT_CASE_INFO_TOOL = {
    "name": "submit_case_info",
    "description": "Submit extracted case information from a legal document. Extract all available fields from the document text.",
    "input_schema": {
        "type": "object",
        "properties": {
            "court": {
                "type": "string",
                "description": "Full court name with line breaks preserved as they appear in the document (e.g., 'UNITED STATES DISTRICT COURT\\nCENTRAL DISTRICT OF CALIFORNIA'). Use \\n for line breaks."
            },
            "case_number": {
                "type": "string",
                "description": "The case number/docket number (e.g., '2:24-cv-01234-ABC-XYZ')"
            },
            "plaintiffs": {
                "type": "string",
                "description": "Plaintiff name(s), typically in caps (e.g., 'JOHN DOE; JANE DOE')"
            },
            "defendants": {
                "type": "string",
                "description": "Defendant name(s), typically in caps (e.g., 'ACME CORPORATION')"
            },
            "judge": {
                "type": "string",
                "description": "Presiding judge's name (e.g., 'Honorable John Smith' or 'Judge Smith')"
            },
            "magistrate_judge": {
                "type": "string",
                "description": "Magistrate judge's name, if mentioned"
            },
            "motion_title": {
                "type": "string",
                "description": "Title of the motion or document (e.g., 'Motion to Compel Discovery')"
            },
            "hearing_date": {
                "type": "string",
                "description": "Scheduled hearing date in natural format (e.g., 'January 15, 2025')"
            },
            "hearing_time": {
                "type": "string",
                "description": "Scheduled hearing time (e.g., '10:00 a.m.')"
            },
            "courtroom": {
                "type": "string",
                "description": "Courtroom number or location (e.g., 'Courtroom 10A' or '350')"
            }
        },
        "required": ["court", "case_number", "plaintiffs", "defendants", "judge"]
    }
}


SYSTEM_PROMPT = """You are a legal document analyzer. Your task is to extract case information from legal documents.

Extract the following information if present:
- Court name (full official name, preserving line breaks with \\n - court names typically span 2-3 lines)
- Case number/docket number
- Plaintiff(s) and Defendant(s)
- Judge and Magistrate Judge names
- Document/motion title
- Hearing date, time, and courtroom

Use the submit_case_info tool to provide the extracted information. If a field is not present in the document, omit it from the tool call (except required fields - make your best guess for those).

Be precise and extract exactly what appears in the document. For the court field, preserve the multi-line formatting using \\n (e.g., "UNITED STATES DISTRICT COURT\\nCENTRAL DISTRICT OF CALIFORNIA")."""


class CaseExtractor:
    """Extracts structured case information from legal document text using Claude."""

    def __init__(self):
        """Initialize the Claude client."""
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is required")

        self.client = Anthropic(api_key=api_key)
        # Use a smaller, faster model for extraction tasks
        self.model = "claude-3-5-haiku-20241022"

    def extract_case_info(self, text: str) -> dict:
        """
        Extract structured case information from document text.

        Args:
            text: Text content extracted from a legal document

        Returns:
            Dict with extracted case information fields

        Raises:
            ValueError: If extraction fails or Claude doesn't use the tool
        """
        message = self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            tools=[EXTRACT_CASE_INFO_TOOL],
            tool_choice={"type": "tool", "name": "submit_case_info"},
            messages=[
                {
                    "role": "user",
                    "content": f"Extract case information from this legal document:\n\n{text}"
                }
            ]
        )

        # Find the tool use block
        for block in message.content:
            if block.type == "tool_use" and block.name == "submit_case_info":
                return self._normalize_result(block.input)

        raise ValueError("Failed to extract case information - no tool call received")

    def _normalize_result(self, result: dict) -> dict:
        """
        Normalize the extraction result to ensure consistent field names and types.

        Args:
            result: Raw extraction result from Claude

        Returns:
            Normalized dict with all expected fields (some may be None)
        """
        def clean_value(val):
            """Convert literal \\n to actual newlines and clean up the value."""
            if not val:
                return None
            # Replace literal \n with actual newlines
            return val.replace("\\n", "\n")

        return {
            "court": clean_value(result.get("court")),
            "case_number": clean_value(result.get("case_number")),
            "plaintiffs": clean_value(result.get("plaintiffs")),
            "defendants": clean_value(result.get("defendants")),
            "judge": clean_value(result.get("judge")),
            "magistrate_judge": clean_value(result.get("magistrate_judge")),
            "motion_title": clean_value(result.get("motion_title")),
            "hearing_date": clean_value(result.get("hearing_date")),
            "hearing_time": clean_value(result.get("hearing_time")),
            "courtroom": clean_value(result.get("courtroom")),
        }


# Module-level convenience function
_extractor: Optional[CaseExtractor] = None


def get_extractor() -> CaseExtractor:
    """Get or create the singleton CaseExtractor instance."""
    global _extractor
    if _extractor is None:
        _extractor = CaseExtractor()
    return _extractor


def extract_case_info(text: str) -> dict:
    """
    Extract structured case information from document text.

    Convenience function that uses a singleton CaseExtractor instance.

    Args:
        text: Text content extracted from a legal document

    Returns:
        Dict with extracted case information fields
    """
    return get_extractor().extract_case_info(text)


def suggest_document_names(case_info: dict) -> dict:
    """
    Generate suggested document name and filename based on case information.

    Args:
        case_info: Dict with case information (plaintiffs, defendants, motion_title, case_number)

    Returns:
        Dict with 'document_name' and 'filename' suggestions
    """
    import re

    plaintiffs = case_info.get("plaintiffs") or ""
    defendants = case_info.get("defendants") or ""
    motion_title = case_info.get("motion_title") or ""
    case_number = case_info.get("case_number") or ""

    # Extract first plaintiff last name
    plaintiff_name = ""
    if plaintiffs:
        # Take first name, get last word (likely last name)
        first_plaintiff = plaintiffs.split(";")[0].split(",")[0].strip()
        words = first_plaintiff.split()
        plaintiff_name = words[-1] if words else first_plaintiff

    # Extract first defendant last name or company name
    defendant_name = ""
    if defendants:
        first_defendant = defendants.split(";")[0].split(",")[0].strip()
        # For companies, take first meaningful word
        words = first_defendant.split()
        # Skip common prefixes
        skip_words = {"COUNTY", "CITY", "STATE", "THE", "OF", "A", "AN"}
        for word in words:
            if word.upper() not in skip_words:
                defendant_name = word.title()
                break
        if not defendant_name and words:
            defendant_name = words[0].title()

    # Generate document name - this is the formal title
    # If we have a motion title, use it; otherwise create a generic one
    if motion_title:
        document_name = motion_title
    else:
        document_name = "Opposition to Motion"

    # Generate filename - short, filesystem-friendly
    # Format: PlaintiffLastName_v_DefendantName_DocType.docx
    doc_abbrev = _abbreviate_motion_type(motion_title)

    filename_parts = []
    if plaintiff_name:
        filename_parts.append(_sanitize_filename(plaintiff_name))
    if defendant_name:
        if filename_parts:
            filename_parts.append("v")
        filename_parts.append(_sanitize_filename(defendant_name))
    if doc_abbrev:
        filename_parts.append(doc_abbrev)

    if filename_parts:
        filename = "_".join(filename_parts) + ".docx"
    else:
        filename = "document.docx"

    return {
        "document_name": document_name,
        "filename": filename,
    }


def _abbreviate_motion_type(motion_title: str) -> str:
    """Generate a short abbreviation for the motion type."""
    if not motion_title:
        return "Doc"

    title_lower = motion_title.lower()

    # Common motion type abbreviations
    if "opposition" in title_lower:
        if "motion to compel" in title_lower:
            return "Opp_MTC"
        elif "motion for summary judgment" in title_lower or "msj" in title_lower:
            return "Opp_MSJ"
        elif "motion to dismiss" in title_lower or "mtd" in title_lower:
            return "Opp_MTD"
        elif "demurrer" in title_lower:
            return "Opp_Dem"
        else:
            return "Opp"
    elif "reply" in title_lower:
        if "motion to compel" in title_lower:
            return "Reply_MTC"
        elif "motion for summary judgment" in title_lower:
            return "Reply_MSJ"
        else:
            return "Reply"
    elif "motion to compel" in title_lower:
        return "MTC"
    elif "motion for summary judgment" in title_lower or "summary judgment" in title_lower:
        return "MSJ"
    elif "motion to dismiss" in title_lower:
        return "MTD"
    elif "demurrer" in title_lower:
        return "Demurrer"
    elif "complaint" in title_lower:
        return "Complaint"
    elif "answer" in title_lower:
        return "Answer"
    elif "declaration" in title_lower:
        return "Decl"
    elif "notice" in title_lower:
        return "Notice"
    elif "subpoena" in title_lower:
        return "Subpoena"
    elif "judgment" in title_lower:
        return "Judgment"
    else:
        # Take first few words
        words = motion_title.split()[:3]
        return "_".join(w.title() for w in words if len(w) > 2)[:20]


def _sanitize_filename(name: str) -> str:
    """Make a string safe for use in a filename."""
    import re
    # Remove special characters, keep alphanumeric and spaces
    clean = re.sub(r'[^\w\s-]', '', name)
    # Replace spaces with nothing, capitalize
    clean = clean.replace(' ', '').strip()
    # Limit length
    return clean[:20] if clean else "Doc"
