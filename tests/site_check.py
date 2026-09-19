"""Automated quality checks for the resume site.

Run:  python -m pytest tests/site_check.py -q
Needs: pip install pytest playwright && python -m playwright install chromium

Set SITE_URL to check a deployed copy instead of the local files, e.g.
  SITE_URL=https://vikassharma545.github.io/Resume/ python -m pytest tests -q
"""
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent

RESUME_FILES = [
    "resume/QuantitativeDev.docx",
    "resume/PythonDev.docx",
    "resume/SDE.docx",
]

# JS helpers evaluated inside the page --------------------------------------

JS_VISIBLE_TEXT_ELEMENTS = """
() => {
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  const seen = new Set();
  let el;
  while ((el = walker.nextNode())) {
    if (['SCRIPT','STYLE','NOSCRIPT','TEMPLATE','SVG','CANVAS'].includes(el.tagName)) continue;
    const own = Array.from(el.childNodes)
      .filter(n => n.nodeType === Node.TEXT_NODE)
      .map(n => n.textContent).join('').trim();
    if (!own) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (!el.getClientRects().length) continue;
    // skip elements hidden by an ancestor with display:none (rects would be empty) or visibility
    let hiddenByAncestor = false;
    for (let a = el.parentElement; a; a = a.parentElement) {
      const acs = getComputedStyle(a);
      if (acs.visibility === 'hidden' || acs.display === 'none') { hiddenByAncestor = true; break; }
    }
    if (hiddenByAncestor) continue;
    const path = [];
    for (let a = el; a && a !== document.body; a = a.parentElement) {
      path.unshift(a.tagName.toLowerCase() + (a.id ? '#' + a.id : '') +
        (a.classList.length ? '.' + Array.from(a.classList).slice(0, 2).join('.') : ''));
    }
    out.push({
      text: own.slice(0, 40),
      selector: path.slice(-3).join(' > '),
      fontSize: parseFloat(cs.fontSize),
      fontWeight: parseInt(cs.fontWeight, 10) || 400,
      color: (el.namespaceURI === 'http://www.w3.org/2000/svg' && cs.fill && cs.fill.startsWith('rgb')) ? cs.fill : cs.color,
      bg: (() => {
        // effective background: composite ancestor background colours, outermost first
        const chain = [];
        for (let a = el; a; a = a.parentElement) chain.unshift(a);
        let r = null, g = null, b = null; // null = still transparent
        let uncertain = false;
        for (const a of chain) {
          const acs = getComputedStyle(a);
          if (acs.backgroundImage && acs.backgroundImage !== 'none') uncertain = true;
          const m = acs.backgroundColor.match(/rgba?\\(([^)]+)\\)/);
          if (!m) continue;
          const p = m[1].split(',').map(s => parseFloat(s));
          const al = p.length > 3 ? p[3] : 1;
          if (al <= 0) continue;
          if (r === null || al >= 1) { r = p[0]; g = p[1]; b = p[2]; if (al >= 1) uncertain = uncertain && false; }
          else { r = p[0]*al + r*(1-al); g = p[1]*al + g*(1-al); b = p[2]*al + b*(1-al); }
        }
        if (r === null) { r = 255; g = 255; b = 255; }
        return { r, g, b, uncertain };
      })(),
    });
  }
  return out;
}
"""


def _lum(r, g, b):
    def ch(c):
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def _contrast(fg, bg):
    l1, l2 = _lum(*fg), _lum(*bg)
    hi, lo = max(l1, l2), min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)


def _parse_rgb(s):
    inner = s[s.index('(') + 1:s.index(')')]
    parts = [float(p) for p in inner.split(',')]
    return parts[0], parts[1], parts[2]


# Fixtures -------------------------------------------------------------------

def _free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture(scope="session")
def site_url():
    url = os.environ.get("SITE_URL")
    if url:
        yield url
        return
    port = _free_port()
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1", "--directory", str(ROOT)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    deadline = time.time() + 10
    while time.time() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.5):
                break
        except OSError:
            time.sleep(0.1)
    try:
        yield f"http://127.0.0.1:{port}/"
    finally:
        proc.terminate()


@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch()
        yield b
        b.close()


