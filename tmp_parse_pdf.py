import re
from pathlib import Path
import pypdf

pdf_path = Path(r'c:\Users\Wajeeh\Desktop\Compiler2.0-main\final_24_25_clean.pdf')
reader = pypdf.PdfReader(str(pdf_path))
lines = []
for page in reader.pages:
    text = page.extract_text(extraction_mode='layout') or ''
    lines.extend(text.splitlines())

print('total_lines', len(lines))
for line in lines[:80]:
    print(repr(line))
