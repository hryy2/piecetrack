"""
Loading, splitting and augmenting the collected character crops.

The split is by writer, not by sample.  Two cells of the same character from
the same sheet are nearly the same picture, so a random split would put one
in training and the other in test and report an accuracy that says only that
the model memorised this handwriting.  What the system actually has to do is
read a worker it has never seen, so whole writers are held out and the test
score answers that question instead.
"""
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
CROPS = ROOT / "crops"
SIZE = 64

# Which writers are held out.  Fixed here rather than drawn at random so a
# re-run compares like with like, and chosen to spread the two templates and
# the two collection rounds across all three splits.
SPLIT_ZH = {
    "test":  ["A4", "A10", "A14"],      # old template / new template / round 2
    "val":   ["A1", "A16"],
}
SPLIT_EN = {
    "test":  ["A9", "A4"],              # A9 wrote only the English pages
    "val":   ["A1"],
}


def label_of(folder):
    """The character a crop folder holds, taken from its numeric prefix.

    Folders are named <codepoint>_<character>, and on Windows the character
    half does not survive every unzip: a name written as UTF-8 comes back
    decoded against the legacy code page, so a folder for a multiplication
    sign arrives spelled with Greek and box-drawing characters instead.  The
    prefix is plain digits and always survives, so the label is read from it
    and the rest of the name is left as decoration.
    """
    return chr(int(folder.name.split("_")[0]))


def task_labels(task):
    """The classes of a task, as (folder, character) pairs."""
    out = []
    for d in sorted(CROPS.iterdir()):
        ch = label_of(d)
        is_letter = ch.isascii() and ch.isalpha()
        if (task == "en") == is_letter:
            out.append((d, ch))
    return out


def writers(task):
    ws = set()
    for d, _ in task_labels(task):
        ws |= {p.name.split("_")[0] for p in d.glob("*.png")}
    return sorted(ws, key=lambda w: (len(w), w))


def index(task):
    """Every crop of a task as (path, class index, writer), plus the classes."""
    labels = task_labels(task)
    classes = [ch for _, ch in labels]
    rows = []
    for k, (d, _) in enumerate(labels):
        for p in sorted(d.glob("*.png")):
            rows.append((p, k, p.name.split("_")[0]))
    return rows, classes


def split(task):
    """Group the crops into train / val / test with no writer in two of them."""
    rows, classes = index(task)
    cfg = SPLIT_EN if task == "en" else SPLIT_ZH
    all_w = set(writers(task))
    test, val = set(cfg["test"]) & all_w, set(cfg["val"]) & all_w
    assert not (test & val), "a writer cannot be in two splits"
    train = all_w - test - val
    out = {"train": [], "val": [], "test": []}
    for r in rows:
        out["test" if r[2] in test else "val" if r[2] in val else "train"].append(r)
    return out, classes, {"train": sorted(train), "val": sorted(val), "test": sorted(test)}


def load(path):
    """A crop as ink-on-nothing, 0..1, with the pen's own darkness divided out.

    Writers used everything from a hard pencil to a marker, so raw grey levels
    say more about the pen than the character.  Measuring the paper from the
    crop itself and scaling by the darkest ink in it leaves a picture of the
    strokes that is the same whichever pen drew them.
    """
    # cv2.imread takes a narrow-character path on Windows and fails on any
    # name outside the active code page, which every Chinese label here is.
    # Reading the bytes first keeps the path handling in Python, where it is
    # unicode-correct on every platform.
    raw = np.fromfile(str(path), dtype=np.uint8)
    g = cv2.imdecode(raw, cv2.IMREAD_GRAYSCALE) if raw.size else None
    if g is None:
        raise OSError(f"unreadable: {path}")
    g = g.astype(np.float32)
    paper = float(np.percentile(g, 85))          # most of a cell is blank
    x = np.clip(paper - g, 0, None)
    hi = float(np.percentile(x, 99.5))
    x = np.clip(x / max(hi, 1e-3), 0, 1)
    return cv2.resize(x, (SIZE, SIZE), interpolation=cv2.INTER_AREA)


def augment(x, rng, mild=False):
    """Jitter one sample the way a different hand, pen and photo would.

    Thickening and thinning the strokes stands in for the pen, and the warp,
    blur and lighting for the photograph.  Neither stands in for another
    person's handwriting, which is why the writers matter more than the count.
    """
    h, w = x.shape
    # The strong setting below measurably hurt: three seeds, 87.6% against
    # 92.1% with no augmentation at all.  Its scale jitter spans +-15%, and
    # the real size difference between an upper and a lower case letter in
    # this collection is 1.4%, so it buries cues of that order.  "mild"
    # keeps every distortion well inside what a different hand would do.
    lo, hi = (0.95, 1.05) if mild else (0.85, 1.15)
    ang = rng.uniform(-4, 4) if mild else rng.uniform(-8, 8)
    scale = rng.uniform(lo, hi)
    shear = 0.0 if mild else np.tan(np.radians(rng.uniform(-6, 6)))
    M = cv2.getRotationMatrix2D((w / 2, h / 2), ang, scale)
    M[0, 1] += shear
    t = 0.03 if mild else 0.07
    M[:, 2] += (rng.uniform(-t, t) * w, rng.uniform(-t, t) * h)
    x = cv2.warpAffine(x, M, (w, h), flags=cv2.INTER_LINEAR, borderValue=0.0)

    k = rng.integers(0, 2 if mild else 3)         # pen weight
    if k and (not mild or rng.random() < 0.4):
        el = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * int(k) + 1,) * 2)
        x = cv2.dilate(x, el) if rng.random() < 0.5 else cv2.erode(x, el)

    if rng.random() < 0.5:
        x = cv2.GaussianBlur(x, (0, 0), rng.uniform(0.3, 0.6 if mild else 1.1))

    g0, g1 = (0.9, 1.1) if mild else (0.7, 1.4)
    c0, c1 = (0.9, 1.1) if mild else (0.75, 1.25)
    x = np.clip(x ** rng.uniform(g0, g1) * rng.uniform(c0, c1), 0, 1)

    if not mild and rng.random() < 0.3:           # uneven lighting
        g = np.linspace(rng.uniform(0.8, 1.0), rng.uniform(0.8, 1.0), w)[None, :]
        x = np.clip(x * (g if rng.random() < 0.5 else g.T), 0, 1)

    x = np.clip(x + rng.normal(0, rng.uniform(0, 0.02 if mild else 0.05),
                               x.shape), 0, 1)
    return x.astype(np.float32)


def stack(rows, rng=None, mild=False):
    """Load a list of rows into arrays, augmenting when an rng is given."""
    xs = np.empty((len(rows), 1, SIZE, SIZE), np.float32)
    ys = np.empty(len(rows), np.int64)
    for i, (p, k, _) in enumerate(rows):
        a = load(p)
        xs[i, 0] = augment(a, rng, mild) if rng is not None else a
        ys[i] = k
    return xs, ys
