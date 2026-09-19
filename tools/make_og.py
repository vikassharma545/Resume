"""Render tools/og.html to assets/og.png, the 1200x630 image used for link previews.

Run after changing the headline numbers or the portrait:
    python tools/make_og.py
Needs: pip install playwright && python -m playwright install chromium
"""
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "og.html"
OUT = ROOT / "assets" / "og.png"

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1200, "height": 630}, device_scale_factor=1, reduced_motion="reduce")
    page = ctx.new_page()
    page.goto(SRC.as_uri(), wait_until="networkidle")
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(600)
    page.screenshot(path=str(OUT), type="png")
    browser.close()

print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")
