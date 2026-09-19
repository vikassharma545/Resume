"""Checks that the résumé files parse cleanly in applicant-tracking systems.

Run:  python -m pytest tests/resume_check.py -q
Needs: pip install python-docx
"""
import re
import zipfile
from collections import Counter
from pathlib import Path

import pytest
from docx import Document

ROOT = Path(__file__).resolve().parent.parent
RESUMES = sorted((ROOT / "resume").glob("*.docx"))

# characters that older parsers mangle or that carry meaning a parser cannot read
RISKY_CHARS = "★·×→₹—–"
REQUIRED_HEADINGS = ["PROFESSIONAL SUMMARY", "TECHNICAL SKILLS", "PROFESSIONAL EXPERIENCE", "PROJECTS", "EDUCATION", "CODING PROFILES"]


def _text(path):
    return "\n".join(p.text for p in Document(path).paragraphs)


@pytest.fixture(params=RESUMES, ids=[p.name for p in RESUMES])
def resume(request):
    return request.param


def test_three_resumes_named_for_the_person(resume):
    assert resume.name.startswith("Vikas-Sharma-"), f"{resume.name} should carry the candidate's name for recruiters and parsers"


def test_no_layout_features_that_break_parsers(resume):
    z = zipfile.ZipFile(resume)
    doc = z.read("word/document.xml").decode("utf-8")
    parts = z.namelist()
    assert "<w:tbl>" not in doc, "tables scramble parsed text order"
    assert "txbxContent" not in doc, "text boxes are skipped by many parsers"
    assert "<w:drawing>" not in doc, "images are invisible to parsers"
    assert not re.search(r'<w:cols [^>]*num="[2-9]"', doc), "multi-column layouts interleave text"
    assert not [p for p in parts if re.match(r"word/(header|footer)\d*\.xml", p)], "headers and footers are often dropped"
    assert "commentRangeStart" not in doc and "<w:ins " not in doc and "<w:del " not in doc, "comments or tracked changes present"


def test_contact_details_in_body_text(resume):
    text = _text(resume)
    assert "+91-9354176313" in text and "jnv2252@gmail.com" in text
    assert "linkedin.com/in/vikas-sharma-coder" in text and "github.com/vikassharma545" in text


def test_standard_section_headings_present(resume):
    lines = [p.text.strip() for p in Document(resume).paragraphs]
    for h in REQUIRED_HEADINGS:
        assert h in lines, f"missing standalone heading {h!r}"


def test_no_risky_characters(resume):
    found = Counter(ch for ch in _text(resume) if ch in RISKY_CHARS)
    assert not found, f"replace these with plain ASCII: {dict(found)}"


def test_bullets_are_real_word_lists(resume):
    doc = zipfile.ZipFile(resume).read("word/document.xml").decode("utf-8")
    assert "<w:numPr>" in doc and "•" not in doc


def test_star_counts_are_current(resume):
    text = _text(resume)
    assert "32 GitHub stars" in text, "pyzdata star count is stale"
    assert "28 stars, 9 forks" in text, "KiteWeb star count is stale"


def test_core_keywords_present(resume):
    text = _text(resume).lower()
    for kw in ["python", "sql", "rest", "docker", "aws", "git", "linux", "object-oriented", "data structures and algorithms", "unit test"]:
        assert kw in text, f"keyword missing: {kw}"


def test_no_expanded_letter_spacing(resume):
    # expanded character spacing makes PDF text extractors insert spaces inside words ("TECHNICA L SKILLS")
    doc = zipfile.ZipFile(resume).read("word/document.xml").decode("utf-8")
    spaced = re.findall(r"<w:rPr>(?:(?!</w:rPr>).)*<w:spacing w:val=\"(-?\d+)\"", doc, flags=re.S)
    assert not [v for v in spaced if int(v) != 0], f"runs with letter spacing found: {spaced}"
