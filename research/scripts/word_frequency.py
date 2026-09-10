"""Count how often each word appears in the pool.

We need this to tell an everyday word from one a learner would stop and look up.
Counting our own subtitle pool beats a general English frequency list, because the
words that are common in films are what matters here.
"""

import argparse
import collections
import json
import re

WORD = re.compile(r"[a-z]+")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pool", default="data/raw/pool.jsonl")
    parser.add_argument("--out", default="data/raw/frequency.json")
    args = parser.parse_args()

    counts = collections.Counter()
    for line in open(args.pool, encoding="utf-8"):
        counts.update(WORD.findall(json.loads(line)["text"].lower()))

    json.dump(counts, open(args.out, "w", encoding="utf-8"))
    print(f"counted  {sum(counts.values()):,} words, {len(counts):,} distinct -> {args.out}")
    print("commonest:", ", ".join(w for w, _ in counts.most_common(10)))


if __name__ == "__main__":
    main()
