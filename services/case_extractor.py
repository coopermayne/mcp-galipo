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


# Tool definition for document name suggestions
SUGGEST_NAMES_TOOL = {
    "name": "submit_document_names",
    "description": "Submit the suggested document name and filename for the response document being created.",
    "input_schema": {
        "type": "object",
        "properties": {
            "document_name": {
                "type": "string",
                "description": "The formal title for the response document (e.g., 'Opposition to Motion to Compel Discovery')"
            },
            "filename": {
                "type": "string",
                "description": "A short, filesystem-friendly filename with .docx extension (e.g., 'Doe_v_Acme_Opp_MTC.docx')"
            }
        },
        "required": ["document_name", "filename"]
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

    def suggest_document_names(self, case_info: dict) -> dict:
        """
        Use AI to suggest document name and filename for a response document.

        Args:
            case_info: Dict with case information from extraction

        Returns:
            Dict with 'document_name' and 'filename' suggestions
        """
        from datetime import datetime
        today_date = datetime.now().strftime('%Y.%m.%d')

        plaintiffs = case_info.get("plaintiffs") or "Unknown"
        defendants = case_info.get("defendants") or "Unknown"
        motion_title = case_info.get("motion_title") or "Unknown Document"

        prompt = f"""You are helping a lawyer create a RESPONSE document. They uploaded a legal document titled:

"{motion_title}"

Today's date: {today_date}

## CRITICAL RULES FOR document_name:

The litigation sequence is: Motion → Opposition → Reply

1. If the uploaded title contains "Opposition" → suggest a "Reply in Support of [the underlying motion]"
   - "Opposition to Motion to Compel" → "Reply in Support of Motion to Compel"
   - "Opposition to Motion for Summary Judgment" → "Reply in Support of Motion for Summary Judgment"

2. If the uploaded title is a Motion (but NOT an Opposition) → suggest "Opposition to [that motion]"
   - "Motion to Compel Discovery" → "Opposition to Motion to Compel Discovery"
   - "Motion for Summary Judgment" → "Opposition to Motion for Summary Judgment"

3. If the uploaded title is a "Complaint" → suggest "Answer to Complaint"

4. If the uploaded title is a "Demurrer" → suggest "Opposition to Demurrer"

## RULES FOR filename:
Format: {today_date} [abbreviation].docx

Abbreviations:
- Opposition → Opp
- Motion to Dismiss → MTD
- Motion for Summary Judgment → MSJ
- Motion to Compel → Mot to Compel
- Motion to Compel Discovery → Mot to Compel Disc
- Reply in Support of → Reply ISO

Examples:
- document_name="Opposition to Motion to Compel" → filename="{today_date} Opp Mot to Compel.docx"
- document_name="Reply in Support of Motion to Compel" → filename="{today_date} Reply ISO Mot to Compel.docx"
- document_name="Opposition to Motion for Summary Judgment" → filename="{today_date} Opp MSJ.docx"
- document_name="Reply in Support of Motion for Summary Judgment" → filename="{today_date} Reply ISO MSJ.docx"

Use the submit_document_names tool with your suggestions."""

        message = self.client.messages.create(
            model=self.model,
            max_tokens=256,
            tools=[SUGGEST_NAMES_TOOL],
            tool_choice={"type": "tool", "name": "submit_document_names"},
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )

        # Find the tool use block
        for block in message.content:
            if block.type == "tool_use" and block.name == "submit_document_names":
                return {
                    "document_name": block.input.get("document_name", ""),
                    "filename": block.input.get("filename", "document.docx"),
                }

        raise ValueError("Failed to generate document name suggestions")


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
    Use AI to generate suggested document name and filename for a RESPONSE document.

    The uploaded PDF is typically a motion/document we're responding TO, so we suggest
    the appropriate response type (opposition, reply, answer, etc.)

    Args:
        case_info: Dict with case information (plaintiffs, defendants, motion_title, case_number)

    Returns:
        Dict with 'document_name' and 'filename' suggestions
    """
    extractor = get_extractor()
    return extractor.suggest_document_names(case_info)
