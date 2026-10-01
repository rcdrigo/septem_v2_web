import { ApiError } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useToastStore } from '@/stores/toast';
import { toast } from '@/stores/toast';

/**
 * Aviso de erro de um comando. No 409 (alguém mudou o recurso antes de você), o aviso OFERECE
 * recarregar — requisito transversal do plano 26_09: "409 oferece recarregar sem sobrescrever
 * trabalho concorrente". Recarregar busca de novo os dados da tela; o que a pessoa digitou fica,
 * porque mora no estado do formulário e não no cache.
 */
export function avisarErro(err: unknown, mensagem: string) {
  if (err instanceof ApiError && err.status === 409) {
    const loja = useToastStore.getState();
    const id = loja.push({
      kind: 'error',
      message: mensagem,
      actionLabel: 'Recarregar',
      onAction: () => {
        void queryClient.invalidateQueries();
        useToastStore.getState().dismiss(id);
      },
    });
    // Mais tempo que o erro comum: a pessoa precisa ler e decidir.
    window.setTimeout(() => useToastStore.getState().dismiss(id), 12_000);
    return;
  }
  toast.error(mensagem);
}
