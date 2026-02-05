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


# Tool definition for document name improvement
IMPROVE_NAME_TOOL = {
    "name": "submit_document_name",
    "description": "Submit the improved/suggested document name and recommended sections to include.",
    "input_schema": {
        "type": "object",
        "properties": {
            "document_name": {
                "type": "string",
                "description": "The formal title for the response document (e.g., 'Opposition to Motion to Compel Discovery')"
            },
            "sections": {
                "type": "array",
                "items": {"type": "string"},
                "description": "List of sections to include. Options: 'notice' (Notice of Motion), 'meet_confer' (Meet & Confer statement), 'toc' (Table of Contents), 'toa' (Table of Authorities), 'cert_compliance' (Certificate of Compliance)"
            }
        },
        "required": ["document_name", "sections"]
    }
}

# Tool definition for filename generation
GENERATE_FILENAME_TOOL = {
    "name": "submit_filename",
    "description": "Submit the generated filename.",
    "input_schema": {
        "type": "object",
        "properties": {
            "filename": {
                "type": "string",
                "description": "A short, filesystem-friendly filename with .docx extension (e.g., '2026.02.05 Opp MSJ.docx')"
            }
        },
        "required": ["filename"]
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

    def improve_document_name(self, user_input: str, motion_title: str) -> dict:
        """
        Use AI to improve/clean up a document name based on user input and context.

        Args:
            user_input: What the user has typed so far (may be empty or partial)
            motion_title: The title of the uploaded document for context

        Returns:
            Dict with 'document_name' and 'sections' (list of section keys to include)
        """
        prompt = f"""You are helping a lawyer create a RESPONSE document.

The uploaded document (what they're responding to) is titled:
"{motion_title}"

The user has started typing a document name:
"{user_input}"

## YOUR TASK:
1. Improve or complete the document name
2. Recommend which sections to include based on document type

## LITIGATION SEQUENCE:
Motion → Opposition → Reply

## DOCUMENT NAME RULES:
1. If responding to an "Opposition" → suggest "Reply in Support of [underlying motion]"
2. If responding to a Motion → suggest "Opposition to [that motion]"
3. If responding to a "Complaint" → suggest "Answer to Complaint"
4. If responding to a "Demurrer" → suggest "Opposition to Demurrer"
5. If the user has typed something specific, clean it up and format it properly

## SECTION RULES:
Available sections: notice, meet_confer, toc, toa, cert_compliance

- **Motions** (we're filing a motion): include notice, meet_confer, toc, toa
- **Oppositions** (responding to a motion): include toc, toa, cert_compliance
- **Replies** (responding to an opposition): usually just cert_compliance (short doc)
- **Answers** (to complaints): none of these sections typically

## EXAMPLES:
- "Opposition to Motion for Summary Judgment" → sections: ["toc", "toa", "cert_compliance"]
- "Motion to Compel Discovery" → sections: ["notice", "meet_confer", "toc", "toa"]
- "Reply in Support of Motion to Compel" → sections: ["cert_compliance"]

Use the submit_document_name tool with your improved title and recommended sections."""

        message = self.client.messages.create(
            model=self.model,
            max_tokens=256,
            tools=[IMPROVE_NAME_TOOL],
            tool_choice={"type": "tool", "name": "submit_document_name"},
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )

        for block in message.content:
            if block.type == "tool_use" and block.name == "submit_document_name":
                return {
                    "document_name": block.input.get("document_name", ""),
                    "sections": block.input.get("sections", ["toc", "toa"]),
                }

        raise ValueError("Failed to improve document name")

    def generate_filename(self, document_name: str) -> str:
        """
        Generate a filesystem-friendly filename from a document name.

        Args:
            document_name: The formal document title

        Returns:
            A short filename with date and abbreviations
        """
        from datetime import datetime
        today_date = datetime.now().strftime('%Y.%m.%d')

        prompt = f"""Generate a short, filesystem-friendly filename for this legal document:

Document name: "{document_name}"
Today's date: {today_date}

## RULES:
Format: {today_date} [abbreviation].docx

Use these abbreviations:
- Opposition → Opp
- Motion to Dismiss → MTD
- Motion for Summary Judgment → MSJ
- Motion to Compel → MTC
- Motion to Compel Discovery → MTC Disc
- Reply in Support of → Reply ISO
- Motion for Judgment on the Pleadings → MJOP
- Motion in Limine → MIL

## EXAMPLES:
- "Opposition to Motion to Compel" → "{today_date} Opp MTC.docx"
- "Reply in Support of Motion to Compel" → "{today_date} Reply ISO MTC.docx"
- "Opposition to Motion for Summary Judgment" → "{today_date} Opp MSJ.docx"
- "Opposition to Motion for Judgment as a Matter of Law" → "{today_date} Opp JMOL.docx"

Use the submit_filename tool with your generated filename."""

        message = self.client.messages.create(
            model=self.model,
            max_tokens=64,
            tools=[GENERATE_FILENAME_TOOL],
            tool_choice={"type": "tool", "name": "submit_filename"},
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )

        for block in message.content:
            if block.type == "tool_use" and block.name == "submit_filename":
                return block.input.get("filename", "document.docx")

        raise ValueError("Failed to generate filename")


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


def improve_document_name(user_input: str, motion_title: str) -> dict:
    """
    Use AI to improve/clean up a document name based on user input and context.

    Args:
        user_input: What the user has typed (may be empty or partial)
        motion_title: The title of the uploaded document for context

    Returns:
        Dict with 'document_name' and 'sections' (list of section keys to include)
    """
    return get_extractor().improve_document_name(user_input, motion_title)


def generate_filename(document_name: str) -> str:
    """
    Generate a filesystem-friendly filename from a document name.

    Args:
        document_name: The formal document title

    Returns:
        A short filename with date and abbreviations
    """
    return get_extractor().generate_filename(document_name)
