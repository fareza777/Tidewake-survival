"""Package final outputs and editable sources, excluding disposable intermediates."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parents[1]
report = json.loads((root / "source/validation-report.json").read_text())
assert report["status"] == "passed"
archive = root / "Tidewake-Premium-Launch-Kit.zip"
files = []
for file in sorted(root.rglob("*")):
    if not file.is_file():
        continue
    rel = file.relative_to(root)
    parts = rel.parts
    if any(p in {"node_modules", ".git", ".cache", "__pycache__"} for p in parts):
        continue
    if rel.suffix in {".zip", ".log", ".tsbuildinfo"} or file.name == "package-report.json":
        continue
    if parts[:2] in {("captures", "frames"), ("video", "qa")}:
        continue
    if parts[0] == "video" and file.name.startswith("check-"):
        continue
    files.append(file)
with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as package:
    for file in files:
        package.write(file, Path("Tidewake-Premium-Launch-Kit") / file.relative_to(root))
with zipfile.ZipFile(archive) as package:
    assert package.testzip() is None, "ZIP integrity failed"
    names = package.namelist()
    assert sum("/playstore/screenshots/" in n and n.endswith(".png") for n in names) == 8
    assert sum("/video/Tidewake-Trailer-" in n and n.endswith(".mp4") for n in names) == 2
    assert any(n.endswith("/remotion/src/Trailer.tsx") for n in names)
result = {"archive": archive.name, "files": len(files), "bytes": archive.stat().st_size, "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(), "integrity": "passed", "screenshots": 8, "finalVideos": 2, "editableSourceIncluded": True}
(root / "source/package-report.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps(result, indent=2))
