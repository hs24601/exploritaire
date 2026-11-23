"""Export one generated suit master to a compact RGBA runtime PNG.

Usage: python tools/prepare-element-suit.py ELEMENT GENERATED_PNG
Only resamples the authored art; does not repaint, recolor, or infer transparency.
"""
import json
import shutil
import sys
from pathlib import Path
from PIL import Image

element, generated = sys.argv[1:]
assert element in ('earth', 'air', 'fire', 'water', 'nature', 'chaos')
root = Path(__file__).resolve().parent.parent
source_dir = root / 'public/assets/sources/ui/element-suits/v1'
runtime_dir = root / 'public/assets/runtime/ui/element-suits'
source_dir.mkdir(parents=True, exist_ok=True)
runtime_dir.mkdir(parents=True, exist_ok=True)
master = source_dir / f'{element}-master-v1.png'
shutil.copyfile(generated, master)
image = Image.open(master).convert('RGBA')
assert image.getchannel('A').getextrema() == (0, 255), 'Expected genuine alpha and opaque paint'
image.thumbnail((256, 256), Image.Resampling.LANCZOS)
target = runtime_dir / f'{element}-v1.png'
image.save(target, optimize=True)
print(json.dumps({'element': element, 'size': image.size, 'alpha': image.getchannel('A').getextrema(), 'bytes': target.stat().st_size}))
