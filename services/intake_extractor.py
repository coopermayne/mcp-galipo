"""
Intake information extraction service.

Uses Claude to extract structured intake fields from raw text
(emails, phone notes, referral letters, etc.).
"""

import os
from anthropic import Anthropic
from typing import Optional

from db.token_usage import record_usage_from_message


EXTRACT_INTAKE_INFO_TOOL = {
    "name": "submit_intake_info",
    "description": "Submit extracted intake information. Only include fields that were clearly mentioned in the text.",
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {
                "type": "string",
                "description": "Full name of the potential client / injured person"
            },
            "email": {
                "type": "string",
                "description": "Email address"
            },
            "phone": {
                "type": "string",
                "description": "Phone number"
            },
            "contact_relationship": {
                "type": "string",
                "description": "Relationship of the contact to the injured person (e.g., 'Self', 'Spouse', 'Parent', 'Friend')"
            },
            "referral_name": {
                "type": "string",
                "description": "Name of the person who referred them"
            },
            "referral_org": {
                "type": "string",
                "description": "Organization of the referral source (law firm, hospital, etc.)"
            },
            "referral_email": {
                "type": "string",
                "description": "Email of the referral source"
            },
            "referral_phone": {
                "type": "string",
                "description": "Phone number of the referral source"
            },
            "case_type": {
                "type": "string",
                "description": "Type of personal injury case (e.g., 'Auto Accident', 'Slip and Fall', 'Medical Malpractice', 'Dog Bite', 'Premises Liability', 'Product Liability')"
            },
            "incident_date": {
                "type": "string",
                "description": "Date of the incident. MUST be in YYYY-MM-DD format (e.g., '2026-01-20'). Convert all date formats — 'January 20, 2026' becomes '2026-01-20', 'Jan 20 2026' becomes '2026-01-20', etc. If the exact date cannot be determined, omit this field entirely."
            },
            "incident_time": {
                "type": "string",
                "description": "Time of day the incident occurred (e.g., '3:00 PM', 'morning', 'around noon'). This is ONLY for time-of-day, NOT the date. Never put a date or date-like value here."
            },
            "location": {
                "type": "string",
                "description": "Location where the incident occurred"
            },
            "incident_description": {
                "type": "string",
                "description": "Description of what happened"
            },
            "injury_description": {
                "type": "string",
                "description": "Description of injuries sustained"
            },
            "notes": {
                "type": "string",
                "description": "Any additional notes or details that don't fit other fields"
            },
        },
        "required": []
    }
}

SYSTEM_PROMPT = """You are an intake specialist at a personal injury law firm. Your task is to extract structured intake information from raw text.

The text may be:
- An email from a potential client or referral source
- Phone call notes taken by a receptionist
- A referral letter from another attorney or medical provider
- A web form submission
- Any other communication about a potential new case

Extract all available fields. Only include fields that are clearly present in the text — do NOT guess or fabricate information. If a field is not mentioned, omit it entirely.

For incident_date, you MUST convert to YYYY-MM-DD format (e.g., "January 20, 2026" → "2026-01-20"). If only a relative date is given (e.g., "last Tuesday") or the date is ambiguous, omit the field. Never put a date into the incident_time field — that field is strictly for time-of-day only (e.g., "3:00 PM", "evening").

For case_type, use standard personal injury categories: Auto Accident, Slip and Fall, Medical Malpractice, Dog Bite, Premises Liability, Product Liability, Workplace Injury, Wrongful Death, or describe the type if it doesn't fit these categories.

Use the submit_intake_info tool to provide the extracted information."""


class IntakeExtractor:
    """Extracts structured intake information from raw text using Claude."""

    def __init__(self):
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is required")

        self.client = Anthropic(api_key=api_key)
        from config import settings
        self.model = settings.extraction_model

    def extract_intake_info(self, text: str) -> dict:
        """
        Extract structured intake fields from raw text.

        Args:
            text: Raw text (email, phone notes, referral letter, etc.)

        Returns:
            Dict with only the fields that were found (no nulls)

        Raises:
            ValueError: If extraction fails
        """
        message = self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            tools=[EXTRACT_INTAKE_INFO_TOOL],
            tool_choice={"type": "tool", "name": "submit_intake_info"},
            messages=[
                {
                    "role": "user",
                    "content": f"Extract intake information from this text:\n\n{text}"
                }
            ]
        )
        record_usage_from_message(
            source="intake_extractor", request_type="extract_intake_info",
            model=self.model, message=message,
        )

        for block in message.content:
            if block.type == "tool_use" and block.name == "submit_intake_info":
                # Return only non-empty fields
                return {k: v for k, v in block.input.items() if v}

        raise ValueError("Failed to extract intake information - no tool call received")


# Module-level singleton and convenience function
_extractor: Optional[IntakeExtractor] = None


def get_extractor() -> IntakeExtractor:
    """Get or create the singleton IntakeExtractor instance."""
    global _extractor
    if _extractor is None:
        _extractor = IntakeExtractor()
    return _extractor


def extract_intake_info(text: str) -> dict:
    """
    Extract structured intake fields from raw text.

    Convenience function that uses a singleton IntakeExtractor instance.
    """
    return get_extractor().extract_intake_info(text)
