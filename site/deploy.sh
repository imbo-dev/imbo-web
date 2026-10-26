#!/bin/sh
set -eu
here=$(cd "$(dirname "$0")" && pwd)
(cd "$here" && npm run build)
token=$(bw get password IMBO_PAGES_DEPLOY_TOKEN)
CLOUDFLARE_API_TOKEN=$token CLOUDFLARE_ACCOUNT_ID=627a6218f132dffc9cb22dd50c2fe1a6 \
  npx --yes wrangler@4 pages deploy "$here/dist" --project-name imbo --branch main --commit-dirty=true
