"""
What a confidence threshold buys: how much the reader can pass on its own,
and how often it is wrong about what it passed.

Overall accuracy is the wrong number for this system.  Nobody is paid from
a per-character average: a row goes through only if every character in it is
right, and a character the model flags as doubtful costs a second of someone
reading it, while one it gets wrong and is sure about costs a worker money.
So the figures that matter are how much work the model takes off the desk,
and what slips through when it does.
"""
import argparse
import sys
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F

sys.path.insert(0, str(Path(__file__).resolve().parent))
import dataset as D
from train import Net, preload


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("model")
    ap.add_argument("--row-length", type=int, default=6,
                    help="characters in a typical record, for the per-row figure")
    a = ap.parse_args()

    ck = torch.load(a.model, map_location="cpu", weights_only=False)
    classes, task = ck["classes"], ck["task"]
    model = Net(len(classes), ck["width"])
    model.load_state_dict(ck["state"])
    model.eval()

    sp, _, who = D.split(task)
    rows = sp["test"]
    x = torch.from_numpy(preload(rows)).unsqueeze(1)
    y = np.array([r[1] for r in rows])

    with torch.no_grad():
        p = F.softmax(model(x), 1).numpy()
    conf, pred = p.max(1), p.argmax(1)
    ok = pred == y

    print(f"model {a.model}   task {task}   test writers {who['test']}")
    print(f"characters {len(y)}   overall {ok.mean()*100:.1f}%\n")
    print(f"{'threshold':>9} {'auto-passed':>12} {'accuracy there':>15} "
          f"{'errors slipping':>16} {'flagged':>9}")
    for t in (0.0, 0.50, 0.70, 0.80, 0.90, 0.95, 0.98, 0.99, 0.995):
        m = conf >= t
        if m.sum() == 0:
            continue
        acc = ok[m].mean()
        print(f"{t:9.3f} {m.mean()*100:11.1f}% {acc*100:14.2f}% "
              f"{(~ok[m]).sum():12d}    {(~m).mean()*100:8.1f}%")

    print(f"\na record of {a.row_length} characters, every one of which must be right:")
    for t in (0.0, 0.90, 0.98):
        m = conf >= t
        print(f"   threshold {t:.2f}: {ok[m].mean()**a.row_length*100:5.1f}% of "
              f"auto-passed rows fully correct, "
              f"{(1-m.mean()**a.row_length)*100:.0f}% of rows reach a person")

    wrong_sure = [(conf[i], classes[y[i]], classes[pred[i]])
                  for i in np.where(~ok)[0] if conf[i] >= 0.9]
    if wrong_sure:
        print(f"\nwrong while confident (>=0.90) -- these are what cost money:")
        for c, t, q in sorted(wrong_sure, reverse=True)[:12]:
            print(f"   {t} read as {q}   confidence {c:.3f}")
    else:
        print("\nnothing wrong above 0.90 confidence")


if __name__ == "__main__":
    main()
