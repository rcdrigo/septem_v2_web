#!/usr/bin/env bash
# Roda TODAS as suítes de UI (web 1280 + mobile 375) e resume o resultado.
cd "$(dirname "$0")"
PASS=0; FAIL=0; FAILED=""; CHECKS=0

# Aquece o front antes de medir: com o Vite frio, a PRIMEIRA suíte da bateria cai por
# timeout no /login e passa quando rodada isolada. Ver warmup.mjs.
echo "Aquecendo o front... $(OUT_DIR=$PWD node warmup.mjs 2>&1 | tail -1)"

for f in *.mjs; do
  case "$f" in debug-*|warmup.mjs) continue;; esac
  OUT=$(OUT_DIR=$PWD node "$f" 2>&1)
  N=$(echo "$OUT" | grep -cE "^✓")
  CHECKS=$((CHECKS+N))
  if echo "$OUT" | tail -2 | grep -q "PASSOU"; then
    PASS=$((PASS+1)); printf "✅ %-30s %s checks\n" "${f%.mjs}" "$N"
  else
    # Sem log, falha intermitente não se investiga: guarda a saída e mostra os ✗.
    echo "$OUT" > "falhou-${f%.mjs}.log"
    FAIL=$((FAIL+1)); FAILED="$FAILED ${f%.mjs}"; printf "❌ %-30s %s\n" "${f%.mjs}" "$(echo "$OUT" | tail -1 | cut -c1-50)"
    echo "$OUT" | grep -E "^✗|^!" | sed 's/^/     /'
  fi
done
echo "────────────────────────────────────────────"
echo "SUÍTES: $PASS ok / $((PASS+FAIL)) · CHECKS: $CHECKS"
[ -n "$FAILED" ] && echo "FALHARAM:$FAILED"
exit $FAIL
