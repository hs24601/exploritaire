"""Pixel-art scenery that lines the sides and front of biome tiles in the tilted camera.
Usage: python tools/make-edge-scenery-sprites.py OUT_DIR PREVIEW.png

Writes, into OUT_DIR, as pixel-exact SVG (one rect per run of same-coloured pixels):
  pond_reeds_side.svg   a clump of reeds with one cattail, for the pond's left and right edges
  pond_reeds_front.svg  shortened reeds for the pond's front edge
  woods_side.svg        a young pine, for the woods' left and right edges
  woods_front.svg       ferns and grass for the woods' front edge
Palettes match tools/make-reeds-sprite.py and tools/make-pine-sprite.py."""
from PIL import Image
import os, sys

# Reeds (make-reeds-sprite.py)
R_OUT = (18, 40, 26, 255)
STEM_D = (44, 92, 46, 255); STEM = (70, 132, 62, 255); STEM_L = (122, 176, 86, 255)
HEAD_D = (88, 52, 30, 255); HEAD = (128, 78, 42, 255); HEAD_L = (164, 108, 60, 255)
# Pines (make-pine-sprite.py)
P_OUT = (15, 36, 24, 255); D = (28, 72, 44, 255); M = (42, 104, 58, 255); L = (74, 148, 72, 255); HL = (140, 198, 104, 255)
TR = (150, 100, 58, 255); TRD = (104, 66, 36, 255)

def put(img, x, y, c):
    if 0 <= x < img.width and 0 <= y < img.height: img.load()[x, y] = c

def blade(img, x, base, h, lean, light=STEM_L, mid=STEM, dark=STEM_D):
    for y in range(base - h, base):
        f = (base - y) / h
        cx = x + round(lean * f * f)
        put(img, cx, y, light if f > 0.5 else mid)
        if f < 0.45: put(img, cx - 1, y, dark)

def cattail(img, x, base, h, lean):
    top = base - h
    for y in range(top, base):
        f = (base - y) / h
        cx = x + round(lean * f * f)
        put(img, cx, y, STEM if (y % 5) else STEM_L)
        if f < 0.6: put(img, cx + 1, y, STEM_D)
    cx = x + round(lean)
    for y in range(top + 2, top + 8):
        for dx, c in ((-1, HEAD_L), (0, HEAD), (1, HEAD_D)): put(img, cx + dx, y, c)

def pine(img, cx, base, h):
    trunk = 3
    for y in range(base - trunk - 1, base):
        put(img, cx - 1, y, TR); put(img, cx, y, TRD)
    top, bottom = base - h, base - trunk
    tiers = 3
    seg = (bottom - top) / tiers
    for i in reversed(range(tiers)):
        s0 = top + int(round(seg * i * 0.85)); e0 = min(bottom, top + int(round(seg * (i + 1))) + 1)
        wtop = 0.5 if i == 0 else 1 + i; wbot = 2.5 + 1.6 * (i + 1)
        for y in range(s0, e0):
            f = (y - s0) / max(1, e0 - s0 - 1)
            iw = int(round(wtop + (wbot - wtop) * f))
            for x in range(cx - iw, cx + iw + 1):
                rel = (x - cx) / max(1, iw)
                c = L if rel < -0.4 else M if rel < 0.2 else D
                if y == e0 - 1 and rel < -0.1 and x % 2 == 0: c = HL
                put(img, x, y, c)
    put(img, cx, top - 1, L)

def fern(img, cx, base, h, lean):
    # A drooping frond: a stem with leaflets on alternate sides.
    for i in range(h):
        y = base - 1 - i
        x = cx + round(lean * (i / h) ** 2 * 2)
        put(img, x, y, M if i < h - 2 else L)
        if i % 2 == 0 and 0 < i < h - 1:
            put(img, x - 1, y, L); put(img, x + 1, y + 1, D)

def outline(img, out):
    src = img.copy(); sp = src.load(); px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            if sp[x, y][3] == 0:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < img.width and 0 <= ny < img.height and sp[nx, ny][3] and sp[nx, ny] != out:
                        px[x, y] = out; break

def dim(img, k):
    r, g, b, a = img.split()
    return Image.merge('RGBA', [c.point(lambda v: int(v * k)) for c in (r, g, b)] + [a])

def layered(size, out, back_fn, front_fn):
    back = Image.new('RGBA', size, (0, 0, 0, 0)); back_fn(back); outline(back, out)
    front = Image.new('RGBA', size, (0, 0, 0, 0)); front_fn(front); outline(front, out)
    return Image.alpha_composite(dim(back, 0.8), front)

def pond_side(img_back=None):
    def back(i):
        blade(i, 3, 30, 18, -2); blade(i, 10, 30, 16, 2)
    def front(i):
        cattail(i, 6, 30, 26, 1); blade(i, 5, 30, 20, -3); blade(i, 9, 30, 14, 3)
    return layered((14, 30), R_OUT, back, front)

def pond_front():
    def back(i):
        for x, h, lean in ((3, 7, -1), (8, 8, 1)): blade(i, x, 10, h, lean)
    def front(i):
        for x, h, lean in ((2, 5, -2), (5, 8, -1), (9, 6, 2)): blade(i, x, 10, h, lean)
    return layered((12, 10), R_OUT, back, front)

def woods_side():
    def back(i): fern(i, 3, 28, 6, -1); fern(i, 11, 28, 5, 1)
    def front(i): pine(i, 7, 28, 24)
    return layered((15, 28), P_OUT, back, front)

def woods_front():
    def back(i): fern(i, 7, 10, 7, 1)
    def front(i):
        for x, h, lean in ((2, 4, -1), (5, 7, -1), (9, 5, 1)): fern(i, x, 10, h, lean)
    return layered((12, 10), P_OUT, back, front)

def trim(img):
    box = img.getbbox()
    return img.crop(box) if box else img

def save_svg(img, path):
    px = img.load(); rects = []
    for y in range(img.height):
        x = 0
        while x < img.width:
            c = px[x, y]
            if c[3] == 0: x += 1; continue
            run = 1
            while x + run < img.width and px[x + run, y] == c: run += 1
            fill = '#%02x%02x%02x' % c[:3]
            alpha = '' if c[3] == 255 else ' fill-opacity="%.3f"' % (c[3] / 255)
            rects.append('<rect x="%d" y="%d" width="%d" height="1" fill="%s"%s/>' % (x, y, run, fill, alpha))
            x += run
    with open(path, 'w') as f:
        f.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" shape-rendering="crispEdges">\n%s\n</svg>\n'
                % (img.width, img.height, img.width, img.height, '\n'.join(rects)))

out_dir, preview = sys.argv[1], sys.argv[2]
sprites = {
    'pond_reeds_side.svg': pond_side(), 'pond_reeds_front.svg': pond_front(),
    'woods_side.svg': woods_side(), 'woods_front.svg': woods_front(),
}
sheet = Image.new('RGBA', (sum(s.width for s in sprites.values()) + 3 * 4 + 8, 40), (20, 30, 28, 255))
x = 4
for name, img in sprites.items():
    img = trim(img)
    save_svg(img, os.path.join(out_dir, name))
    sheet.alpha_composite(img, (x, 36 - img.height)); x += img.width + 4
sheet.resize((sheet.width * 8, sheet.height * 8), Image.NEAREST).save(preview)
