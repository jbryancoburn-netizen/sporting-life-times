#!/usr/bin/env python3
"""Extract the original printed masthead directly from the uploaded newspaper PDF.
No synthetic pennants or substitute branding. Runs during publishing.
"""
from pathlib import Path
import fitz
root=Path(__file__).resolve().parents[1]
source=root/"The_Sporting_Life_and_Times_Oct21_Navigation_Repaired.pdf"
if not source.exists():
    print("Original PDF missing; masthead not regenerated")
else:
    page=fitz.open(source)[0]
    target=root/"assets"/"original-print-masthead.png"
    target.parent.mkdir(parents=True,exist_ok=True)
    page.get_pixmap(matrix=fitz.Matrix(2,2),clip=fitz.Rect(20,8,592,95),alpha=False).save(target)
    print("Restored original printed masthead:",target)
