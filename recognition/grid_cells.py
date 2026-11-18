"""
Cut labelled character crops out of a sheet printed from the old template.

That template has no corner squares, so the page cannot be located by four
known points.  What it does have is the printed grid itself, and a grid is
easier to find whole than box by box: morphology keeps only strokes that run
a long way horizontally or vertically, which discards the handwriting, and
the surviving rules show up as sharp peaks in a projection.  Peaks are found
across the whole page at once, so a row that contour detection would have
lost to a shadow is still recovered from the rest of its own line.
"""
import argparse
from pathlib import Path

import cv2
import numpy as np

# Each group of characters starts a new row, so the row lengths are a
# fingerprint of the page: 9 rows on page 1, 12 on page 2.
PAGE1 = [list("0123456789"), list("黑咖黄蓝混红灰绿紫白粉色"),
         list("套方条个张"), list("防潮垫尘罩狗"), ["×", "+", "号"]]
PAGE2 = [list("ABCDEFGHIJKLMNOPQRSTUVWXYZ"), list("abcdefghijklmnopqrstuvwxyz")]
PAGES = {1: PAGE1, 2: PAGE2}
REPEAT, COLS = 2, 10


def layout(page):
    rows, labels = [], []
    for chars in PAGES[page]:
        cells = [c for c in chars for _ in range(REPEAT)]
        labels.extend(cells)
        full, rest = divmod(len(cells), COLS)
        rows.extend([COLS] * full)
        if rest:
            rows.append(rest)
    return rows, labels


def ink(gray):
    """Everything darker than its surroundings: print and handwriting alike."""
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    return cv2.adaptiveThreshold(blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                 cv2.THRESH_BINARY_INV, 51, 12)


def rules(mask, axis, length):
    """Keep only strokes running at least `length` px along `axis`."""
    k = (length, 1) if axis == 0 else (1, length)
    el = cv2.getStructuringElement(cv2.MORPH_RECT, k)
    out = cv2.morphologyEx(mask, cv2.MORPH_OPEN, el)
    # close small breaks in a rule without widening it: a dilation that
    # scales with the kernel would push every cell's measured span out by
    # tens of pixels and drag the neighbouring border into the crop
    bridge = (9, 1) if axis == 0 else (1, 9)
    return cv2.morphologyEx(out, cv2.MORPH_CLOSE,
                            cv2.getStructuringElement(cv2.MORPH_RECT, bridge))


