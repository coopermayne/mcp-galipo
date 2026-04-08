"""
Table of Authorities extraction service.

Accepts PDF uploads and extracts per-page text with pypdf for accurate
printed-page numbering. Sends text to Claude to identify and categorize
all legal citations.
"""

import json
import logging
import re
from io import BytesIO

from anthropic import Anthropic
from pypdf import PdfReader

from config import settings

_logger = logging.getLogger("services.toa_extractor")


def extract_text_with_pages(pdf_bytes: bytes) -> list[dict]:
    """
    Extract text from a PDF file, one entry per page.

    Returns:
        List of {"page": int, "text": str} dicts.
    """
    try:
        reader = PdfReader(BytesIO(pdf_bytes))
    except Exception as e:
        raise ValueError(f"Could not read PDF: {e}")

    if len(reader.pages) == 0:
        raise ValueError("PDF has no pages")

    pages: list[dict] = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text()
        if text and text.strip():
            pages.append({"page": i + 1, "text": text.strip()})

    if not pages:
        raise ValueError(
            "No extractable text found. The document may be scanned/image-based."
        )

    return pages


def _format_pages_for_prompt(pages: list[dict]) -> str:
    """Format page-segmented text for the Claude prompt."""
    parts = []
    for p in pages:
        parts.append(f"--- PAGE {p['page']} ---\n{p['text']}")
    return "\n\n".join(parts)


# Claude system prompt for citation extraction (from spec)
_SYSTEM_PROMPT = """You are a legal citation extraction engine. You will receive the full text of a legal brief with page numbers indicated. Your job is to identify every legal authority cited in the brief and return structured JSON.

## Instructions

1. Read the entire brief including footnotes.

2. Extract every legal authority: cases, constitutional provisions, statutes, regulations, court rules, and secondary sources (law review articles, treatises).

3. Recognize ALL citation forms:
   - Full citations: Smith v. Jones, 500 F.3d 115, 120 (9th Cir. 2008)
   - Short-form: Smith, 500 F.3d at 122
   - Id. citations: resolve each "Id." or "Id. at ___" to the immediately preceding cited authority. Track a running pointer \u2014 when you see a full or short cite, update the pointer. "Id." refers to whatever the pointer currently holds. The pointer carries across page boundaries. In footnotes, if the first cite is "Id.", it refers to the last body-text authority before the footnote marker.
   - Supra and hereinafter references: resolve to the original authority.
   - Parenthetical citations (e.g., "(citing Smith, 500 F.3d at 120)") \u2014 the cited authority inside the parenthetical is a separate reference.
   - Signal words (See, See also, Cf., etc.) do not change the authority identity.

4. Normalize and deduplicate. Group all forms of the same authority under one canonical Bluebook citation. For cases, use the full case name as it first appears in the brief.

5. Record every page on which each authority appears. Each page number appears only once per authority. Sort ascending.

6. Categorize each authority:
   - "case"
   - "constitutional_provision"
   - "statute"
   - "rule"
   - "other" (secondary sources, treatises, law review articles)

7. For cases, separate the case name from the reporter citation. The case name is everything before the first comma that precedes the reporter volume number. For example: name="Graham v. Connor", cite="490 U.S. 386 (1989)".

8. For "other" authorities with italicized titles (law review articles, books), separate: author, title (the italicized part), and the rest of the citation.

9. Flag any issues:
   - If a case is mentioned by name but no reporter citation appears anywhere: add flag "full_cite_not_found"
   - If an Id. reference is ambiguous: add flag "id_ambiguous"
   - If two short forms might be the same case: add flag "possible_duplicate"
   - If a citation appears inconsistent across the brief (different reporter pages, wrong volume): add flag "citation_inconsistency"
   - If a long cite is used where a short form is expected: add flag "long_cite_expected_short"
   - If a case name is incomplete — e.g., only one party name like "Scott" instead of "Scott v. Harris", or a short-form name used as the canonical cite because no full "X v. Y" name appears in the brief: add flag "incomplete_case_name"
   - If a short-form citation appears before the full citation in the brief (the first reference to any authority should be the full cite): add flag "short_before_full" and note which page the short cite appears on vs. where the full cite first appears
   - If the full citation (with full case name + reporter + court + year) is used more than once when subsequent references should use short form: add flag "repeated_full_cite" and note which pages have the redundant full citations
   For each flag, also include a "flag_messages" array with human-readable explanations.

## Response Format

Return ONLY valid JSON, no markdown backticks, no preamble. Use this exact schema:

{
  "authorities": [
    {
      "category": "case",
      "name": "Graham v. Connor",
      "cite": "490 U.S. 386 (1989)",
      "pages": [21, 26, 27, 28, 35, 37, 38],
      "flags": [],
      "flag_messages": []
    },
    {
      "category": "constitutional_provision",
      "text": "U.S. Const. amend. IV",
      "pages": [2, 4, 11, 26, 27],
      "flags": [],
      "flag_messages": []
    },
    {
      "category": "statute",
      "text": "42 U.S.C. \u00a7 1983",
      "pages": [25],
      "flags": [],
      "flag_messages": []
    },
    {
      "category": "other",
      "author": "Kimberle Crenshaw & Gary Peller, ",
      "title": "Reel Time/Real Justice",
      "rest": ", 70 Denv. U. L. Rev. 283 (1993)",
      "pages": [34],
      "flags": [],
      "flag_messages": []
    }
  ]
}

For cases: include "name" and "cite" fields.
For constitutional_provision, statute, rule: include "text" field.
For other: include "author", "title", and "rest" fields.
All entries include "pages" (array of integers), "flags" (array of strings, empty if none), and "flag_messages" (array of strings, empty if none)."""


