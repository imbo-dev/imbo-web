#!/bin/sh
# Wake-note cases TC-362/TC-363 (docs/TEST.md §3「叫起提示」): swap alice's daemon for one that finds a fake `claude`, which exits
# after 5 s without the session coming online, so a wake goes waking → failed in about 35 s. It must exit well within the 20 s the
# daemon gives `claude --bg`, or the failure is that timeout instead. Then pin t<case> (has a session record), t<case>n (no record)
# and t<case>x (Codex), and remove them so they're alice's offline sessions.
# usage: sh web/app/tests/wake-env.sh <case> [down]
. "$(dirname "$0")/../../../crates/scripts/local-env.sh"
n=$1
id=55555555-aaaa-bbbb-cccc-000000${n}00

restart_alice() {
  pid=$(cat "$L/alice/daemon.pid")
  kill "$pid"
  while kill -0 "$pid" 2>/dev/null; do sleep 0.2; done
  before=$(grep -c connected "$L/alice/daemon.log")
  mkdir -p "$L/alice/codex-none"
  if [ "${2:-}" = down ]; then
    "$(dirname "$0")/../../../crates/scripts/local-env.sh" daemon alice
  else
    env -u IMBO_WAFFO_PRIVATE_KEY CODEX_HOME=$L/alice/codex-none IMBO_HOME=$L/alice \
      PATH="$L/fake/bin:$PATH" CLAUDE_CONFIG_DIR=$L/fake/config \
      nohup "$I" daemon >> "$L/alice/daemon.log" 2>&1 &
  fi
  until [ "$(grep -c connected "$L/alice/daemon.log")" -gt "$before" ]; do sleep 0.2; done
  # The seed's sessions live in the daemon that just stopped.
  IMBO_HOME=$L/alice "$IMBO" dev fake-session 55555555-aaaa-bbbb-cccc-0000000a0001 --title checkout
  IMBO_HOME=$L/alice "$IMBO" dev fake-session 55555555-aaaa-bbbb-cccc-0000000a0002 --title docs-site
}

if [ "${2:-}" = down ]; then
  restart_alice "$n" down
  exit
fi
mkdir -p "$L/fake/bin" "$L/fake/config/projects/p"
printf '#!/bin/sh\nsleep 5\nexit 0\n' > "$L/fake/bin/claude"
chmod +x "$L/fake/bin/claude"
echo '{"cwd":"/tmp","permissionMode":"default"}' > "$L/fake/config/projects/p/${id}1.jsonl"
restart_alice "$n"
for s in "1 t$n" "2 t${n}n" "3 t${n}x --tool codex"; do
  set -- $s
  k=$1; shift
  IMBO_HOME=$L/alice "$IMBO" dev fake-session "$id$k" --title "$@"
  IMBO_HOME=$L/alice "$IMBO" dev fake-session "$id$k" --title "$@" --remove
done
