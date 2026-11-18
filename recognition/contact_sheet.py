"""A contact sheet: every sample of a label on one row, label printed left.

Reading down a row, a cell whose writer lost their place stands out at once,
which is the only practical way to find a mislabelled crop among thousands.
"""
import sys
from pathlib import Path
import cv2, numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent))
import dataset as D
from PIL import Image, ImageDraw, ImageFont

SRC, OUT, PICK = Path(sys.argv[1]), sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "all"
TH, PAD, LW = 96, 4, 150
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
for c in ("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
          "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc"):
    if Path(c).exists():
        FONT = c; break

dirs = sorted(SRC.iterdir())
if PICK == "cjk":
    dirs = [d for d in dirs if ord(D.label_of(d)) > 0x2000]
elif PICK == "ascii":
    dirs = [d for d in dirs if ord(D.label_of(d)) < 0x2000]

rows, width = [], 0
for d in dirs:
    imgs = sorted(d.glob("*.png"))
    tiles = []
    for p in imgs:
        g = cv2.imdecode(np.fromfile(str(p), dtype=np.uint8), cv2.IMREAD_GRAYSCALE)
        if g is None: continue
        tiles.append(cv2.resize(g, (TH, TH)))
    if not tiles: continue
    strip = np.full((TH, len(tiles) * (TH + PAD), 3), 255, np.uint8)
    for i, t in enumerate(tiles):
        strip[:, i * (TH + PAD):i * (TH + PAD) + TH] = cv2.cvtColor(t, cv2.COLOR_GRAY2BGR)
    rows.append((D.label_of(d), strip, [p.name for p in imgs]))
    width = max(width, strip.shape[1])

H = len(rows) * (TH + PAD * 2)
canvas = np.full((H, LW + width, 3), 255, np.uint8)
for i, (_, strip, _) in enumerate(rows):
    y = i * (TH + PAD * 2) + PAD
    canvas[y:y + TH, LW:LW + strip.shape[1]] = strip
    cv2.line(canvas, (0, y + TH + PAD), (LW + width, y + TH + PAD), (220, 220, 220), 1)

im = Image.fromarray(cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB))
dr = ImageDraw.Draw(im)
f = ImageFont.truetype(FONT, 46)
fs = ImageFont.truetype(FONT, 20)
for i, (lab, _, names) in enumerate(rows):
    y = i * (TH + PAD * 2) + PAD
    dr.text((14, y + 18), lab, fill=(190, 0, 0), font=f)
    dr.text((78, y + 30), f"{len(names)}", fill=(150, 150, 150), font=fs)
im.save(OUT, quality=90)
print(f"{OUT}: {len(rows)} labels, {im.size[0]}x{im.size[1]}")
