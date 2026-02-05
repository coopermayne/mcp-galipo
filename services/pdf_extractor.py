"""
PDF text extraction service.

Extracts text content from PDF files using PyPDF2.
"""

from io import BytesIO
from pypdf import PdfReader


def extract_text_from_pdf(file_bytes: bytes, max_pages: int = 2) -> str:
    """
    Extract text from the first N pages of a PDF.

    Args:
        file_bytes: Raw PDF file bytes
        max_pages: Maximum number of pages to extract (default: 2)

    Returns:
        Extracted text content as a string

    Raises:
        ValueError: If the PDF cannot be read or has no extractable text
    """
    try:
        pdf_file = BytesIO(file_bytes)
        reader = PdfReader(pdf_file)

        if len(reader.pages) == 0:
            raise ValueError("PDF has no pages")

        # Extract text from the first N pages
        pages_to_read = min(max_pages, len(reader.pages))
        text_parts = []

        for i in range(pages_to_read):
            page = reader.pages[i]
            text = page.extract_text()
            if text:
                text_parts.append(f"--- Page {i + 1} ---\n{text}")

        if not text_parts:
            raise ValueError("No extractable text found in PDF. The document may be scanned/image-based.")

        return "\n\n".join(text_parts)

    except Exception as e:
        if isinstance(e, ValueError):
            raise
        raise ValueError(f"Failed to read PDF: {str(e)}")
