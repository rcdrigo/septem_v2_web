#!/usr/bin/env bash
# Roda TODAS as suítes de UI (web 1280 + mobile 375) e resume o resultado.
cd "$(dirname "$0")"
UITEST=$PWD
# As sondas têm dois hábitos de diretório: as minhas resolvem tudo por `import.meta.url`
# e `OUT_DIR`; várias dele usam caminhos RELATIVOS À RAIZ do repo (`entryPoints:
# ['src/lib/native-form.ts']`) e nem compilam quando o processo roda de `tools/uitest`.
# Rodar da raiz atende as duas: OUT_DIR continua apontando para cá.
RAIZ=$(cd ../.. && pwd)
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
echo "Aquecendo o front... $(cd "$RAIZ" && OUT_DIR="$UITEST" node tools/uitest/warmup.mjs 2>&1 | tail -1)"

# Há DUAS convenções de sonda no diretório e a bateria tem de entender as duas:
#   - `PASSOU (n checks)` no fim, com um `✓` por check e `✗` no que falhou, sem exit≠0;
#   - `node:assert` + uma linha `PASS <caso>` por caso, que ESTOURA (exit≠0) na falha.
# O detector antigo só olhava "PASSOU" e reprovava ~30 suítes verdes do outro dev.
for f in *.mjs; do
  # `lib-*.mjs` são helpers compartilhados, não suítes.
  case "$f" in debug-*|lib-*|warmup.mjs) continue;; esac
  # Teto por suíte: uma sonda que espera uma promessa que nunca resolve (aconteceu com
  # `script-task-modeler`, parada no `await saved`) travava a BATERIA INTEIRA, sem teto.
  OUT=$(cd "$RAIZ" && OUT_DIR="$UITEST" timeout "${SUITE_TIMEOUT:-600}" node "tools/uitest/$f" 2>&1); RC=$?
  if [ "$RC" -eq 124 ]; then OUT="$OUT
FALHOU: estourou o teto de ${SUITE_TIMEOUT:-600}s (suíte travada)"; fi
  N=$(echo "$OUT" | grep -cE "^✓|^PASS ")
  CHECKS=$((CHECKS+N))
  VERDE=0
  if [ "$RC" -eq 0 ] \
     && ! echo "$OUT" | grep -qE "^(FALHOU|✗|FAIL )" \
     && echo "$OUT" | grep -qE "^(PASSOU|PASS )"; then
    VERDE=1
  fi
  if [ "$VERDE" -eq 1 ]; then
    PASS=$((PASS+1)); printf "✅ %-30s %s checks\n" "${f%.mjs}" "$N"
  else
    # Sem log, falha intermitente não se investiga: guarda a saída e mostra os ✗.
    echo "$OUT" > "falhou-${f%.mjs}.log"
    FAIL=$((FAIL+1)); FAILED="$FAILED ${f%.mjs}"; printf "❌ %-30s %s\n" "${f%.mjs}" "$(echo "$OUT" | tail -1 | cut -c1-50)"
    echo "$OUT" | grep -E "^✗|^!|^FAIL " | sed 's/^/     /'
  fi
done
echo "────────────────────────────────────────────"
echo "SUÍTES: $PASS ok / $((PASS+FAIL)) · CHECKS: $CHECKS"
[ -n "$FAILED" ] && echo "FALHARAM:$FAILED"
exit $FAIL
