"""Bundles web/spectra.html and its CSS/JS into one file for publishing as a claude.ai artifact.

The artifact host adds its own <html>/<head>/<body> skeleton, so those tags are stripped.
Usage: python tools/build-artifact.py  ->  dist/spectra-artifact.html
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
OUT = ROOT / "dist" / "spectra-artifact.html"

SKELETON = re.compile(r"^\s*(<!doctype html>|</?html[^>]*>|</?head>|</?body>|<meta [^>]*>)\s*$", re.I | re.M)


def read(rel: str) -> str:
    return (WEB / rel).read_text(encoding="utf-8")


def main() -> None:
    html = read("spectra.html")
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', lambda m: f"<style>\n{read(m[1])}</style>", html)
    html = re.sub(r'<script src="([^"]+)"></script>', lambda m: f"<script>\n{read(m[1])}</script>", html)
    html = SKELETON.sub("", html)
    html = re.sub(r"\n{3,}", "\n\n", html).strip() + "\n"
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(html, encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)} ({len(html) // 1024} KB)")


if __name__ == "__main__":
    main()
