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
    Generate suggested document name and filename for a RESPONSE to the uploaded document.

    The uploaded PDF is typically a motion/document we're responding TO, so we suggest
    the appropriate response type (opposition, reply, answer, etc.)

    Args:
        case_info: Dict with case information (plaintiffs, defendants, motion_title, case_number)

    Returns:
        Dict with 'document_name' and 'filename' suggestions
    """
    plaintiffs = case_info.get("plaintiffs") or ""
    defendants = case_info.get("defendants") or ""
    motion_title = case_info.get("motion_title") or ""

    # Extract first plaintiff last name
    plaintiff_name = ""
    if plaintiffs:
        first_plaintiff = plaintiffs.split(";")[0].split(",")[0].strip()
        words = first_plaintiff.split()
        plaintiff_name = words[-1] if words else first_plaintiff

    # Extract first defendant last name or company name
    defendant_name = ""
    if defendants:
        first_defendant = defendants.split(";")[0].split(",")[0].strip()
        words = first_defendant.split()
        skip_words = {"COUNTY", "CITY", "STATE", "THE", "OF", "A", "AN"}
        for word in words:
            if word.upper() not in skip_words:
                defendant_name = word.title()
                break
        if not defendant_name and words:
            defendant_name = words[0].title()

    # Determine the response document name based on the uploaded document
    response_name, response_abbrev = _suggest_response_document(motion_title)

    # Generate filename - short, filesystem-friendly
    # Format: PlaintiffLastName_v_DefendantName_DocType.docx
    filename_parts = []
    if plaintiff_name:
        filename_parts.append(_sanitize_filename(plaintiff_name))
    if defendant_name:
        if filename_parts:
            filename_parts.append("v")
        filename_parts.append(_sanitize_filename(defendant_name))
    if response_abbrev:
        filename_parts.append(response_abbrev)

    if filename_parts:
        filename = "_".join(filename_parts) + ".docx"
    else:
        filename = "document.docx"

    return {
        "document_name": response_name,
        "filename": filename,
    }


def _suggest_response_document(motion_title: str) -> tuple[str, str]:
    """
    Suggest the appropriate response document based on the uploaded document.

    Returns:
        Tuple of (full document name, filename abbreviation)
    """
    if not motion_title:
        return ("Opposition to Motion", "Opp")

    title_lower = motion_title.lower()

    # If already an opposition, suggest a reply
    if "opposition" in title_lower:
        # Extract what the opposition is to
        if "motion to compel" in title_lower:
            return ("Reply in Support of Motion to Compel", "Reply_MTC")
        elif "motion for summary judgment" in title_lower or "msj" in title_lower:
            return ("Reply in Support of Motion for Summary Judgment", "Reply_MSJ")
        elif "motion to dismiss" in title_lower or "mtd" in title_lower:
            return ("Reply in Support of Motion to Dismiss", "Reply_MTD")
        elif "demurrer" in title_lower:
            return ("Reply in Support of Demurrer", "Reply_Dem")
        else:
            return ("Reply in Support of Motion", "Reply")

    # If already a reply, not much to do - maybe a sur-reply
    if "reply" in title_lower:
        return ("Sur-Reply", "SurReply")

    # Standard motions -> Opposition
    if "motion to compel" in title_lower:
        return ("Opposition to Motion to Compel", "Opp_MTC")
    if "motion for summary judgment" in title_lower or "summary judgment" in title_lower:
        return ("Opposition to Motion for Summary Judgment", "Opp_MSJ")
    if "motion to dismiss" in title_lower:
        return ("Opposition to Motion to Dismiss", "Opp_MTD")
    if "motion to strike" in title_lower:
        return ("Opposition to Motion to Strike", "Opp_MTS")
    if "motion for sanctions" in title_lower:
        return ("Opposition to Motion for Sanctions", "Opp_Sanctions")
    if "motion to quash" in title_lower:
        return ("Opposition to Motion to Quash", "Opp_MTQ")
    if "motion for protective order" in title_lower:
        return ("Opposition to Motion for Protective Order", "Opp_MPO")
    if "motion to seal" in title_lower:
        return ("Opposition to Motion to Seal", "Opp_Seal")
    if "motion for leave" in title_lower:
        return ("Opposition to Motion for Leave", "Opp_Leave")
    if "motion to amend" in title_lower:
        return ("Opposition to Motion to Amend", "Opp_Amend")
    if "motion for reconsideration" in title_lower:
        return ("Opposition to Motion for Reconsideration", "Opp_Recon")
    if "motion to continue" in title_lower or "motion for continuance" in title_lower:
        return ("Opposition to Motion for Continuance", "Opp_Cont")

    # Demurrer -> Opposition to Demurrer
    if "demurrer" in title_lower:
        return ("Opposition to Demurrer", "Opp_Dem")

    # Complaint -> Answer
    if "complaint" in title_lower:
        return ("Answer to Complaint", "Answer")

    # Generic motion
    if "motion" in title_lower:
        # Try to extract the motion type
        # "Motion for X" or "Motion to X"
        import re
        match = re.search(r"motion\s+(for|to)\s+(.+)", title_lower)
        if match:
            motion_type = match.group(2).strip()
            # Capitalize properly
            motion_type_title = " ".join(w.capitalize() for w in motion_type.split())
            return (f"Opposition to Motion {match.group(1).capitalize()} {motion_type_title}", "Opp")
        return ("Opposition to Motion", "Opp")

    # Default - just oppose whatever it is
    return (f"Opposition to {motion_title}", "Opp")


def _sanitize_filename(name: str) -> str:
    """Make a string safe for use in a filename."""
    import re
    # Remove special characters, keep alphanumeric and spaces
    clean = re.sub(r'[^\w\s-]', '', name)
    # Replace spaces with nothing, capitalize
    clean = clean.replace(' ', '').strip()
    # Limit length
    return clean[:20] if clean else "Doc"