def deskew(gray):
    """Rotate the page so its printed rules run straight."""
    m = rules(ink(gray), 0, max(40, gray.shape[1] // 40))
    lines = cv2.HoughLinesP(m, 1, np.pi / 1800, threshold=120,
                            minLineLength=gray.shape[1] // 12, maxLineGap=20)
    if lines is None:
        return gray, 0.0
    ang = [np.degrees(np.arctan2(y2 - y1, x2 - x1)) for x1, y1, x2, y2 in lines.reshape(-1, 4)]
    ang = [a for a in ang if abs(a) < 12]
    if not ang:
        return gray, 0.0
    a = float(np.median(ang))
    h, w = gray.shape
    M = cv2.getRotationMatrix2D((w / 2, h / 2), a, 1.0)
    return cv2.warpAffine(gray, M, (w, h), flags=cv2.INTER_CUBIC,
                          borderValue=255), a


def bands(profile, frac=0.35):
    """Runs where the projection stays above a fraction of its peak."""
    thr = profile.max() * frac
    on = profile > thr
    out, start = [], None
    for i, v in enumerate(on):
        if v and start is None:
            start = i
        elif not v and start is not None:
            out.append((start, i)); start = None
    if start is not None:
        out.append((start, len(on)))
    return [b for b in out if b[1] - b[0] >= 2]


def columns(colprof, n):
    """The n cell columns, anchored on the grid's own left and right edge.

    Indexing the columns by counting from the first one detected is wrong
    whenever a leading column is missed: the whole lattice slides over and
    every crop is then labelled with a character two cells to its left.
    The cell borders of a full row run from the first column's left edge to
    the last one's right edge, so the extent of the projection fixes both
    ends outright and no counting is involved.
    """
    if colprof.max() <= 0:
        return None
    xs = np.flatnonzero(colprof > colprof.max() * 0.12)
    if len(xs) < 2:
        return None
    left, right = float(xs[0]), float(xs[-1])
    pitch = (right - left) / n
    if pitch <= 0:
        return None
    # the gap between neighbouring cells, from the clearest bands
    bs = bands(colprof, 0.30)
    w = np.sort(np.array([b - a for a, b in bs], float)) if bs else np.array([pitch])
    width = float(np.median(w[:max(1, int(len(w) * 0.6))]))
    width = min(width, pitch * 0.98)
    pad = (pitch - width) / 2
    return [(left + k * pitch + pad, left + (k + 1) * pitch - pad) for k in range(n)]


def column_fit_error(colprof, cols):
    """How far the detected cell bands sit from the lattice, in pixels."""
    bs = bands(colprof, 0.30)
    if not bs:
        return 0.0
    pred = [(a + b) / 2 for a, b in cols]
    worst = 0.0
    for a, b in bs:
        c = (a + b) / 2
        worst = max(worst, min(abs(c - q) for q in pred))
    return worst


def merge_close(spans, gap):
    """Join spans split by a faint patch of a printed rule."""
    out = []
    for a, b in spans:
        if out and a - out[-1][1] < gap:
            out[-1] = (out[-1][0], b)
        else:
            out.append((a, b))
    return out


def profiles(gray):
    """The long horizontal and vertical strokes, computed once per sheet."""
    m = ink(gray)
    h, w = gray.shape
    return rules(m, 0, max(40, w // 40)), rules(m, 1, max(40, h // 55))


def _grid_at(horiz, vert, shape, fr):
    """Cell rows and columns, as pixel spans.

    A cell's side borders run only as far as the cell is tall, so the
    vertical rules projected onto y rise over a row of cells and fall in
    the space between rows; the horizontal rules projected onto x do the
    same for columns.  Each band is a cell extent outright, with no pairing
    of separate edges.

    The two are read in that order because the page carries long horizontal
    lines that are not grid at all -- the rule under the header, the dotted
    line beneath each group title -- and they reach wider than the grid
    does.  Measuring the columns only within the rows found first leaves
    those out of the projection.
    """
    h, w = shape
    coarse = bands(vert.sum(axis=1).astype(float), 0.30)
    if not coarse:
        return None
    coarse = merge_close(coarse, np.percentile([b - a for a, b in coarse], 75) * 0.2)
    band = np.zeros(h, bool)
    for a, b in coarse:
        band[a:b] = True
    if band.sum() < h * 0.05:
        return None

    cols = columns(horiz[band, :].sum(axis=0).astype(float), COLS)
    if cols is None:
        return None
    # A writing-line page has long rules too, but almost no vertical ones:
    # a grid shows two edges per column, a page of rules only two in all.
    if len(bands(vert[band, :].sum(axis=0).astype(float), 0.30)) < 8:
        return None

    # Rows are measured inside the first two columns only.  Projected across
    # the whole page a row of two cells carries a fifth of the signal of a
    # row of ten and is lost under any threshold that suits the others;
    # every row has at least two cells, so this makes them all equal.
    x0, x1 = int(cols[0][0]), int(cols[1][1])
    rows = bands(vert[:, max(0, x0):x1].sum(axis=1).astype(float), fr)
    if not rows:
        return None
    rows = merge_close(rows, np.percentile([b - a for a, b in rows], 75) * 0.2)
    keep = np.median([b - a for a, b in rows])
    rows = [r for r in rows if r[1] - r[0] > keep * 0.5]
    return rows, cols


def find_grid(gray):
    """Read the grid, trying a few thresholds and keeping one that verifies.

    Page 2 prints a tighter grid than page 1 -- shorter cells, narrower
    gaps -- so no single cut-off reads both.  The row count is not a guess
    though: the template admits 9 rows or 12 and nothing else, so each
    attempt can be checked, and the first that answers with a legal page
    is the one to keep.
    """
    horiz, vert = profiles(gray)
    best = None
    for fr in (0.30, 0.22, 0.40, 0.15, 0.50, 0.10, 0.60):
        got = _grid_at(horiz, vert, gray.shape, fr)
        if not got:
            continue
        rows, cols = got
        if len(rows) in (9, 12):
            return rows, cols, {9: 1, 12: 2}[len(rows)]
        if best is None:
            best = (rows, cols, None)
    return best


def process(path, out, writer, inset, debug=None):
    img = cv2.imread(str(path))
    if img is None:
        return "unreadable"
    g0 = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    g, ang = deskew(g0)
    found = find_grid(g)
    if not found:
        return "no grid"
    rows, cols, page = found
    if page is None:
        return f"line page or bad grid ({len(rows)} rows, {len(cols)} cols)"
    want, labels = layout(page)

    if debug:
        vis = cv2.cvtColor(g, cv2.COLOR_GRAY2BGR)
        for (y0, y1), n in zip(rows, want):
            for x0, x1 in cols[:n]:
                cv2.rectangle(vis, (int(x0), int(y0)), (int(x1), int(y1)), (0, 160, 0), 3)
        cv2.imwrite(str(debug), vis)

    k = 0
    for (y0, y1), n in zip(rows, want):
        for x0, x1 in cols[:n]:
            cw_ = x1 - x0
            # the same physical margin on both axes.  Page 2 prints shorter
            # cells than page 1, so a margin taken as a fraction of cell
            # HEIGHT eats over a millimetre off the top and bottom there and
            # clips descenders; cell width is near enough equal on both.
            dx = dy = cw_ * inset
            crop = g[int(y0 + dy):int(y1 - dy), int(x0 + dx):int(x1 - dx)]
            lab = labels[k]; k += 1
            if crop.size == 0 or out is None:
                continue
            d = Path(out) / f"{ord(lab):05d}_{lab}"
            d.mkdir(parents=True, exist_ok=True)
            cv2.imwrite(str(d / f"{writer}_{Path(path).stem}_{k:03d}.png"), crop)
    hz, vt = profiles(g)
    band = np.zeros(g.shape[0], bool)
    for a, b in rows:
        band[a:b] = True
    err = column_fit_error(hz[band, :].sum(axis=0).astype(float), cols)
    warn = "   COLUMN FIT OFF" if err > (cols[0][1] - cols[0][0]) * 0.18 else ""
    return f"page {page}  skew {ang:+.1f}deg  {k} cells  colfit {err:.0f}px{warn}"


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("images", nargs="+")
    ap.add_argument("--out", default=None)
    ap.add_argument("--writer", default="w")
    ap.add_argument("--inset", type=float, default=0.06)
    ap.add_argument("--debug-dir", default=None)
    a = ap.parse_args()
    for p in a.images:
        dbg = Path(a.debug_dir) / (Path(p).parent.name + "_" + Path(p).stem + ".jpg") if a.debug_dir else None
        if dbg: dbg.parent.mkdir(parents=True, exist_ok=True)
        print(f"{Path(p).parent.name}/{Path(p).name:>8}  {process(p, a.out, a.writer, a.inset, dbg)}")
