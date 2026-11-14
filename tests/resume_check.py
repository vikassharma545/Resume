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
from docx.enum.text import WD_TAB_ALIGNMENT
from docx.oxml.ns import qn
from docx.shared import Pt

ROOT = Path(__file__).resolve().parent.parent
# the public Software Engineer résumé plus the role variants kept in the git-ignored private/ folder
RESUMES = sorted((ROOT / "resume").glob("*.docx")) + sorted((ROOT / "private").glob("*.docx"))

# characters that older parsers mangle or that carry meaning a parser cannot read
RISKY_CHARS = "★·×→₹—–"
REQUIRED_HEADINGS = ["PROFESSIONAL SUMMARY", "TECHNICAL SKILLS", "PROFESSIONAL EXPERIENCE", "PROJECTS", "EDUCATION", "CODING PROFILES"]


MONTH_YEAR = r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4}\b"


def _text(path):
    return "\n".join(p.text for p in Document(path).paragraphs)


def _experience(text):
    return text.split("PROFESSIONAL EXPERIENCE")[1].split("PROJECTS")[0]


ROLES = ["Software-Engineer", "Python-Developer", "Data-Engineer", "Quantitative-Developer", "Data-Analyst"]


# phrases each role's job listings search for, all honestly backed by his work (review, 2026-11-13)
ROLE_KEYWORDS = {
    "Software-Engineer": ["software engineer", "microservices", "rest apis", "data pipelines"],
    "Python-Developer": ["python developer", "(oop)", "microservices", "api integration", "rest apis"],
    "Data-Engineer": ["data engineer", "etl pipelines", "data ingestion", "window functions", "parquet"],
    "Quantitative-Developer": ["quantitative developer", "derivatives", "f&o", "backtesting"],
    "Data-Analyst": ["data analyst", "data analysis", "data visualization", "exploratory data analysis", "dashboards"],
}


def test_all_five_resumes_exist():
    for role in ROLES:
        folder = ROOT / ("resume" if role == "Software-Engineer" else "private")
        for ext in (".docx", ".pdf"):
            assert (folder / f"Vikas-Sharma-{role}{ext}").exists(), f"missing {folder.name}/{role}{ext}"


@pytest.fixture(params=RESUMES, ids=[p.name for p in RESUMES])
def resume(request):
    return request.param


def test_resumes_named_for_the_person(resume):
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
    assert "34 GitHub stars" in text, "pyzdata star count is stale"
    assert "27 stars, 11 forks" in text, "KiteWeb star count is stale"


def test_true_timeline(resume):
    # full-time since graduating; the college internship is mentioned in words only
    text = _text(resume)
    assert "Software Engineer - Pranjali Growcap Pvt. Ltd.\tJul 2023 - Present" in text
    assert "Jul 2022" not in text and "Feb 2024" not in text, "old, untrue dates are back"
    assert re.findall(MONTH_YEAR, _experience(text)) == ["Jul 2023"], "one dated role; the internship stays in words"


def test_no_invented_levels(resume):
    # the startup has no levels and he was never promoted; senior verbs push him into SE-2 loops
    text = _text(resume).lower()
    for word in ["software engineer ii", "expert", "architected", "engineered", "enterprise-grade"]:
        assert word not in text, f"remove {word!r}"
    assert not re.search(r"\b(?:engineer|developer|sde|se)[\s-]*(?:i{2,}|[2-9])\b|\bsenior\b|\bsde\b", text), \
        "a level or seniority word is back (II, 2, SDE, senior)"


def test_pyzdata_facts_current(resume):
    text = _text(resume)
    assert "1.2.0" in text and "159 unit tests" in text
    assert "parallel download" not in text.lower(), "pyzdata 1.2.0 downloads sequentially"


def _font_pt(doc, paragraph):
    run = paragraph.runs[0]
    if run.font.size:
        return run.font.size.pt
    style = paragraph.style
    while style is not None:
        if style.font.size:
            return style.font.size.pt
        style = style.base_style
    sz = doc.styles.element.find(qn("w:docDefaults")).find(qn("w:rPrDefault")).find(qn("w:rPr")).find(qn("w:sz"))
    return int(sz.get(qn("w:val"))) / 2 if sz is not None else 10.0  # Word's default when nothing sets a size


