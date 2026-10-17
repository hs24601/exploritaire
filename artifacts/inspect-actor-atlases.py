from PIL import Image
from pathlib import Path
from collections import deque
import json
out = {}
for path in Path('public/assets/actors/battle').glob('*.png'):
    image = Image.open(path)
    width, height = image.size
    mask = bytearray(image.getchannel('A').point(lambda a: 255 if a > 80 else 0).tobytes())
    regions = []
    for start in range(width * height):
        if not mask[start]:
            continue
        queue = deque([start]); mask[start] = 0
        left = right = start % width; top = bottom = start // width; count = 0
        while queue:
            index = queue.popleft(); x = index % width; y = index // width; count += 1
            left = min(left,x); right = max(right,x); top = min(top,y); bottom = max(bottom,y)
            for neighbour in ([index-1] if x else []) + ([index+1] if x+1<width else []) + ([index-width] if y else []) + ([index+width] if y+1<height else []):
                if mask[neighbour]:
                    mask[neighbour] = 0; queue.append(neighbour)
        if count > 400:
            regions.append([left,top,right-left+1,bottom-top+1])
    out[path.name] = sorted(regions,key=lambda r: r[1])
print(json.dumps(out))
Path('artifacts/actor-atlas-components.json').write_text(json.dumps(out,indent=2))
