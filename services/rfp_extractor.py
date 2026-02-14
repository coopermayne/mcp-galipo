"""
RFP (Request for Production) extraction and analysis service.

Uses Claude to:
1. Extract case/party info from the first 2 pages of an RFP
2. Extract individual requests with verbatim text
3. Analyze requests and suggest applicable objections
"""

import os
import logging
from typing import Optional
from anthropic import Anthropic

_logger = logging.getLogger("services.rfp_extractor")


# Haiku pricing per million tokens (as of Feb 2026)
_INPUT_COST_PER_M = 0.80   # $0.80 per 1M input tokens
_OUTPUT_COST_PER_M = 4.00  # $4.00 per 1M output tokens


def _log_usage(step: str, message) -> None:
    """Log token usage and estimated cost from an API response."""
    usage = message.usage
    input_cost = (usage.input_tokens / 1_000_000) * _INPUT_COST_PER_M
    output_cost = (usage.output_tokens / 1_000_000) * _OUTPUT_COST_PER_M
    total_cost = input_cost + output_cost
    _logger.info(
        f"[RFP {step}] {usage.input_tokens:,} in / {usage.output_tokens:,} out "
        f"(${total_cost:.4f})"
    )


# --- Tool definitions ---

EXTRACT_RFP_INFO_TOOL = {
    "name": "submit_rfp_info",
    "description": "Submit extracted RFP case and party information.",
    "input_schema": {
        "type": "object",
        "properties": {
            "court_name": {
                "type": "string",
                "description": "Full court name, preserving line breaks with \\n"
            },
            "header_plaintiffs": {
                "type": "string",
                "description": "Plaintiff name(s) as they appear in the caption"
            },
            "header_defendants": {
                "type": "string",
                "description": "Defendant name(s) as they appear in the caption"
            },
            "case_no": {
                "type": "string",
                "description": "Case number / docket number"
            },
            "propounding_party": {
                "type": "string",
                "description": "The party making the requests (propounding party)"
            },
            "responding_party": {
                "type": "string",
                "description": "The party who must respond"
            },
            "set_number": {
                "type": "string",
                "description": "Set number if stated (e.g., 'Set One', 'Set Two')"
            },
            "document_title": {
                "type": "string",
                "description": "Full title of the RFP document as written"
            },
            "response_document_title": {
                "type": "string",
                "description": "The title for the RESPONSE document (e.g., 'PLAINTIFF JOHN DOE'S RESPONSES TO DEFENDANT CITY OF FRESNO'S FIRST SET OF REQUESTS FOR PRODUCTION OF DOCUMENTS'). Must name the responding party and reference the original RFP."
            },
            "multiple_plaintiffs": {
                "type": "boolean",
                "description": "True if there are multiple plaintiffs"
            },
            "multiple_defendants": {
                "type": "boolean",
                "description": "True if there are multiple defendants"
            },
        },
        "required": ["court_name", "case_no", "propounding_party", "responding_party"]
    }
}

EXTRACT_RFP_REQUESTS_TOOL = {
    "name": "submit_rfp_requests",
    "description": "Submit the extracted RFP requests. Each request must have its EXACT verbatim text - do not fix typos or rephrase.",
    "input_schema": {
        "type": "object",
        "properties": {
            "requests": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "number": {
                            "type": "integer",
                            "description": "Request number"
                        },
                        "text": {
                            "type": "string",
                            "description": "VERBATIM text of the request exactly as written in the document"
                        }
                    },
                    "required": ["number", "text"]
                },
                "description": "Array of request objects with number and verbatim text"
            }
        },
        "required": ["requests"]
    }
}

def _build_analyze_tool(valid_short_names: list[str], request_numbers: list[int]) -> dict:
    """Build the analyze tool with enum constraints from actual DB values."""
    req_keys = [str(n) for n in request_numbers]
    return {
        "name": "submit_analysis",
        "description": "Submit objection analysis for each request.",
        "input_schema": {
            "type": "object",
            "properties": {
                "analyses": {
                    "type": "object",
                    "description": "Map of request number (as string) to analysis. Keys must be request numbers.",
                    "properties": {
                        key: {
                            "type": "object",
                            "properties": {
                                "objections": {
                                    "type": "array",
                                    "items": {
                                        "type": "string",
                                        "enum": valid_short_names,
                                    },
                                    "description": "List of applicable objection short_names"
                                }
                            },
                            "required": ["objections"]
                        }
                        for key in req_keys
                    },
                    "required": req_keys,
                }
            },
            "required": ["analyses"]
        }
    }


