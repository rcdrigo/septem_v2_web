import { useState } from 'react';
import { AlertTriangle, CornerUpLeft, RotateCcw, Send, UserCog, XCircle } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { toast } from '@/stores/toast';
import {
  useActionOptions, useCancelInstance, useMoveInstance, useReassignInstance,
  type InstanceDetail,
} from '@/lib/api/execution';

/** As cinco ações administrativas da Fase 4 (requisitos 2026-08-03). */
type Acao = 'cancel' | 'return' | 'forward' | 'reassign' | 'reopen';

const TITULO: Record<Acao, string> = {
  cancel: 'Cancelar processo',
  return: 'Devolver para tarefa já executada',
  forward: 'Encaminhar para nova tarefa',
  reassign: 'Realocar processo',
  reopen: 'Reabrir processo',
};

const CONFIRMA: Record<Acao, string> = {
  cancel: 'Cancelar processo',
  return: 'Devolver',
  forward: 'Encaminhar',
  reassign: 'Realocar',
  reopen: 'Reabrir',
};

/**
 * Menu + modais das ações administrativas sobre a requisição.
 *
 * A tela NÃO decide o que pode: as flags vêm do relatório (`canCancel`…) e as listas
 * dos dropdowns vêm prontas do servidor (`action-options`). Recalcular a regra aqui
 * faria a lista divergir do que o servidor aceita — e o usuário levaria erro depois
 * de escolher.
 */
export function AcoesDoProcesso({ id, d, onFeito }: { id: string; d: InstanceDetail; onFeito?: () => void }) {
  const [aberta, setAberta] = useState<Acao | null>(null);
  const [justificativa, setJustificativa] = useState('');
  const [alvo, setAlvo] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const opcoes = useActionOptions(id, aberta !== null && aberta !== 'cancel');
  const cancelar = useCancelInstance();
  const devolver = useMoveInstance('return');
  const encaminhar = useMoveInstance('forward');
  const reabrir = useMoveInstance('reopen');
  const realocar = useReassignInstance();

  const disponiveis: { acao: Acao; ativo: boolean; icone: React.ReactNode; classe: string }[] = [
    { acao: 'cancel', ativo: !!d.canCancel, icone: <XCircle size={14} />, classe: 'text-amber-700 hover:bg-amber-50' },
    { acao: 'return', ativo: !!d.canReturn, icone: <CornerUpLeft size={14} />, classe: 'text-slate-700 hover:bg-slate-50' },
    { acao: 'forward', ativo: !!d.canForward, icone: <Send size={14} />, classe: 'text-slate-700 hover:bg-slate-50' },
    { acao: 'reassign', ativo: !!d.canReassign, icone: <UserCog size={14} />, classe: 'text-slate-700 hover:bg-slate-50' },
    { acao: 'reopen', ativo: !!d.canReopen, icone: <RotateCcw size={14} />, classe: 'text-emerald-700 hover:bg-emerald-50' },
  ];

  function abrir(acao: Acao) {
    setAberta(acao); setJustificativa(''); setAlvo(''); setErro(null);
  }

  const etapas = aberta === 'return' ? opcoes.data?.returnTargets
    : aberta === 'forward' ? opcoes.data?.forwardTargets
    : aberta === 'reopen' ? opcoes.data?.reopenTargets
    : undefined;
  const precisaEtapa = aberta === 'return' || aberta === 'forward' || aberta === 'reopen';
  const precisaUsuario = aberta === 'reassign';
  const enviando = cancelar.isPending || devolver.isPending || encaminhar.isPending || reabrir.isPending || realocar.isPending;

  async function confirmar() {
    if (!aberta) return;
    // A tela avisa cedo; o servidor recusa de qualquer jeito (422). Esta checagem é
    // conveniência, não autoridade.
    if (!justificativa.trim()) { setErro('Informe a justificativa.'); return; }
    if (precisaEtapa && !alvo) { setErro('Escolha a etapa de destino.'); return; }
    if (precisaUsuario && !alvo) { setErro('Escolha o usuário de destino.'); return; }
    setErro(null);
    try {
      if (aberta === 'cancel') await cancelar.mutateAsync({ id, justification: justificativa });
      else if (aberta === 'reassign') await realocar.mutateAsync({ id, userId: alvo, justification: justificativa });
      else {
        const m = aberta === 'return' ? devolver : aberta === 'forward' ? encaminhar : reabrir;
        await m.mutateAsync({ id, taskBpmnId: alvo, justification: justificativa });
      }
      toast.success(`${TITULO[aberta]}: concluído.`);
      setAberta(null);
      onFeito?.();
    } catch {
      toast.error(`Não foi possível concluir: ${TITULO[aberta].toLowerCase()}.`);
    }
  }

  return (
    <>
      {disponiveis.filter((a) => a.ativo).map((a) => (
        <button
          key={a.acao}
          type="button"
          data-testid={`acao-${a.acao}`}
          onClick={() => abrir(a.acao)}
          className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${a.classe}`}
        >
          {a.icone} {TITULO[a.acao]}
        </button>
      ))}

      <Dialog
        open={aberta !== null}
        onClose={() => setAberta(null)}
        title={aberta ? TITULO[aberta] : ''}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAberta(null)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Fechar</button>
            <button type="button" onClick={confirmar} disabled={enviando} data-testid="acao-confirmar"
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">
              {enviando ? 'Enviando…' : aberta ? CONFIRMA[aberta] : ''}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* A spec pede este alerta em destaque: encaminhar pula o desenho, e a etapa
              de destino pode não ter saída a partir dali. */}
          {aberta === 'forward' && (
            <div data-testid="alerta-risco" className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>
                Esta ação é <strong>arriscada</strong> e pode causar falhas no funcionamento do
                processo. Utilizar apenas em exceções.
              </span>
            </div>
          )}

          {precisaEtapa && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-800">Etapa de destino</span>
              <select
                data-testid="acao-alvo"
                value={alvo}
                onChange={(e) => setAlvo(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-slate-900 focus:outline-none"
              >
                <option value="">Selecione…</option>
                {(etapas ?? []).map((t) => (
                  <option key={t.taskBpmnId} value={t.taskBpmnId}>{t.name ?? t.taskBpmnId}</option>
                ))}
              </select>
              {opcoes.isLoading && <span className="mt-1 block text-xs text-slate-400">Carregando etapas…</span>}
              {!opcoes.isLoading && (etapas?.length ?? 0) === 0 && (
                <span className="mt-1 block text-xs text-slate-500">Não há etapa disponível para esta ação.</span>
              )}
            </label>
          )}

          {precisaUsuario && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-800">Novo responsável</span>
              <select
                data-testid="acao-alvo"
                value={alvo}
                onChange={(e) => setAlvo(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-slate-900 focus:outline-none"
              >
                <option value="">Selecione…</option>
                {(opcoes.data?.reassignCandidates ?? []).map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              {opcoes.data?.reassignSource === 'all_internal' && (
                <span className="mt-1 block text-xs text-slate-500">
                  A tarefa não é destinada a uma posição específica; a lista traz os usuários internos ativos.
                </span>
              )}
            </label>
          )}

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-800">Justificativa</span>
            <textarea
              data-testid="acao-justificativa"
              rows={3}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Explique o motivo desta ação."
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-slate-900 focus:outline-none"
            />
            <span className="mt-1 block text-xs text-slate-500">
              Fica registrada na tramitação, com seu nome e o horário.
            </span>
          </label>

          {erro && <p data-testid="acao-erro" className="text-sm text-rose-700">{erro}</p>}
        </div>
      </Dialog>
    </>
  );
}
