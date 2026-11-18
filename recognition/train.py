"""
Train and evaluate the character classifier.

Reports accuracy on writers the model never saw, and a per-writer breakdown,
because a single average hides the case this system actually fails in: one
person whose hand the model cannot read at all, whose pay would then be
wrong every time.
"""
import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

sys.path.insert(0, str(Path(__file__).resolve().parent))
import dataset as D


class Net(nn.Module):
    """A small VGG-ish stack: enough for 36 well-separated classes, small
    enough to train on a couple of CPU cores in minutes."""

    def __init__(self, n_classes, width=32):
        super().__init__()
        def block(i, o):
            return nn.Sequential(
                nn.Conv2d(i, o, 3, padding=1, bias=False), nn.BatchNorm2d(o), nn.ReLU(True),
                nn.Conv2d(o, o, 3, padding=1, bias=False), nn.BatchNorm2d(o), nn.ReLU(True),
                nn.MaxPool2d(2))
        w = width
        self.body = nn.Sequential(block(1, w), block(w, 2 * w), block(2 * w, 4 * w))
        self.head = nn.Sequential(nn.AdaptiveAvgPool2d(1), nn.Flatten(),
                                  nn.Dropout(0.3), nn.Linear(4 * w, n_classes))

    def forward(self, x):
        return self.head(self.body(x))


def preload(rows):
    """Every crop decoded once; augmentation then works from memory."""
    return np.stack([D.load(p) for p, _, _ in rows]).astype(np.float32)


def batches(x, y, bs, rng=None, shuffle=False):
    idx = np.arange(len(y))
    if shuffle:
        rng.shuffle(idx)
    for i in range(0, len(idx), bs):
        j = idx[i:i + bs]
        yield torch.from_numpy(x[j]).unsqueeze(1), torch.from_numpy(y[j])


@torch.no_grad()
def evaluate(model, x, y, bs=256):
    model.eval()
    pred = []
    for xb, _ in batches(x, y, bs):
        pred.append(model(xb).argmax(1).numpy())
    return np.concatenate(pred) if pred else np.array([], int)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--task", default="zh", choices=["zh", "en"])
    ap.add_argument("--epochs", type=int, default=60)
    ap.add_argument("--batch", type=int, default=64)
    ap.add_argument("--lr", type=float, default=2e-3)
    ap.add_argument("--width", type=int, default=32)
    ap.add_argument("--no-aug", action="store_true")
    ap.add_argument("--mild", action="store_true",
                    help="gentler augmentation; the strong setting hurt")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--out", default=None)
    a = ap.parse_args()

    torch.manual_seed(a.seed)
    rng = np.random.default_rng(a.seed)
    torch.set_num_threads(2)

    sp, classes, who = D.split(a.task)
    print(f"task {a.task}: {len(classes)} classes")
    for k in ("train", "val", "test"):
        print(f"  {k:5} {len(sp[k]):5d} crops   writers {who[k]}")

    base = {k: preload(sp[k]) for k in sp}
    ys = {k: np.array([r[1] for r in sp[k]], np.int64) for k in sp}
    wr = {k: [r[2] for r in sp[k]] for k in sp}

    model = Net(len(classes), a.width)
    n_par = sum(p.numel() for p in model.parameters())
    print(f"  model {n_par/1000:.0f}k parameters, augmentation "
          f"{'off' if a.no_aug else ('mild' if a.mild else 'strong')}\n")

    opt = torch.optim.AdamW(model.parameters(), lr=a.lr, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.OneCycleLR(
        opt, max_lr=a.lr, total_steps=a.epochs * max(1, len(ys["train"]) // a.batch + 1))

    best, best_state, t0 = -1.0, None, time.time()
    for ep in range(1, a.epochs + 1):
        model.train()
        xt = base["train"] if a.no_aug else np.stack(
            [D.augment(im, rng, a.mild) for im in base["train"]])
        tot = 0.0
        for xb, yb in batches(xt, ys["train"], a.batch, rng, shuffle=True):
            opt.zero_grad()
            loss = F.cross_entropy(model(xb), yb, label_smoothing=0.05)
            loss.backward()
            opt.step()
            sched.step()
            tot += float(loss) * len(yb)
        va = float((evaluate(model, base["val"], ys["val"]) == ys["val"]).mean())
        if va > best:
            best, best_state = va, {k: v.clone() for k, v in model.state_dict().items()}
        if ep % 5 == 0 or ep == 1:
            print(f"  epoch {ep:3d}  loss {tot/len(ys['train']):.3f}  "
                  f"val {va*100:5.1f}%   [{time.time()-t0:4.0f}s]")

    model.load_state_dict(best_state)
    print(f"\nbest val {best*100:.1f}%")

    pred = evaluate(model, base["test"], ys["test"])
    acc = float((pred == ys["test"]).mean())
    print(f"TEST (unseen writers) {acc*100:.1f}%   n={len(pred)}")

    print("\n  per writer:")
    for w in sorted(set(wr["test"]), key=lambda s: (len(s), s)):
        m = np.array([x == w for x in wr["test"]])
        print(f"    {w:4} {(pred[m] == ys['test'][m]).mean()*100:5.1f}%  (n={m.sum()})")

    err = {}
    for t, p in zip(ys["test"], pred):
        if t != p:
            err[(classes[t], classes[p])] = err.get((classes[t], classes[p]), 0) + 1
    if err:
        print("\n  most confused (true -> predicted):")
        for (t, p), n in sorted(err.items(), key=lambda kv: -kv[1])[:12]:
            print(f"    {t} -> {p}   {n}")

    if a.out:
        torch.save({"state": best_state, "classes": classes, "width": a.width,
                    "task": a.task, "split": who}, a.out)
        Path(a.out).with_suffix(".json").write_text(json.dumps(
            {"task": a.task, "classes": classes, "split": who,
             "val_acc": best, "test_acc": acc,
             "n_train": len(ys["train"]), "n_test": len(ys["test"])}, indent=1,
            ensure_ascii=False))
        print(f"\nsaved {a.out}")


if __name__ == "__main__":
    main()
