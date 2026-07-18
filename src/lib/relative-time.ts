/**
 * Data absoluta + tempo relativo, no formato que a spec pede para o histórico
 * (modelos_documentos:31): "18 de jul de 2026, 05:58 (há 18 horas)".
 */
export function formatWithRelative(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const absoluto = d.toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  return `${absoluto} (${relativeFrom(d, now)})`;
}

/** "agora", "há 5 minutos", "há 2 dias", "em 3 horas" (futuro). */
export function relativeFrom(date: Date, now: Date = new Date()): string {
  const segundos = Math.round((now.getTime() - date.getTime()) / 1000);
  const futuro = segundos < 0;
  const abs = Math.abs(segundos);

  const faixas: [number, string, string][] = [
    [60, 'segundo', 'segundos'],
    [3600, 'minuto', 'minutos'],
    [86400, 'hora', 'horas'],
    [2592000, 'dia', 'dias'],
    [31536000, 'mês', 'meses'],
    [Number.POSITIVE_INFINITY, 'ano', 'anos'],
  ];
  const divisores = [1, 60, 3600, 86400, 2592000, 31536000];

  if (abs < 45) return 'agora';
  for (let i = 1; i < faixas.length; i++) {
    if (abs < faixas[i][0]) {
      const n = Math.round(abs / divisores[i]);
      const unidade = n === 1 ? faixas[i][1] : faixas[i][2];
      return futuro ? `em ${n} ${unidade}` : `há ${n} ${unidade}`;
    }
  }
  return futuro ? 'em breve' : 'há muito tempo';
}

/** Duração legível de uma execução: "820 ms" / "1,4 s". */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
}
