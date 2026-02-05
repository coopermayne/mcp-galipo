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
                "description": "List of sections to include. Options: 'notice' (Notice of Motion), 'meet_confer' (Meet & Confer statement), 'toc' (Table of Contents), 'toa' (Table of Authorities), 'memo' (Memorandum of Points and Authorities), 'declaration' (Declaration), 'joint_stip' (Joint Stipulation), 'generic' (Generic Pleading), 'cert_compliance' (Certificate of Compliance)"
            }
        },
        "required": ["document_name", "sections"]
    }
}

# Motion abbreviations for filename generation (longest match first)
_MOTION_ABBREVIATIONS = [
    ("Motion for Summary Judgment", "MSJ"),
    ("Motion for Summary Adjudication", "MSA"),
    ("Motion for Judgment on the Pleadings", "MJOP"),
    ("Motion for Judgment as a Matter of Law", "JMOL"),
    ("Motion to Compel Further Discovery", "MTC Further Disc"),
    ("Motion to Compel Discovery", "MTC Disc"),
    ("Motion to Compel Arbitration", "MTC Arb"),
    ("Motion to Compel", "MTC"),
    ("Motion to Dismiss", "MTD"),
    ("Motion to Strike", "MTS"),
    ("Motion to Quash", "MTQ"),
    ("Motion to Remand", "MTR"),
    ("Motion to Bifurcate", "MT Bifurcate"),
    ("Motion to Sever", "MT Sever"),
    ("Motion to Transfer", "MT Transfer"),
    ("Motion in Limine", "MIL"),
    ("Motion to Continue Trial", "MT Continue"),
    ("Motion to Withdraw", "MT Withdraw"),
    ("Motion to Amend", "MT Amend"),
    ("Motion for Leave to Amend", "MLA"),
    ("Motion for Protective Order", "MPO"),
    ("Motion for Reconsideration", "MFR"),
    ("Motion for New Trial", "MNT"),
    ("Motion for Default Judgment", "MDJ"),
    ("Motion for Preliminary Injunction", "MPI"),
    ("Motion for Sanctions", "MFS"),
    ("Motion for Attorney Fees", "MAF"),
    ("Demurrer", "Demurrer"),
    ("Ex Parte Application", "Ex Parte"),
]

# Prefix abbreviations
_PREFIX_ABBREVIATIONS = [
    ("Opposition to", "Opp"),
    ("Reply in Support of", "Reply ISO"),
    ("Reply to Opposition to", "Reply ISO"),
    ("Reply to", "Reply"),
    ("Answer to", "Answer"),
    ("Response to", "Resp"),
    ("Memorandum in Support of", "Memo ISO"),
    ("Memorandum in Opposition to", "Memo Opp"),
    ("Declaration in Support of", "Decl ISO"),
    ("Declaration of", "Decl"),
    ("Joint Stipulation to", "Jt Stip"),
    ("Joint Stipulation", "Jt Stip"),
    ("Stipulation to", "Stip"),
    ("Notice of", "Notice"),
]


def _abbreviate_filename(document_name: str) -> str:
    """
    Generate a short filename from a document name using abbreviation rules.

    Examples:
        "Opposition to Motion for Summary Judgment" → "2026.02.05 Opp MSJ.docx"
        "Reply in Support of Motion to Compel" → "2026.02.05 Reply ISO MTC.docx"
        "Declaration of John Doe" → "2026.02.05 Decl.docx"
    """
    from datetime import datetime
    today = datetime.now().strftime("%Y.%m.%d")

    name = document_name.strip()
    if not name:
        return f"{today} document.docx"

    parts = []

    # Match prefix (e.g., "Opposition to", "Reply in Support of")
    name_lower = name.lower()
    for phrase, abbrev in _PREFIX_ABBREVIATIONS:
        if name_lower.startswith(phrase.lower()):
            parts.append(abbrev)
            name = name[len(phrase):].strip()
            name_lower = name.lower()
            break

    # Match motion type
    for phrase, abbrev in _MOTION_ABBREVIATIONS:
        if name_lower.startswith(phrase.lower()):
            parts.append(abbrev)
            name = name[len(phrase):].strip()
            break
    else:
        # No motion match — use first few words, title-cased
        words = name.split()[:4]
        remaining = " ".join(words)
        if remaining:
            parts.append(remaining)

    abbreviated = " ".join(parts) if parts else "document"
    return f"{today} {abbreviated}.docx"


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

        Uses simple abbreviation rules — no AI call needed.

        Args:
            document_name: The formal document title

        Returns:
            A short filename like "2026.02.05 Opp MSJ.docx"
        """
        return _abbreviate_filename(document_name)


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
