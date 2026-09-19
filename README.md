# My Resume Website
https://vikassharma545.github.io/Resume/

Static site: `index.html`, `style.css`, `script.js`, with the portrait and the link-preview image in `assets/`.

## Maintenance

- `python -m pytest tests -q` runs the quality checks (contrast, text size, phone overflow, links, share image). Needs `pip install pytest playwright` and `python -m playwright install chromium`.
- `python tools/make_og.py` regenerates `assets/og.png` (the 1200x630 link preview) after changing the headline numbers or the portrait.
- Résumé files live in `resume/` as Word and PDF, linked from the Contact section. `python -m pytest tests/resume_check.py -q` checks the Word files for parser problems; export the PDFs from Word after editing them.
