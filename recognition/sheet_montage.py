"""All of one sheet's cells in reading order, each tagged with the label the
template assigned it.  A writer who lost their place shows up as a run of
cells whose contents are one step out from their tags."""
import sys
from pathlib import Path
import cv2, numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent))
import dataset as D
from PIL import Image, ImageDraw, ImageFont

writer, stem, out = sys.argv[1], sys.argv[2], sys.argv[3]
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
for c in ("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
          "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc"):
    if Path(c).exists(): FONT = c; break

found = []
for d in sorted(Path("crops_all").iterdir()):
    for p in d.glob(f"{writer}_{stem}_*.png"):
        found.append((int(p.stem.split("_")[-1]), D.label_of(d), p))
found.sort()
if not found:
    sys.exit(f"nothing for {writer}_{stem}")

T, PAD, COLS = 150, 10, 10
rows = (len(found) + COLS - 1) // COLS
W, H = COLS * (T + PAD) + PAD, rows * (T + PAD + 34) + PAD
im = Image.new("RGB", (W, H), "white")
dr = ImageDraw.Draw(im)
f = ImageFont.truetype(FONT, 30)
for i, (_, lab, p) in enumerate(found):
    r, c = divmod(i, COLS)
    x, y = PAD + c * (T + PAD), PAD + r * (T + PAD + 34)
    g = cv2.resize(cv2.imdecode(np.fromfile(str(p), dtype=np.uint8), cv2.IMREAD_GRAYSCALE), (T, T))
    im.paste(Image.fromarray(g).convert("RGB"), (x, y + 34))
    dr.text((x + 4, y + 2), lab, fill=(190, 0, 0), font=f)
im.save(out, quality=90)
print(f"{out}: {len(found)} cells")
