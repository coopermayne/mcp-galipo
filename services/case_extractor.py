"""
Case information extraction service.

Uses Claude to extract structured case information from legal document text.
"""

import os
from anthropic import Anthropic
from typing import Optional

from db.token_usage import record_usage_from_message


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
        "required": ["court", "case_number", "plaintiffs", "defendants"]
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
                "description": "List of sections to include. Options: 'notice' (Notice of Motion), 'meet_confer' (Meet & Confer statement), 'toc' (Table of Contents), 'toa' (Table of Authorities), 'memo' (Memorandum of Points and Authorities), 'declaration' (Declaration), 'joint_stip' (Joint Stipulation), 'generic' (Generic Pleading), 'cert_compliance' (Certificate of Compliance)"
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
                "description": "A short, filesystem-friendly filename with .docx extension"
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

Use the submit_case_info tool to provide the extracted information. If a field is not present in the document, omit it from the tool call. Do NOT use placeholders like "<UNKNOWN>" or "Unknown" — if you cannot determine a value, simply leave that field out of the tool call.

Be precise and extract exactly what appears in the document. For the court field, preserve the multi-line formatting using \\n (e.g., "UNITED STATES DISTRICT COURT\\nCENTRAL DISTRICT OF CALIFORNIA")."""


class CaseExtractor:
    """Extracts structured case information from legal document text using Claude."""

    def __init__(self):
        """Initialize the Claude client."""
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is required")

        self.client = Anthropic(api_key=api_key)
        from config import settings
        self.model = settings.extraction_model

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
        record_usage_from_message(
            source="case_extractor", request_type="extract_case_info",
            model=self.model, message=message,
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
        if user_input.strip():
            prompt = f"""You are helping a lawyer finalize a document title. The user typed:
"{user_input}"

Context (the document they uploaded, if any): "{motion_title}"

## YOUR TASK:
1. Clean up and formalize the user's input into a proper legal document title.
   - RESPECT the user's intent. If they typed "opp msj", they mean "Opposition to Motion for Summary Judgment".
   - If they typed "reply to mtc", they mean "Reply in Support of Motion to Compel".
   - Fix abbreviations, capitalization, and phrasing but keep the same document type they intended.
   - Use the uploaded document title as context only — do NOT override what the user typed.
2. Recommend which sections to include based on the document type.

## SECTION RULES:
Available sections: notice, meet_confer, toc, toa, memo, declaration, joint_stip, generic, cert_compliance

- **Motions** (filing a motion): notice, meet_confer, memo, toc, toa
- **Oppositions** (opposing a motion): memo, toc, toa, cert_compliance
- **Replies** (replying to opposition): memo, cert_compliance
- **Answers** (to complaints): generic
- **Declarations**: declaration
- **Joint Stipulations**: joint_stip
- **Notices**: generic

Use the submit_document_name tool."""
        else:
            prompt = f"""You are helping a lawyer decide what document to create.

The uploaded document (what they may be responding to) is titled:
"{motion_title}"

## YOUR TASK:
1. Suggest the most likely response document title.
2. Recommend which sections to include.

## LITIGATION SEQUENCE:
Motion → Opposition → Reply

## RESPONSE RULES:
- Responding to a Motion → "Opposition to [that motion]"
- Responding to an Opposition → "Reply in Support of [underlying motion]"
- Responding to a Complaint → "Answer to Complaint"
- Responding to a Demurrer → "Opposition to Demurrer"
- If no uploaded document, suggest a generic "Motion to [...]"

## SECTION RULES:
Available sections: notice, meet_confer, toc, toa, memo, declaration, joint_stip, generic, cert_compliance

- **Motions**: notice, meet_confer, memo, toc, toa
- **Oppositions**: memo, toc, toa, cert_compliance
- **Replies**: memo, cert_compliance
- **Answers**: generic
- **Declarations**: declaration
- **Joint Stipulations**: joint_stip

Use the submit_document_name tool."""

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
        record_usage_from_message(
            source="case_extractor", request_type="improve_document_name",
            model=self.model, message=message,
        )

        for block in message.content:
            if block.type == "tool_use" and block.name == "submit_document_name":
                return {
                    "document_name": block.input.get("document_name", ""),
                    "sections": block.input.get("sections", ["memo", "toc", "toa"]),
                }

        raise ValueError("Failed to improve document name")

    def generate_filename(self, document_name: str) -> str:
        """
        Generate a filesystem-friendly filename from a document name.

        Args:
            document_name: The formal document title

        Returns:
            A short filename like "2026.02.05 Opp MSJ.docx"
        """
        from datetime import datetime
        from lib.tz import LA
        today = datetime.now(LA).strftime('%Y.%m.%d')

        prompt = f"""Shorten this legal document name into a brief filename.

Document: "{document_name}"

Rules:
- Format: {today} [short abbreviation].docx
- Opposition → Opp, Reply in Support of → Reply ISO, Declaration → Decl
- Motion for Summary Judgment → MSJ, Motion to Compel → MTC, Motion to Dismiss → MTD
- Motion in Limine → MIL, Motion for Judgment on the Pleadings → MJOP
- Joint Stipulation → Jt Stip, Ex Parte Application → Ex Parte
- Use common legal abbreviations for anything not listed
- Keep it short — aim for 3-5 words max after the date

Examples:
- "Opposition to Motion for Summary Judgment" → "{today} Opp MSJ.docx"
- "Reply in Support of Motion to Compel" → "{today} Reply ISO MTC.docx"

Use the submit_filename tool."""

        message = self.client.messages.create(
            model=self.model,
            max_tokens=64,
            tools=[GENERATE_FILENAME_TOOL],
            tool_choice={"type": "tool", "name": "submit_filename"},
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        record_usage_from_message(
            source="case_extractor", request_type="generate_filename",
            model=self.model, message=message,
        )

        for block in message.content:
            if block.type == "tool_use" and block.name == "submit_filename":
                return block.input.get("filename", f"{today} document.docx")

        return f"{today} document.docx"


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