def test_bullets_match_body_text_size(resume):
    doc = Document(resume)
    paras = doc.paragraphs
    summary = paras[[p.text.strip() for p in paras].index("PROFESSIONAL SUMMARY") + 1]
    bullet = next(p for p in paras if p.style.name == "List Paragraph")
    assert _font_pt(doc, bullet) == _font_pt(doc, summary), "bullet text and body text differ in size"


def test_no_frameworks_he_has_not_used(resume):
    # the owner has built no Flask or Django project, and none with FastAPI is known; interviewers would probe them
    text = _text(resume).lower()
    for name in ["flask", "django", "fastapi"]:
        assert name not in text, f"remove {name}"


def test_education_date_on_the_degree_line(resume):
    # a right-tab date is read as a separate line by some PDF parsers, losing the graduation year
    assert "University of Delhi, 2020 - 2023" in _text(resume)


def test_mysql_claim_backed_by_certificates(resume):
    # a MySQL claim needs evidence: his production use in the trading SDK (named in the experience section),
    # or his Udemy MySQL Bootcamp and HackerRank SQL certificates; HackerRank is named once (twice reads as padding)
    text = _text(resume)
    if "MySQL" in text and "MySQL" not in _experience(text):
        assert "CERTIFICATIONS" in [p.strip() for p in text.splitlines()], "MySQL claimed without the certificates"
    assert text.count("HackerRank") <= 1, "HackerRank listed twice"


def test_role_keywords_present(resume):
    role = resume.stem.removeprefix("Vikas-Sharma-")
    text = _text(resume).lower()
    missing = [k for k in ROLE_KEYWORDS[role] if k not in text]
    assert not missing, f"{role} misses {missing}"


def test_no_ai_made_projects(resume):
    # the owner said pc-alerts was made by AI, so it is not his work to list
    assert "pc-alerts" not in _text(resume).lower()


def test_contact_links_are_hyperlinks(resume):
    # read links from the body: package rels outlive the paragraphs that used them
    linked = {h.address for p in Document(resume).paragraphs for h in p.hyperlinks}
    for url in ["mailto:jnv2252@gmail.com", "https://www.linkedin.com/in/vikas-sharma-coder",
                "https://github.com/vikassharma545", "https://pypi.org/project/pyzdata/"]:
        assert url in linked, f"{url} is not a clickable link"


def test_employer_work_names_no_brokers(resume):
    if "Quantitative" in resume.name:
        pytest.skip("the quant résumé may name brokers")
    assert not re.findall(r"(?i)\b(?:zerodha|kite|ibkr|interactive brokers|xts|tws)\b", _experience(_text(resume))), \
        "employer work names a broker"


def test_file_properties_name_the_candidate(resume):
    # File > Info is visible to anyone who opens the résumé; it showed the employer's account
    props = Document(resume).core_properties
    assert (props.author, props.last_modified_by) == ("Vikas Sharma", "Vikas Sharma")


def test_right_aligned_dates_reach_the_margin(resume):
    doc = Document(resume)
    s = doc.sections[0]
    width = s.page_width - s.left_margin - s.right_margin
    stops = [t.position for p in doc.paragraphs for t in p.paragraph_format.tab_stops
             if t.alignment == WD_TAB_ALIGNMENT.RIGHT]
    assert stops and all(abs(pos - width) <= Pt(1) for pos in stops), "dates stop short of the heading rules"


def test_core_keywords_present(resume):
    text = _text(resume).lower()
    for kw in ["python", "sql", "rest", "docker", "aws", "git", "linux", "object-oriented", "data structures and algorithms", "unit test"]:
        assert kw in text, f"keyword missing: {kw}"


def test_no_expanded_letter_spacing(resume):
    # expanded character spacing makes PDF text extractors insert spaces inside words ("TECHNICA L SKILLS")
    doc = zipfile.ZipFile(resume).read("word/document.xml").decode("utf-8")
    spaced = re.findall(r"<w:rPr>(?:(?!</w:rPr>).)*<w:spacing w:val=\"(-?\d+)\"", doc, flags=re.S)
    assert not [v for v in spaced if int(v) != 0], f"runs with letter spacing found: {spaced}"