def _open(browser, url, width=1440, height=900, mobile=False):
    ctx = browser.new_context(viewport={"width": width, "height": height}, is_mobile=mobile, has_touch=mobile)
    page = ctx.new_page()
    logs = {"errors": [], "failed": []}
    page.on("console", lambda m: logs["errors"].append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: logs["errors"].append(str(e)))
    page.on("requestfailed", lambda r: logs["failed"].append(r.url))
    page.goto(url, wait_until="networkidle", timeout=60000)
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(400)
    return ctx, page, logs


@pytest.fixture
def desktop(browser, site_url):
    ctx, page, logs = _open(browser, site_url)
    yield page, logs
    ctx.close()


@pytest.fixture
def phone(browser, site_url):
    ctx, page, logs = _open(browser, site_url, 390, 844, mobile=True)
    yield page, logs
    ctx.close()


# Tests ----------------------------------------------------------------------

EXTERNAL_APIS = ("api.github.com", "pypi.org")


def test_no_console_errors_or_failed_requests(desktop):
    page, logs = desktop
    # live-count requests to GitHub and PyPI may be rate limited; the page falls back to baked-in numbers
    errors = [e for e in logs["errors"] if not any(h in e for h in EXTERNAL_APIS)]
    failed = [f for f in logs["failed"] if not any(h in f for h in EXTERNAL_APIS)]
    assert errors == [], errors
    assert failed == [], failed


def test_no_horizontal_overflow_at_phone_width(phone):
    page, _ = phone
    sw, cw = page.evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]")
    assert sw <= cw, f"page scrolls sideways on a phone: scrollWidth={sw} clientWidth={cw}"


def test_internal_anchor_targets_exist(desktop):
    page, _ = desktop
    missing = page.evaluate("""() => Array.from(document.querySelectorAll('a[href^="#"]'))
        .map(a => a.getAttribute('href')).filter(h => h.length > 1 && !document.querySelector(h))""")
    assert missing == [], f"anchors with no target: {missing}"


def test_all_visible_text_meets_wcag_contrast(desktop):
    page, _ = desktop
    els = page.evaluate(JS_VISIBLE_TEXT_ELEMENTS)
    assert els, "no visible text found"
    bad = []
    for e in els:
        if e["bg"]["uncertain"]:
            continue
        fg = _parse_rgb(e["color"])
        bg = (e["bg"]["r"], e["bg"]["g"], e["bg"]["b"])
        ratio = _contrast(fg, bg)
        large = e["fontSize"] >= 24 or (e["fontSize"] >= 18.66 and e["fontWeight"] >= 700)
        need = 3.0 if large else 4.5
        if ratio < need:
            bad.append(f"{ratio:.2f}:1 (need {need}) '{e['text']}' at {e['selector']}")
    assert bad == [], "low-contrast text:\n" + "\n".join(bad)


def test_no_visible_text_smaller_than_13px(desktop):
    page, _ = desktop
    els = page.evaluate(JS_VISIBLE_TEXT_ELEMENTS)
    small = [f"{e['fontSize']:.1f}px '{e['text']}' at {e['selector']}" for e in els if e["fontSize"] < 13]
    assert small == [], "text below 13px:\n" + "\n".join(small)


def test_hero_shows_a_loaded_portrait(desktop):
    page, _ = desktop
    info = page.evaluate("""() => {
        const img = document.querySelector('#hero img');
        return img ? { alt: img.alt, w: img.naturalWidth } : null; }""")
    assert info is not None, "no <img> inside #hero"
    assert info["w"] > 0, "hero image did not load"
    assert "Vikas" in info["alt"], f"portrait alt text should name the person, got {info['alt']!r}"


def test_projects_have_figures_with_captions(desktop):
    page, _ = desktop
    n = page.evaluate("""() => Array.from(document.querySelectorAll('#projects figure'))
        .filter(f => f.querySelector('svg[role="img"][aria-label]') && f.querySelector('figcaption')).length""")
    assert n >= 3, f"expected at least 3 captioned SVG figures in #projects, found {n}"


