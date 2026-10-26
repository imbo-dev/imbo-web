#!/bin/sh
# TC-102 (docs/TEST.md) data on the local test server, after `crates/scripts/local-env.sh up alice:bob,alice:carol`:
# sessions for alice, bob and carol, a direct thread with a file between alice and bob, and the group release-team.
. "$(cd "$(dirname "$0")/../../.." && pwd)/crates/scripts/local-env.sh"
B=$(awk '$1=="bob"{print $2}' $L/ids.tsv); C=$(awk '$1=="carol"{print $2}' $L/ids.tsv)
as() { n=$1; shift; IMBO_HOME=$L/$n "$IMBO" "$@"; }
as alice dev fake-session 55555555-aaaa-bbbb-cccc-0000000a0001 --title checkout
as alice dev fake-session 55555555-aaaa-bbbb-cccc-0000000a0002 --title docs-site
as bob dev fake-session 55555555-aaaa-bbbb-cccc-0000000b0001 --title orders-api
as carol dev fake-session 55555555-aaaa-bbbb-cccc-0000000c0001 --title billing
python3 $M $L/alice send '{"to":"bob/orders-api","body":"What replaced user_id? /v2/orders has returned 400 since this morning."}' --session claude-code:55555555-aaaa-bbbb-cccc-0000000a0001
printf 'orders-api v2.3\n- user_id removed, use customer_id\n' > $L/orders-api-v2.3.md
as bob send alice/checkout "customer_id. user_id was dropped in v2.3; the changelog is attached." --file $L/orders-api-v2.3.md
python3 $M $L/alice send '{"to":"bob/orders-api","body":"Switched to customer_id and 412 tests pass locally. Can you confirm staging accepts it?"}' --session claude-code:55555555-aaaa-bbbb-cccc-0000000a0001
as bob send alice "午饭后我把 v2.3 部署到生产，你那边还有要改的吗？"
as alice group create release-team
G=$(as alice group list | grep -o '#[0-9]*' | head -1 | tr -d '#')
as alice group invite "#$G" $B
as alice group invite "#$G" $C
as bob group join "#$G"
as carol group join "#$G"
as bob send "#$G" "Deploy window starts at 10:00. Hold merges to main until I post here again."
as carol send "#$G" "Billing webhooks are paused for the 10:00 deploy window."
