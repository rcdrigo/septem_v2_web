#!/usr/bin/env bash
# Roda TODAS as suítes de UI (web 1280 + mobile 375) e resume o resultado.
cd "$(dirname "$0")"
PASS=0; FAIL=0; FAILED=""; CHECKS=0
for f in *.mjs; do
  case "$f" in debug-*) continue;; esac
  OUT=$(OUT_DIR=$PWD node "$f" 2>&1)
  N=$(echo "$OUT" | grep -cE "^✓")
  CHECKS=$((CHECKS+N))
  if echo "$OUT" | tail -2 | grep -q "PASSOU"; then
    PASS=$((PASS+1)); printf "✅ %-30s %s checks\n" "${f%.mjs}" "$N"
  else
    FAIL=$((FAIL+1)); FAILED="$FAILED ${f%.mjs}"; printf "❌ %-30s %s\n" "${f%.mjs}" "$(echo "$OUT" | tail -1 | cut -c1-50)"
  fi
done
echo "────────────────────────────────────────────"
echo "SUÍTES: $PASS ok / $((PASS+FAIL)) · CHECKS: $CHECKS"
[ -n "$FAILED" ] && echo "FALHARAM:$FAILED"
exit $FAIL