def test_every_resume_variant_is_linked_and_present(desktop):
    page, _ = desktop
    hrefs = page.evaluate("() => Array.from(document.querySelectorAll('a[href]')).map(a => a.getAttribute('href'))")
    for f in RESUME_FILES:
        assert (ROOT / f).exists(), f"missing file {f}"
        assert f in hrefs, f"{f} is not linked anywhere on the page"


def test_share_image_declared_and_present(desktop):
    page, _ = desktop
    og = page.evaluate("() => document.querySelector('meta[property=\"og:image\"]')?.content || ''")
    tw = page.evaluate("() => document.querySelector('meta[name=\"twitter:image\"]')?.content || ''")
    assert og.endswith("assets/og.png"), f"og:image should point at assets/og.png, got {og!r}"
    assert tw.endswith("assets/og.png"), f"twitter:image should point at assets/og.png, got {tw!r}"
    assert (ROOT / "assets" / "og.png").exists(), "assets/og.png is missing"


def test_headline_is_bold_plain_sans(desktop):
    page, _ = desktop
    fam, weight = page.evaluate("() => { const cs = getComputedStyle(document.querySelector('h1')); return [cs.fontFamily, parseInt(cs.fontWeight, 10)]; }")
    loaded = page.evaluate("() => document.fonts.check('bold 40px \"Instrument Sans\"')")
    assert fam.lstrip('"').lower().startswith("instrument sans"), f"h1 font-family is {fam}"
    assert weight >= 700, f"h1 should be bold, weight is {weight}"
    assert loaded, "bold Instrument Sans is declared but never loaded"
    serif_users = page.evaluate("""() => Array.from(document.querySelectorAll('h1, h2, h3, h4, p'))
        .filter(e => /instrument serif/i.test(getComputedStyle(e).fontFamily) || getComputedStyle(e).fontStyle === 'italic').length""")
    assert serif_users == 0, f"{serif_users} headings or paragraphs still use the serif or italic display style"


def test_icons_are_inline_not_font_awesome(desktop):
    page, _ = desktop
    fa = page.evaluate("() => Array.from(document.querySelectorAll('link[rel=stylesheet]')).map(l => l.href).filter(h => /font-?awesome/i.test(h))")
    assert fa == [], f"page still loads Font Awesome: {fa}"


def test_positioning_is_all_round_software_engineer(desktop):
    page, _ = desktop
    title = page.title()
    og_title = page.evaluate("() => document.querySelector('meta[property=\"og:title\"]')?.content || ''")
    desc = page.evaluate("() => document.querySelector('meta[name=\"description\"]')?.content || ''")
    statement = page.evaluate("() => document.querySelector('.hero-statement')?.textContent || ''")
    lead = page.evaluate("() => document.querySelector('.prose .lead')?.textContent || ''")
    assert title.startswith("Vikas Sharma — Software Engineer"), f"title is {title!r}"
    assert og_title.startswith("Vikas Sharma — Software Engineer"), f"og:title is {og_title!r}"
    assert "software engineer" in desc.lower(), f"description should lead with software engineering, got {desc!r}"
    for label, text in (("hero statement", statement), ("about lead", lead)):
        low = text.lower()
        assert "quantitative developer" not in low and "quant " not in low, f"{label} still reads as quant-only: {text!r}"
    resume_order = page.evaluate("() => Array.from(document.querySelectorAll('.resume-list a')).map(a => a.getAttribute('href'))")
    assert resume_order[0] == "resume/SDE.docx", f"the general résumé should be listed first, got {resume_order}"



def test_live_github_numbers_have_static_fallbacks(desktop):
    page, _ = desktop
    cells = page.evaluate("""() => Array.from(document.querySelectorAll('[data-gh], [data-pypi]'))
        .map(e => [e.getAttribute('data-gh') || 'pypi', e.textContent.trim()])""")
    kinds = {k for k, _ in cells}
    for needed in ("stars-total", "stars:Historical-Market-data-From-Zerodha", "forks:Historical-Market-data-From-Zerodha", "stars:KiteWeb", "forks:KiteWeb", "pypi"):
        assert needed in kinds, f"no live-updated element for {needed}"
    for kind, text in cells:
        assert text and text[0].isdigit(), f"{kind} shows {text!r}, expected a baked-in number as fallback"
