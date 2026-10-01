import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Popover } from '@/components/ui/Popover';
import { useMarcarLida, useNotificacoes, type NotificationItem } from '@/lib/api/notifications';
import type { SupportScope } from '@/lib/api/support';
import { Quando } from '@/components/ui/Quando';

/**
 * Sino de notificações (Fase 7 — SUP-08), no AppShell e na área central.
 *
 * <p>
 * Abrir um aviso marca como lido e navega para o link que o SERVIDOR mandou — a tela não monta
 * rota de chamado. A lista é a que a API devolve a cada consulta, já revalidada: o que o usuário
 * perdeu o acesso (chamado transferido) não aparece nem de cache.
 * </p>
 */
export function SinoDeNotificacoes({
  lado, align = 'right', tom = 'claro',
}: {
  lado: SupportScope;
  align?: 'left' | 'right';
  /** `escuro` para o cabeçalho escuro da área central. */
  tom?: 'claro' | 'escuro';
}) {
  const caixa = useNotificacoes(lado);
  const marcar = useMarcarLida(lado);
  const navigate = useNavigate();
  const naoLidas = caixa.data?.unread ?? 0;
  const itens = caixa.data?.items ?? [];

  function abrir(n: NotificationItem, fechar: () => void) {
    fechar();
    if (!n.readAt) marcar.mutate(n.id);
    if (n.data?.link) navigate(n.data.link);
  }

  return (
    <Popover
      align={align}
      panelRole="dialog"
      ariaLabel="Notificações"
      triggerClassName={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${tom === 'escuro'
        ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}
      trigger={() => (
        <span data-testid="sino" data-nao-lidas={naoLidas}>
          <Bell size={18} />
          {naoLidas > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold leading-none text-white"
              data-testid="sino-contador"
            >
              {naoLidas > 99 ? '99+' : naoLidas}
            </span>
          )}
        </span>
      )}
    >
      {(fechar) => (
        <div className="w-[min(22rem,calc(100vw-1rem))]" data-testid="sino-painel">
          <p className="border-b border-slate-100 px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Notificações
          </p>
          {caixa.isLoading && <p className="px-3 py-3 text-sm text-slate-400">Carregando…</p>}
          {caixa.isError && (
            <p className="px-3 py-3 text-sm text-rose-700" data-testid="sino-erro">
              Não foi possível carregar as notificações.{' '}
              <button type="button" onClick={() => void caixa.refetch()} className="font-medium underline">Tentar de novo</button>
            </p>
          )}
          {!caixa.isLoading && !caixa.isError && itens.length === 0 && (
            <p className="px-3 py-3 text-sm text-slate-500" data-testid="sino-vazio">Nenhuma notificação.</p>
          )}
          <ul className="max-h-[60vh] overflow-y-auto">
            {itens.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => abrir(n, fechar)}
                  data-testid="notificacao"
                  data-lida={n.readAt ? 'sim' : 'nao'}
                  data-link={n.data?.link}
                  className={`flex w-full min-w-0 items-start gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 ${n.readAt ? 'text-slate-500' : 'text-slate-800'}`}
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? 'bg-transparent' : 'bg-cyan-600'}`}
                    aria-label={n.readAt ? undefined : 'não lida'}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`block break-words ${n.readAt ? '' : 'font-medium'}`}>{n.data?.title ?? 'Notificação'}</span>
                    <Quando iso={n.createdAt} className="text-xs text-slate-400" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Popover>
  );
}
