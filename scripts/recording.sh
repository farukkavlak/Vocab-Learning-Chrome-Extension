#!/usr/bin/env bash
# Records the flow once and turns it into docs/flow.gif, the animation in the README.
# Needs ffmpeg. The dithering is off on purpose: the frame is mostly a smooth gradient,
# which dithering triples the size of.
set -euo pipefail

out=$(mktemp -d)
trap 'rm -rf "$out"' EXIT

RECORD="$out" SHOTS=1 npx playwright test recording
video=$(ls -S "$out"/*.webm | head -1)

ffmpeg -y -v error -ss 0.8 -i "$video" \
  -vf "fps=12,scale=860:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=none" \
  docs/flow.gif

echo "docs/flow.gif  $(du -h docs/flow.gif | cut -f1)"
