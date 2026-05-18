from pathlib import Path

root = Path(__file__).parent / "src" / "components"
for path in root.rglob("*.tsx"):
    text = path.read_text(encoding="utf-8")
    if "motion" not in text:
        continue
    fixed = text.replace("</motion>", "</div>").replace("<motion", "<div")
    if fixed != text:
        path.write_text(fixed, encoding="utf-8")
        print("fixed", path.name)
