"""Rank every crop by how unlike its label's other samples it is.

A crop that holds the wrong character sits far from the rest of its class,
so a distance to the class's median picture finds mislabelled cells without
anyone reading five thousand of them.  Handwriting varies, so this ranks
candidates for a person to look at; it does not decide.
"""
import sys
from pathlib import Path
import cv2, numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent))
import dataset as D
from PIL import Image, ImageDraw, ImageFont

SRC, OUT, N = Path(sys.argv[1]), sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 40
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
for c in ("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
          "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc"):
    if Path(c).exists(): FONT = c; break

def norm(p):
    g = cv2.imdecode(np.fromfile(str(p), dtype=np.uint8), cv2.IMREAD_GRAYSCALE)
    if g is None: return None
    g = cv2.resize(g, (32, 32)).astype(np.float32)
    g = 255.0 - g                                  # ink high
    g -= g.min()
    return g / (g.max() + 1e-6)

scored = []
for d in sorted(SRC.iterdir()):
    ps = sorted(d.glob("*.png"))
    v = [(p, norm(p)) for p in ps]
    v = [(p, a) for p, a in v if a is not None]
    if len(v) < 5: continue
    med = np.median(np.stack([a for _, a in v]), axis=0)
    dist = [(float(np.linalg.norm(a - med)), p, D.label_of(d)) for p, a in v]
    mu = np.mean([x[0] for x in dist]); sd = np.std([x[0] for x in dist]) + 1e-6
    scored += [((x[0] - mu) / sd, x[1], x[2]) for x in dist]

scored.sort(key=lambda t: -t[0])
top = scored[:N]
T, COLS = 150, 10
rows = (len(top) + COLS - 1) // COLS
im = Image.new("RGB", (COLS * (T + 8) + 8, rows * (T + 52) + 8), "white")
dr = ImageDraw.Draw(im); f = ImageFont.truetype(FONT, 26); fs = ImageFont.truetype(FONT, 17)
for i, (z, p, lab) in enumerate(top):
    r, c = divmod(i, COLS)
    x, y = 8 + c * (T + 8), 8 + r * (T + 52)
    im.paste(Image.fromarray(cv2.resize(cv2.imdecode(np.fromfile(str(p), dtype=np.uint8), cv2.IMREAD_GRAYSCALE), (T, T))).convert("RGB"), (x, y + 52))
    dr.text((x + 2, y), f"{lab}  z={z:.1f}", fill=(190, 0, 0), font=f)
    dr.text((x + 2, y + 32), p.stem[:22], fill=(120, 120, 120), font=fs)
im.save(OUT, quality=92)
print(f"{OUT}: top {len(top)} of {len(scored)} crops, z from {top[0][0]:.1f} to {top[-1][0]:.1f}")
