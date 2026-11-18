"""
Cut labelled character crops out of a photographed sample sheet.

The template prints four black squares at the page corners, so the page is
located by those rather than by its own grid: four points give a homography
that undoes perspective and scale in one step, and every cell is then taken
from the coordinates the template itself reports.  Nothing depends on the
grid being detectable, which is what the earlier lattice approach needed.

The top-right square is notched, so the four points can be told apart no
matter which way up the photo was taken.
"""
import argparse, json, sys
from pathlib import Path
import cv2
import numpy as np

HERE = Path(__file__).parent
MODEL = json.loads((HERE / "template_model.json").read_text())
PPMM = 12.0                                   # canonical resolution
K = PPMM / (MODEL[0]["pw"] / 200.0)           # model px -> canonical px
CANVAS = (int(MODEL[0]["pw"] * K), int(MODEL[0]["ph"] * K))


def find_fiducials(gray):
    """The four black corner squares, as (centre, fill) pairs.

    The top-right square is notched, so it carries far less ink than the
    other three -- it measures about 40% of their area.  Ink is therefore
    no way to find it.  What all four do share is the size and squareness
    of their bounding box, and that is what they are selected on; the fill
    ratio is kept only to say afterwards which one is the notched one.
    """
    h, w = gray.shape
    paper = float(np.median(gray))          # most of a sheet is blank paper
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    thr = cv2.adaptiveThreshold(blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                cv2.THRESH_BINARY_INV, 101, 30)
    thr = cv2.morphologyEx(thr, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    contours, _ = cv2.findContours(thr, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    blobs = []
    for c in contours:
        x, y, bw, bh = cv2.boundingRect(c)
        box = bw * bh
        if box < w * h * 0.00025 or box > w * h * 0.01:
            continue
        if not (0.8 < bw / bh < 1.25):
            continue
        inner = gray[y + bh // 4: y + 3 * bh // 4, x + bw // 4: x + 3 * bw // 4]
        # A corner square is solid black; a printed cell is a thin outline
        # round blank paper.  Under some lighting the threshold fills whole
        # cells in, and a cell is twice the square's size, so letting one
        # through sets the size filter to the wrong scale and discards the
        # real squares.  What separates them is what is INSIDE: ink, or
        # paper.  Judged against this sheet's own paper, not a fixed level,
        # since a dim photo darkens both alike.
        if inner.size == 0 or inner.mean() > paper * 0.45:
            continue
        blobs.append(dict(c=(x + bw / 2, y + bh / 2), side=(bw + bh) / 2,
                          fill=cv2.contourArea(c) / box, box=box))
    if len(blobs) < 4:
        return None

    # the squares are the biggest solid marks on the page: size the grid off
    # the solid ones, then keep every blob of that size, notched one included
    solid = [b for b in blobs if b["fill"] > 0.85]
    if len(solid) < 2:
        return None
    side = float(np.median([b["side"] for b in sorted(solid, key=lambda b: -b["box"])[:4]]))
    cand = [b for b in blobs if 0.75 * side < b["side"] < 1.3 * side]
    if len(cand) < 4:
        return None

    picked, used = [], set()
    for cx, cy in ((0, 0), (w, 0), (0, h), (w, h)):
        best = min((b for i, b in enumerate(cand) if i not in used),
                   key=lambda b: (b["c"][0] - cx) ** 2 + (b["c"][1] - cy) ** 2,
                   default=None)
        if best is None:
            return None
        used.add(cand.index(best))
        picked.append(best)
    # each square must really sit near its own corner of the page
    span = max(abs(picked[1]["c"][0] - picked[0]["c"][0]),
               abs(picked[2]["c"][1] - picked[0]["c"][1]))
    if span < 0.55 * max(w, h):
        return None
    return picked


def order_fiducials(picked):
    """Label the four squares tl/tr/br/bl, and say if the notch agrees.

    find_fiducials already matched each square to a corner of the frame, so
    the labels come from that; the notched square is expected top right and
    a mismatch means the sheet was photographed turned around.
    """
    tl, tr, bl, br = (np.array(b["c"], dtype=np.float32) for b in picked)
    fid = {"tl": tl, "tr": tr, "bl": bl, "br": br}
    fills = [b["fill"] for b in picked]
    notch_ok = int(np.argmin(fills)) == 1          # index 1 is the top right
    return fid, notch_ok


def warp(img, fid):
    dst = {k: np.array(MODEL[0]["fid"][k], dtype=np.float32) * K
           for k in ("tl", "tr", "br", "bl")}
    src = np.array([fid[k] for k in ("tl", "tr", "br", "bl")], dtype=np.float32)
    H = cv2.getPerspectiveTransform(src, np.array([dst[k] for k in
                                    ("tl", "tr", "br", "bl")], dtype=np.float32))
    return cv2.warpPerspective(img, H, CANVAS, flags=cv2.INTER_CUBIC,
                               borderValue=255)


def _ink(gray):
    """Where the page carries any mark at all, printed or written."""
    bg = cv2.medianBlur(gray, 31)
    return (gray.astype(np.int16) < bg.astype(np.int16) - 8).astype(np.uint8)


def page_score(ink, m):
    """How well a page's printed cell borders line up with this image.

    The borders are a thin light grey, too faint to find by averaging, so
    the test is positional instead: draw the outlines the model predicts,
    and compare how much ink falls under them with how much falls under the
    same outlines slid half a cell down.  The right model sits on printed
    lines and the control lands on blank paper, so the gap is large; the
    wrong model scores near zero against its own control.
    """
    h, w = ink.shape
    mask = np.zeros((h, w), np.uint8)
    shift = int(np.median([c["h"] for c in m["cells"]]) * K * 0.5)
    for c in m["cells"]:
        x, y = int(c["x"] * K), int(c["y"] * K)
        cw, ch = int(c["w"] * K), int(c["h"] * K)
        cv2.rectangle(mask, (x, y), (x + cw, y + ch), 1, 5)
    ctrl = np.roll(mask, shift, axis=0)
    on, off = mask.astype(bool), ctrl.astype(bool)
    if on.sum() == 0 or off.sum() == 0:
        return -1e9
    return float(ink[on].mean() - ink[off].mean()) * 100


def identify(warped_gray):
    ink = _ink(warped_gray)
    scores = {m["page"]: page_score(ink, m) for m in MODEL if m["cells"]}
    best = max(scores, key=scores.get)
    return (best, scores) if scores[best] > 3 else (None, scores)


def process(path, out, writer, inset, save_warp=None):
    img = cv2.imread(str(path))
    if img is None:
        return "unreadable", None
    gray0 = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    picked = find_fiducials(gray0)
    if picked is None:
        return "no fiducials", None
    fid, notch_ok = order_fiducials(picked)
    w_img = warp(img, fid)
    g = cv2.cvtColor(w_img, cv2.COLOR_BGR2GRAY)
    page, scores = identify(g)
    if save_warp:
        cv2.imwrite(str(save_warp), w_img)
    if page is None:
        return f"line page (scores {({k: round(v,1) for k,v in scores.items()})})", None

    m = next(x for x in MODEL if x["page"] == page)
    if out:
        out = Path(out)
        for i, cell in enumerate(m["cells"]):
            x, y = cell["x"] * K, cell["y"] * K
            w_, h_ = cell["w"] * K, cell["h"] * K
            dx = dy = w_ * inset
            crop = g[int(y + dy):int(y + h_ - dy), int(x + dx):int(x + w_ - dx)]
            if crop.size == 0:
                continue
            lab = cell["label"]
            d = out / f"{ord(lab):05d}_{lab}"
            d.mkdir(parents=True, exist_ok=True)
            cv2.imwrite(str(d / f"{writer}_{Path(path).stem}_{i:03d}.png"), crop)
    flag = "" if notch_ok else "  [NOTCH NOT TOP-RIGHT]"
    return f"page {page}{flag}", (page, len(m["cells"]), scores)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("images", nargs="+")
    ap.add_argument("--out", default=None)
    ap.add_argument("--writer", default="w")
    ap.add_argument("--inset", type=float, default=0.06)
    ap.add_argument("--save-warp", default=None)
    a = ap.parse_args()
    for p in a.images:
        msg, _ = process(p, a.out, a.writer, a.inset,
                         Path(a.save_warp) / (Path(p).stem + ".jpg") if a.save_warp else None)
        print(f"{Path(p).parent.name}/{Path(p).name:>8}  {msg}")
