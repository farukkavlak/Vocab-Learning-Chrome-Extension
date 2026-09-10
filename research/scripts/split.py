"""Split the labelled lines into a working set and a sealed set.

The sealed lines are not opened until phase 17. Every number we quote before then
comes from the working set. Anything tuned against a set of examples looks better on
that set than it will in the wild, and the only defence is a set nothing was ever
tuned against.

The split keeps the three frequency bands even. A sealed set that happened to be all
rare words would flatter us, since rare words carry fewer meanings.
"""

import argparse
import collections
import json
import random

BANDS = ["everyday", "common", "uncommon"]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", default="data/candidates.jsonl")
    parser.add_argument("--sealed-per-band", type=int, default=17)
    parser.add_argument("--seed", type=int, default=17)
    args = parser.parse_args()

    rows = [json.loads(line) for line in open(args.file, encoding="utf-8")]
    labelled = [row for row in rows if row["label"] is not None]
    if len(labelled) < len(rows):
        print(f"warning: {len(rows) - len(labelled)} lines are still unlabelled\n")

    by_band = collections.defaultdict(list)
    for row in labelled:
        by_band[row["band"]].append(row)

    sealed, working = [], []
    for band in BANDS:
        part = by_band[band]
        random.Random(args.seed).shuffle(part)
        sealed += part[: args.sealed_per_band]
        working += part[args.sealed_per_band :]

    for path, part in [("data/working.jsonl", working), ("data/sealed.jsonl", sealed)]:
        counts = collections.Counter(row["band"] for row in part)
        spread = ", ".join(f"{counts[b]} {b}" for b in BANDS)
        with open(path, "w", encoding="utf-8") as handle:
            for row in part:
                handle.write(json.dumps(row) + "\n")
        print(f"{len(part):>4} lines -> {path:<20} ({spread})")


if __name__ == "__main__":
    main()
