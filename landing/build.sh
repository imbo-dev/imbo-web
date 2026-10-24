#!/bin/sh
# Assemble dist/: src/ plus the brand tokens, font, state layer, logos and icons it links to.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
brand="$here/../../brand"
rel="$brand/releases/1.0.0"
out="$here/dist"

rm -rf "$out"
mkdir -p "$out/brand/fonts" "$out/logo"
cp -R "$here/src/." "$out/"
cp "$brand/tokens.css" "$brand/state-layer.css" "$out/brand/"
cp "$brand/fonts/fonts.css" "$brand/fonts/JetBrainsMono-VF.woff2" "$brand/fonts/JetBrainsMono-OFL.txt" "$out/brand/fonts/"
for f in imbo-wordmark-dark imbo-wordmark-light imbo-wordmark-compact-dark imbo-wordmark-compact-light; do
  cp "$rel/logo/$f.svg" "$out/logo/"
done
cp "$rel/icon/favicon.svg" "$rel/icon/favicon.ico" "$rel/icon/png/apple-touch-icon.png" "$out/"
cp "$rel/applications/github-social-preview/imbo-github-social-preview-1280x640.png" "$out/social-preview.png"
echo "built $out"
