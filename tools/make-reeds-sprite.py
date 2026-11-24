"""Pixel-art reeds and cattails for the pond tile's pop-up scenery.
Usage: python tools/make-reeds-sprite.py OUT.png PREVIEW.png"""
from PIL import Image
import sys
W, H = 48, 48
OUT = (18, 40, 26, 255)
STEM_D = (44, 92, 46, 255); STEM = (70, 132, 62, 255); STEM_L = (122, 176, 86, 255)
HEAD_D = (88, 52, 30, 255); HEAD = (128, 78, 42, 255); HEAD_L = (164, 108, 60, 255)

def reed(px, x, base, h, lean=0, head=False):
    top = base - h
    for y in range(top, base):
        f = (base - y) / h
        cx = x + round(lean * f * f)
        px[cx, y] = STEM if (y % 5) else STEM_L
        if cx + 1 < W and f < 0.6: px[cx + 1, y] = STEM_D
    if head:
        cx = x + round(lean)
        for y in range(top + 2, top + 10):
            for dx in (-1, 0, 1):
                c = HEAD_L if dx < 0 else HEAD if dx == 0 else HEAD_D
                if 0 <= cx + dx < W: px[cx + dx, y] = c
        px[cx, top] = STEM; px[cx, top + 1] = STEM

def blade(px, x, base, h, lean):
    # A flat leaf: two pixels wide at the base, tapering to a point.
    for y in range(base - h, base):
        f = (base - y) / h
        cx = x + round(lean * f * f)
        px[cx, y] = STEM_L if f > 0.5 else STEM
        if f < 0.45 and 0 <= cx - 1: px[cx - 1, y] = STEM_D

def outline(img):
    px = img.load(); src = img.copy(); sp = src.load()
    for y in range(H):
        for x in range(W):
            if sp[x, y][3] == 0:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < W and 0 <= ny < H and sp[nx, ny][3] and sp[nx, ny] != OUT:
                        px[x, y] = OUT; break

back = Image.new('RGBA', (W, H), (0, 0, 0, 0)); bp = back.load()
for x, h, lean in ((8, 22, -3), (14, 28, -1), (33, 26, 2), (40, 20, 4)):
    blade(bp, x, 46, h, lean)
reed(bp, 11, 46, 30, -2, True); reed(bp, 37, 46, 32, 2, True)
outline(back)
r, g, b, a = back.split()
back = Image.merge('RGBA', [c.point(lambda v: int(v * 0.78)) for c in (r, g, b)] + [a])
front = Image.new('RGBA', (W, H), (0, 0, 0, 0)); fp = front.load()
for x, h, lean in ((18, 24, -4), (22, 30, -2), (27, 27, 3), (30, 21, 5)):
    blade(fp, x, 47, h, lean)
reed(fp, 20, 47, 40, -1, True); reed(fp, 26, 47, 36, 2, True)
outline(front)
img = Image.alpha_composite(back, front)
img.save(sys.argv[1])
img.resize((W * 8, H * 8), Image.NEAREST).save(sys.argv[2])
