"""Mark the right sense for each line by hand.

The senses are shuffled before they are shown. WordNet orders senses by how common
they are, so an unshuffled list would quietly push a tired labeller towards the
first one, and how often the first one is right is exactly what we are measuring.
Progress is written after every answer, so quitting halfway loses nothing.
"""

import argparse
import json
import random
import textwrap

BOLD, DIM, OFF = "\033[1m", "\033[2m", "\033[0m"


def load(path):
    return [json.loads(line) for line in open(path, encoding="utf-8")]


def save(path, rows):
    with open(path, "w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row) + "\n")


def highlight(text, word):
    return text.replace(word, f"{BOLD}{word}{OFF}", 1)


def ask(row, done, total):
    order = list(range(len(row["senses"])))
    random.Random(row["id"]).shuffle(order)

    print(f"\n{DIM}{done}/{total} labelled{OFF}")
    print(f"\n  {highlight(row['text'], row['word'])}\n")
    print(f"  {BOLD}{row['lemma']}{OFF} ({row['pos']})\n")

    for shown, index in enumerate(order, start=1):
        sense = row["senses"][index]
        gloss = textwrap.fill(sense["gloss"], 74, subsequent_indent="      ")
        print(f"  {shown:>2}. {gloss}")
        for example in sense["examples"]:
            print(f"      {DIM}\"{example}\"{OFF}")

    while True:
        answer = input("\n  number, [n]one fit, [s]kip, [q]uit > ").strip().lower()
        if answer == "q":
            return None
        if answer == "s":
            return "skip"
        if answer == "n":
            return "none"
        if answer.isdigit() and 1 <= int(answer) <= len(order):
            return row["senses"][order[int(answer) - 1]]["key"]
        print("  not one of the options")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", default="data/candidates.jsonl")
    args = parser.parse_args()

    rows = load(args.file)
    total = len(rows)

    for row in rows:
        if row["label"] is not None:
            continue
        done = sum(1 for r in rows if r["label"] is not None)
        answer = ask(row, done, total)
        if answer is None:
            break
        if answer != "skip":
            row["label"] = answer
            save(args.file, rows)

    done = sum(1 for r in rows if r["label"] is not None)
    print(f"\n{done}/{total} labelled. Run again to carry on.\n")


if __name__ == "__main__":
    main()
