#!/bin/sh
# Build and publish to the Cloudflare Pages project "imbo" (imbo.dev).
# The token comes from Bitwarden; unlock the vault first (`bw unlock`).
set -eu
here=$(cd "$(dirname "$0")" && pwd)
"$here/build.sh"
token=$(bw get password CLOUDFLARE_ACCOUNT_TOKEN_RW)
CLOUDFLARE_API_TOKEN=$token CLOUDFLARE_ACCOUNT_ID=627a6218f132dffc9cb22dd50c2fe1a6 \
  npx --yes wrangler@4 pages deploy "$here/dist" --project-name imbo --branch main --commit-dirty=true
