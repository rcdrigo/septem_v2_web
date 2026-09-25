#!/usr/bin/env bash
# Roda TODAS as suítes de UI (web 1280 + mobile 375) e resume o resultado.
cd "$(dirname "$0")"
PASS=0; FAIL=0; FAILED=""; CHECKS=0

# O Chrome mora em lugar diferente por SO e há mais de uma máquina rodando esta bateria.
# Toda sonda aceita CHROME_BIN, mas várias caem no caminho do macOS quando ele não está
# definido — e aí nem ABREM no Linux (a suíte morre no launch, sem um único check).
# Resolver aqui, uma vez, vale para as 94.
if [ -z "$CHROME_BIN" ]; then
  for c in /usr/bin/google-chrome /usr/bin/google-chrome-stable /usr/bin/chromium \
           /usr/bin/chromium-browser "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"; do
    if [ -x "$c" ]; then CHROME_BIN="$c"; break; fi
  done
  export CHROME_BIN
fi
if [ -z "$CHROME_BIN" ]; then
  echo "Nenhum Chrome encontrado. Defina CHROME_BIN e rode de novo." >&2; exit 1
fi
echo "Chrome: $CHROME_BIN"

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
