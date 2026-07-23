import { FlaskConical } from 'lucide-react';

/**
 * Selo "processo de teste" (Fase 9). Aparece em tudo que representa uma instância
 * iniciada em simulação — topo da tarefa, cards e tabelas de pendentes/executadas e
 * relatório do processo — para ninguém tratar um teste como trabalho real.
 */
export function TestBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      data-testid="selo-teste"
      title="Processo iniciado como teste: as tarefas ficam todas com o requisitante."
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-amber-100 font-semibold text-amber-800 ring-1 ring-amber-200 ${compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'}`}
    >
      <FlaskConical size={compact ? 11 : 13} aria-hidden="true" />
      Processo de teste
    </span>
  );
}
