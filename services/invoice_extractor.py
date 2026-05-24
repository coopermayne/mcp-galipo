"""Invoice data extraction using Claude AI."""

import base64
import os
from typing import Optional

from anthropic import Anthropic

from db.token_usage import record_usage_from_message

EXTRACT_INVOICE_TOOL = {
    "name": "submit_invoice_info",
    "description": "Submit extracted invoice information from a legal invoice, receipt, or cost document.",
    "input_schema": {
        "type": "object",
        "properties": {
            "vendor": {
                "type": "string",
                "description": "Company or person the invoice is from",
            },
            "amount": {
                "type": "number",
                "description": "Total amount due or charged",
            },
            "date": {
                "type": "string",
                "description": "Invoice or receipt date in YYYY-MM-DD format",
            },
            "due_date": {
                "type": "string",
                "description": "Payment due date in YYYY-MM-DD format, if specified",
            },
            "description": {
                "type": "string",
                "description": "Brief description of services or costs",
            },
            "check_number": {
                "type": "string",
                "description": "Check number if visible on the document",
            },
            "payable_to": {
                "type": "string",
                "description": "Name the check should be made out/payable to, if specified (e.g. 'Make checks payable to...'). May differ from the vendor name.",
            },
            "payment_address": {
                "type": "string",
                "description": "Mailing address where payment/check should be sent, if listed on the document",
            },
            "notes": {
                "type": "string",
                "description": "Any special payment instructions, account/reference numbers, or important details for making the payment",
            },
            "category": {
                "type": "string",
                "enum": [
                    "Court Costs",
                    "Mediation",
                    "Experts",
                    "Messenger / Process",
                    "Court Reporters",
                    "Postage",
                    "Copy / Print / Scan",
                    "Parking",
                    "Travel",
                    "Miscellaneous",
                ],
                "description": "Best-fit cost category for a personal injury law firm",
            },
        },
        "required": ["vendor", "amount"],
    },
}

SYSTEM_PROMPT = """You are analyzing an invoice, receipt, or cost document for a personal injury law firm. Extract the key financial information.

Rules:
- Extract the vendor/payee name, total amount, dates, and description
- For category, choose the best fit from the available options
- If a field is not present, omit it from the tool call
- Do NOT guess or fabricate values — only extract what's clearly in the document
- Dates must be in YYYY-MM-DD format
- Amount should be a number (no currency symbols)
- Extract who the check should be made payable to if specified (e.g. "Make checks payable to", "Pay to the order of"). This may differ from the vendor name.
- Extract the mailing address for payment if one is listed (e.g. "Remit to", "Pay to", "Mail checks to")
- Put any special payment instructions, account numbers, reference numbers, or other important payment details in the notes field"""


class InvoiceExtractor:
    def __init__(self):
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is required")
        self.client = Anthropic(api_key=api_key)
        from config import settings
        self.model = settings.extraction_model

    def extract_from_text(self, text: str) -> dict:
        message = self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            tools=[EXTRACT_INVOICE_TOOL],
            tool_choice={"type": "tool", "name": "submit_invoice_info"},
            messages=[
                {"role": "user", "content": f"Extract invoice information from this document:\n\n{text}"}
            ],
        )
        record_usage_from_message(
            source="invoice_extractor", request_type="extract_from_text",
            model=self.model, message=message,
        )

        for block in message.content:
            if block.type == "tool_use" and block.name == "submit_invoice_info":
                return block.input

        raise ValueError("Failed to extract invoice information — no tool call received")

    def extract_from_document(self, doc_bytes: bytes, media_type: str) -> dict:
        b64 = base64.b64encode(doc_bytes).decode("utf-8")
        message = self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            tools=[EXTRACT_INVOICE_TOOL],
            tool_choice={"type": "tool", "name": "submit_invoice_info"},
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "document",
                            "source": {"type": "base64", "media_type": media_type, "data": b64},
                        },
                        {"type": "text", "text": "Extract invoice information from this document."},
                    ],
                }
            ],
        )
        record_usage_from_message(
            source="invoice_extractor", request_type="extract_from_document",
            model=self.model, message=message,
        )

        for block in message.content:
            if block.type == "tool_use" and block.name == "submit_invoice_info":
                return block.input

        raise ValueError("Failed to extract invoice information — no tool call received")

    def extract_from_image(self, image_bytes: bytes, media_type: str) -> dict:
        b64 = base64.b64encode(image_bytes).decode("utf-8")
        message = self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            tools=[EXTRACT_INVOICE_TOOL],
            tool_choice={"type": "tool", "name": "submit_invoice_info"},
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {"type": "base64", "media_type": media_type, "data": b64},
                        },
                        {"type": "text", "text": "Extract invoice information from this image."},
                    ],
                }
            ],
        )
        record_usage_from_message(
            source="invoice_extractor", request_type="extract_from_image",
            model=self.model, message=message,
        )

        for block in message.content:
            if block.type == "tool_use" and block.name == "submit_invoice_info":
                return block.input

        raise ValueError("Failed to extract invoice information — no tool call received")


_extractor: Optional[InvoiceExtractor] = None


def get_extractor() -> InvoiceExtractor:
    global _extractor
    if _extractor is None:
        _extractor = InvoiceExtractor()
    return _extractor


def extract_invoice(file_path: str, content_type: str) -> dict:
    extractor = get_extractor()

    with open(file_path, "rb") as f:
        file_bytes = f.read()

    if content_type == "application/pdf":
        from services.pdf_extractor import extract_text_from_pdf
        try:
            text = extract_text_from_pdf(file_bytes, max_pages=10)
            return extractor.extract_from_text(text)
        except ValueError:
            # Scanned/image-based PDF — send as PDF document to Claude vision
            return extractor.extract_from_document(file_bytes, "application/pdf")
    else:
        return extractor.extract_from_image(file_bytes, content_type)
