"""
Rename crop folders to the character their numeric prefix names.

Folders are named <codepoint>_<character>.  A zip written on Linux does not
always carry the flag that says its names are UTF-8, so Windows unpacks them
against the legacy code page and the character half comes back as mojibake.
Nothing reads that half -- the label comes from the prefix -- but the next
extraction run writes the correct name, and the class then has two folders
that no longer meet: one with the old samples, one with the new.  Training
would treat them as two classes and quietly lose accuracy, reporting nothing.

Run once, from anywhere:  python fix_folder_names.py <crops folder>
"""
import sys
from pathlib import Path

root = Path(sys.argv[1] if len(sys.argv) > 1
            else Path(__file__).resolve().parent.parent / "crops")
if not root.is_dir():
    sys.exit(f"not a folder: {root}")

renamed = clean = clash = 0
for d in sorted(root.iterdir()):
    if not d.is_dir():
        continue
    head = d.name.split("_")[0]
    if not head.isdigit():
        print(f"  skipped (no numeric prefix): {d.name}")
        continue
    want = f"{int(head):05d}_{chr(int(head))}"
    if d.name == want:
        clean += 1
        continue
    target = d.with_name(want)
    if target.exists():
        # both spellings already present: move the files together
        n = len(list(target.glob("*.png")))
        for f in d.glob("*.png"):
            f.rename(target / f.name)
        print(f"  merged  {d.name!r} -> {want!r}  "
              f"({n} + {len(list(target.glob('*.png'))) - n} files)")
        if not any(d.iterdir()):
            d.rmdir()
        clash += 1
    else:
        d.rename(target)
        renamed += 1

print(f"\nalready correct {clean}   renamed {renamed}   merged {clash}")
print(f"folders now: {sum(1 for x in root.iterdir() if x.is_dir())}")
