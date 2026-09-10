"""Pull a sample of English subtitle lines from the OPUS OpenSubtitles corpus.

The corpus is a 3.6 GB gzip file, one sentence per line. We do not download it.
We read the stream from the start, keep the lines that look usable, and stop at a
byte budget. Reservoir sampling spreads the sample across everything we read
instead of taking the first N, which would all come from the same few films.
"""

import argparse
import gzip
import json
import random
import re
import urllib.request

URL = "https://object.pouta.csc.fi/OPUS-OpenSubtitles/v2018/mono/en.txt.gz"

USABLE = re.compile(r"^[A-Za-z][A-Za-z0-9 ,.'!?;:\"()-]+$")

# Subtitle files carry credits and sync notes that are not dialogue.
BOILERPLATE = re.compile(
    r"\b(subtitl|caption|synced|sync and correction|encoded|ripped|translat|"
    r"resync|www\.|\.com|opensubtitles)", re.I)


def usable(line):
    """A line we could plausibly show a learner: a real sentence, not a title card."""
    if not (30 <= len(line) <= 120):
        return False
    if len(line.split()) < 6:
        return False
    if line.isupper():
        return False
    if BOILERPLATE.search(line):
        return False
    return bool(USABLE.match(line))


def fetch(count, budget_mb, seed):
    rng = random.Random(seed)
    reservoir, seen, read = [], 0, 0
    budget = budget_mb * 1024 * 1024

    with urllib.request.urlopen(URL) as response:
        counting = _CountingReader(response)
        for raw in gzip.GzipFile(fileobj=counting):
            line = raw.decode("utf-8", "replace").strip()
            if not usable(line):
                continue
            seen += 1
            if len(reservoir) < count:
                reservoir.append(line)
            else:
                # Each line seen has an equal chance of being in the final sample.
                i = rng.randrange(seen)
                if i < count:
                    reservoir[i] = line
            if counting.read_bytes > budget:
                break
            read = counting.read_bytes

    return reservoir, seen, read


class _CountingReader:
    """Wraps the HTTP response so we can see how much we have pulled off the wire."""

    def __init__(self, stream):
        self.stream = stream
        self.read_bytes = 0

    def read(self, size=-1):
        chunk = self.stream.read(size)
        self.read_bytes += len(chunk)
        return chunk


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=200_000)
    parser.add_argument("--budget-mb", type=int, default=150)
    parser.add_argument("--seed", type=int, default=17)
    parser.add_argument("--out", default="data/raw/pool.jsonl")
    args = parser.parse_args()

    lines, seen, read = fetch(args.count, args.budget_mb, args.seed)
    with open(args.out, "w", encoding="utf-8") as handle:
        for line in lines:
            handle.write(json.dumps({"text": line}) + "\n")

    print(f"read     {read / 1024 / 1024:.0f} MB off the wire")
    print(f"usable   {seen:,} lines")
    print(f"sampled  {len(lines):,} -> {args.out}")


if __name__ == "__main__":
    main()