def extract_authorities(file_bytes: bytes) -> dict:
    """
    Extract all legal authorities from a .docx brief.

    1. Parses the .docx to get page-segmented text
    2. Sends text to Claude for citation extraction
    3. Returns parsed authorities with flags

    Args:
        file_bytes: Raw .docx file bytes

    Returns:
        Dict with "authorities" list and "page_count" int

    Raises:
        ValueError: If file can't be read or extraction fails
    """
    # Step 1: Extract text with page tracking
    pages = extract_text_with_pages(file_bytes)
    page_count = len(pages)
    formatted_text = _format_pages_for_prompt(pages)

    # Safety check on size
    if len(formatted_text) > 200_000:
        _logger.warning(
            f"Brief text is very long ({len(formatted_text)} chars). Truncating."
        )
        formatted_text = formatted_text[:200_000]

    # Step 2: Call Claude
    client = Anthropic(api_key=settings.anthropic_api_key)
    model = "claude-sonnet-4-20250514"

    user_message = (
        "Here is the full text of a legal brief. Page boundaries are marked "
        'with "--- PAGE X ---" headers. Extract all citations and return JSON '
        "per your instructions.\n\n" + formatted_text
    )

    _logger.info(f"Sending {page_count}-page brief to Claude ({model}) for extraction")

    response = client.messages.create(
        model=model,
        max_tokens=8000,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    # Step 3: Parse JSON response
    response_text = ""
    for block in response.content:
        if block.type == "text":
            response_text += block.text

    # Strip markdown code fences if present
    response_text = response_text.strip()
    if response_text.startswith("```"):
        response_text = re.sub(r"^```(?:json)?\s*", "", response_text)
        response_text = re.sub(r"\s*```$", "", response_text)

    try:
        result = json.loads(response_text)
    except json.JSONDecodeError:
        # Retry once with a nudge
        _logger.warning("First extraction returned invalid JSON, retrying...")
        retry_response = client.messages.create(
            model=model,
            max_tokens=8000,
            system=_SYSTEM_PROMPT,
            messages=[
                {"role": "user", "content": user_message},
                {"role": "assistant", "content": response_text},
                {
                    "role": "user",
                    "content": (
                        "Your previous response was not valid JSON. "
                        "Return ONLY the JSON object, no other text."
                    ),
                },
            ],
        )
        retry_text = ""
        for block in retry_response.content:
            if block.type == "text":
                retry_text += block.text
        retry_text = retry_text.strip()
        if retry_text.startswith("```"):
            retry_text = re.sub(r"^```(?:json)?\s*", "", retry_text)
            retry_text = re.sub(r"\s*```$", "", retry_text)
        try:
            result = json.loads(retry_text)
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse citation extraction result: {e}")

    authorities = result.get("authorities", [])
    _logger.info(f"Extracted {len(authorities)} authorities from brief")

    return {
        "authorities": authorities,
        "page_count": page_count,
    }