class RFPExtractor:
    """Extracts RFP information and analyzes requests using Claude."""

    def __init__(self):
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is required")
        self.client = Anthropic(api_key=api_key)
        from config import settings
        self.model = settings.extraction_model

    def extract_rfp_info(self, text: str) -> dict:
        """Extract case/party info from the first ~2 pages of an RFP."""
        message = self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            system="""You are a legal document analyzer. Extract case and party information from this Request for Production of Documents.
Focus on: court name, case number, plaintiff(s), defendant(s), propounding party, responding party, set number, and document title.
Use \\n for line breaks in the court name. Be precise and extract exactly what appears.

IMPORTANT: Also generate a response_document_title — this is the title for the RESPONSE document being drafted by the responding party. Format it as the responding party's name followed by their responses to the propounding party's requests. Example: if the RFP is "DEFENDANT CITY OF FRESNO'S FIRST SET OF REQUESTS FOR PRODUCTION TO PLAINTIFF", the response title should be "PLAINTIFF JOHN DOE'S RESPONSES TO DEFENDANT CITY OF FRESNO'S FIRST SET OF REQUESTS FOR PRODUCTION OF DOCUMENTS". Use ALL CAPS.""",
            tools=[EXTRACT_RFP_INFO_TOOL],
            tool_choice={"type": "tool", "name": "submit_rfp_info"},
            messages=[
                {"role": "user", "content": f"Extract RFP information from this document:\n\n{text}"}
            ]
        )
        _log_usage("extract_info", message)

        for block in message.content:
            if block.type == "tool_use" and block.name == "submit_rfp_info":
                result = block.input
                # Clean up \\n to real newlines in court_name
                if result.get("court_name"):
                    result["court_name"] = result["court_name"].replace("\\n", "\n")
                return result

        raise ValueError("Failed to extract RFP info - no tool call received")

    def extract_rfp_requests(self, text: str) -> list:
        """Extract individual requests with verbatim text from full document."""
        message = self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            system="""You are a legal document analyzer. Extract each Request for Production from this document.

CRITICAL: Copy each request's text EXACTLY as written - do NOT fix typos, rephrase, or modify the text in any way. The text must be verbatim.

Requests typically follow patterns like:
- "REQUEST FOR PRODUCTION NO. 1:"
- "REQUEST NO. 1:"
- "DEMAND NO. 1:"
- Numbered paragraphs within the requests section

Extract ALL requests found in the document.""",
            tools=[EXTRACT_RFP_REQUESTS_TOOL],
            tool_choice={"type": "tool", "name": "submit_rfp_requests"},
            messages=[
                {"role": "user", "content": f"Extract all requests for production from this document. Copy each request's text VERBATIM:\n\n{text}"}
            ]
        )
        _log_usage("extract_requests", message)

        for block in message.content:
            if block.type == "tool_use" and block.name == "submit_rfp_requests":
                return block.input.get("requests", [])

        raise ValueError("Failed to extract requests - no tool call received")

    def analyze_requests(self, requests: list, objections: list) -> dict:
        """Analyze requests and suggest applicable objections.

        Args:
            requests: List of {number, text} dicts
            objections: List of {short_name, name, formal_language} dicts
        Returns:
            Dict mapping request numbers to {objections: [short_names]}
        """
        objections_desc = "\n".join(
            f"- {o['short_name']}: {o['name']}" + (f"\n  Notes: {o['ai_notes']}" if o.get('ai_notes') else "")
            for o in objections
        )

        requests_text = "\n\n".join(
            f"REQUEST NO. {r['number']}:\n{r['text']}"
            for r in requests
        )

        valid_short_names = [o['short_name'] for o in objections]
        request_numbers = [r['number'] for r in requests]
        analyze_tool = _build_analyze_tool(valid_short_names, request_numbers)

        message = self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            system=f"""You are a legal analyst reviewing Requests for Production of Documents. For each request, determine which objections from the available list are reasonably applicable.

Available objections (use the short_name values). Where "Notes" are provided, follow them carefully — they are guidance from the attorney on when to apply or not apply each objection:
{objections_desc}

Be judicious — only suggest objections that are genuinely applicable. Most requests will have 2-4 applicable objections. Pay close attention to the attorney's notes for each objection when deciding whether to apply it.""",
            tools=[analyze_tool],
            tool_choice={"type": "tool", "name": "submit_analysis"},
            messages=[
                {"role": "user", "content": f"Analyze these requests and suggest applicable objections:\n\n{requests_text}"}
            ]
        )
        _log_usage("analyze", message)

        for block in message.content:
            if block.type == "tool_use" and block.name == "submit_analysis":
                return block.input.get("analyses", {})

        raise ValueError("Failed to analyze requests - no tool call received")


# Singleton pattern
_extractor: Optional[RFPExtractor] = None


def get_rfp_extractor() -> RFPExtractor:
    """Get or create the singleton RFPExtractor instance."""
    global _extractor
    if _extractor is None:
        _extractor = RFPExtractor()
    return _extractor


def extract_rfp_info(text: str) -> dict:
    """Extract RFP case/party info. Convenience function."""
    return get_rfp_extractor().extract_rfp_info(text)


def extract_rfp_requests(text: str) -> list:
    """Extract individual requests. Convenience function."""
    return get_rfp_extractor().extract_rfp_requests(text)


def analyze_requests(requests: list, objections: list) -> dict:
    """Analyze requests for objections. Convenience function."""
    return get_rfp_extractor().analyze_requests(requests, objections)
