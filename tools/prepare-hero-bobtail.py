"""Normalize ImageGen edits to existing atlas canvas sizes; keep source files.

This is packaging only: no segmentation, anatomy painting, or recoloring.
"""
from pathlib import Path
import json
import shutil
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT/'docs/art/hero-bobtail-v2-generation.json').read_text())
target = ROOT/'public/assets/runtime/characters/hero/rig/watercolor/v2'
target.mkdir(parents=True, exist_ok=True)
sources = ROOT/'public/assets/sources/characters/bobtail-v2'
sources.mkdir(parents=True, exist_ok=True)
checks = []
for entry in manifest:
    source = Path(entry['generated'])
    if entry.get('flames'):
        output = target/'hero-flame-pieces-v2.png'
        if not source.exists():
            source = sources/output.name
        if source != sources/output.name:
            shutil.copyfile(source, sources/output.name)
        shutil.copyfile(source, output)
        continue
    original = ROOT/'public/assets/actors'/Path(entry['original'].replace('\\','/').split('/public/assets/deprecated/pixel/characters/')[1])
    name = original.name.replace('-watercolor-v1.png','-bobtail-v2.png')
    if not source.exists():
        source = sources/name
    if source != sources/name:
        shutil.copyfile(source, sources/name)
    image = Image.open(source).convert('RGBA')
    size = Image.open(original).size
    generated_size = image.size
    if image.size != size:
        image = image.resize(size, Image.Resampling.LANCZOS)
    output = (original.parent if 'battle' not in original.parts else target)/name
    image.save(output)
    checks.append(dict(file=str(output.relative_to(ROOT)), originalSize=size, generatedSize=generated_size, alpha=image.getchannel('A').getextrema()))
(ROOT/'docs/art/hero-bobtail-v2-packing.json').write_text(json.dumps(checks,indent=2)+'\n')
print('Prepared',len(checks),'bobtail sprites and three-piece flame atlas')
