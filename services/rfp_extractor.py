"""
RFP (Request for Production) extraction and analysis service.

Uses Claude to:
1. Extract case/party info from the first 2 pages of an RFP
2. Extract individual requests with verbatim text
3. Analyze requests and suggest applicable objections
"""

import os
from typing import Optional
from anthropic import Anthropic


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
                "description": "Full title of the RFP document"
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

ANALYZE_REQUESTS_TOOL = {
    "name": "submit_analysis",
    "description": "Submit objection analysis for each request.",
    "input_schema": {
        "type": "object",
        "properties": {
            "analyses": {
                "type": "object",
                "description": "Map of request number (as string) to analysis",
                "additionalProperties": {
                    "type": "object",
                    "properties": {
                        "objections": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of applicable objection short_names"
                        }
                    },
                    "required": ["objections"]
                }
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
        self.model = "claude-3-5-haiku-20241022"

    def extract_rfp_info(self, text: str) -> dict:
        """Extract case/party info from the first ~2 pages of an RFP."""
        message = self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            system="""You are a legal document analyzer. Extract case and party information from this Request for Production of Documents.
Focus on: court name, case number, plaintiff(s), defendant(s), propounding party, responding party, set number, and document title.
Use \\n for line breaks in the court name. Be precise and extract exactly what appears.""",
            tools=[EXTRACT_RFP_INFO_TOOL],
            tool_choice={"type": "tool", "name": "submit_rfp_info"},
            messages=[
                {"role": "user", "content": f"Extract RFP information from this document:\n\n{text}"}
            ]
        )

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
            f"- {o['short_name']}: {o['name']}"
            for o in objections
        )

        requests_text = "\n\n".join(
            f"REQUEST NO. {r['number']}:\n{r['text']}"
            for r in requests
        )

        message = self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            system=f"""You are a legal analyst reviewing Requests for Production of Documents. For each request, determine which objections from the available list are reasonably applicable.

Available objections (use the short_name values):
{objections_desc}

Guidelines:
- "vague" applies when terms are undefined or ambiguous
- "overbroad" applies when the scope is unreasonably broad (e.g., "all documents", no time limit)
- "attorney_client" applies when the request could encompass privileged communications
- "work_product" applies when the request could reach litigation preparation materials
- "relevance" applies when the connection to the case is tenuous
- "burdensome" applies when compliance would be extremely costly/difficult
- "compound" applies when one request asks for multiple unrelated categories
- "privacy" applies when personal/medical/financial info of non-parties is sought
- "equally_available" applies when the requesting party has equal access to the info
- "trade_secret" applies when proprietary business information is sought

Be judicious — only suggest objections that are genuinely applicable. Most requests will have 2-4 applicable objections.""",
            tools=[ANALYZE_REQUESTS_TOOL],
            tool_choice={"type": "tool", "name": "submit_analysis"},
            messages=[
                {"role": "user", "content": f"Analyze these requests and suggest applicable objections:\n\n{requests_text}"}
            ]
        )

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
