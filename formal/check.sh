#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

jar="${TLA2TOOLS_JAR:-$PWD/tla2tools.jar}"
if [ ! -f "$jar" ]; then
  curl -fsSL -o "$jar" \
    https://github.com/tlaplus/tlaplus/releases/download/v1.8.0/tla2tools.jar
fi

run_tlc() {
  java -XX:+UseParallelGC -cp "$jar" tlc2.TLC -config "$1" TaskLifecycle.tla
}

echo "Checking safe model (TaskLifecycle.cfg)..."
run_tlc TaskLifecycle.cfg

echo "Checking that the unsafe accept race is still reproducible..."
unsafe_log="$(mktemp)"
trap 'rm -f "$unsafe_log"' EXIT

set +e
run_tlc TaskLifecycleUnsafe.cfg >"$unsafe_log" 2>&1
unsafe_status=$?
set -e

if [ "$unsafe_status" -eq 0 ]; then
  echo "Expected TaskLifecycleUnsafe.cfg to violate AtMostOneOwner, but TLC passed." >&2
  cat "$unsafe_log" >&2
  exit 1
fi

if ! grep -q "Invariant AtMostOneOwner is violated" "$unsafe_log"; then
  echo "Unsafe model failed for an unexpected reason:" >&2
  cat "$unsafe_log" >&2
  exit 1
fi

echo "OK: safe model passed; unsafe model reproduced the double-accept violation."
