import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { platformApi } from '@/lib/platform-api';
import { useQuemEsta, type SupportScope } from '@/lib/api/support';

/**
 * O sino (Fase 7 — SUP-08). A caixa é SEMPRE a da sessão: não há parâmetro de destinatário, e o
 * servidor revalida o acesso a cada leitura — aviso de chamado transferido some da lista, e a tela
 * não o guarda em cache além do que a API devolve.
 */
export type NotificationItem = {
  id: string;
  data: { title: string; link: string; ticketId: string; protocol: string; type: string } | null;
  createdAt: string;
  readAt: string | null;
};

export type NotificationInbox = { unread: number; items: NotificationItem[] };

const cliente = (lado: SupportScope) => (lado === 'septem' ? platformApi : api);
const caminho = (lado: SupportScope, resto = '') =>
  lado === 'septem' ? `/notifications${resto}` : `/api/v1/notifications${resto}`;

/** Chave com a identidade: trocar de conta na mesma aba não pode mostrar o sino de quem saiu. */
function useChave(lado: SupportScope) {
  return ['notifications', lado, useQuemEsta(lado)] as const;
}

/** Intervalo da atualização do sino — o outbox não empurra, a tela pergunta. */
export const INTERVALO_DO_SINO = 30_000;

export function useNotificacoes(lado: SupportScope) {
  return useQuery({
    queryKey: useChave(lado),
    queryFn: () => cliente(lado).get<NotificationInbox>(caminho(lado)),
    refetchInterval: INTERVALO_DO_SINO,
    refetchOnWindowFocus: true,
  });
}

export function useMarcarLida(lado: SupportScope) {
  const qc = useQueryClient();
  const chave = useChave(lado);
  return useMutation({
    mutationFn: (id: string) => cliente(lado).post<void>(caminho(lado, `/${id}/read`), {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: chave }),
  });
}
