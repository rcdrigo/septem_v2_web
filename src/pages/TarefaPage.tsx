import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { TaskView } from './TarefasPage';
import { Toaster } from '@/components/ui/Toaster';
import { ConfirmDialogHost } from '@/components/ui/ConfirmDialog';
import { useSessionStore } from '@/stores/session';

/**
 * Tarefa pendente em tela cheia (rota /tasks/:taskId, fora do AppShell — sem
 * menus laterais), no mesmo padrão da tarefa de início. Aberta em nova aba.
 *
 * Carrega a sessão e monta os avisos/confirmações próprios: esta aba não passa
 * pelo AppShell. O token persistido sozinho não identifica o usuário interno.
 */
export function TarefaPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const status = useSessionStore((s) => s.status);
  const bootstrap = useSessionStore((s) => s.bootstrap);
  useEffect(() => { if (status === 'idle') void bootstrap(); }, [status, bootstrap]);

  if (!taskId) return null;
  return (
    <div className="h-[100dvh] bg-slate-100">
      <TaskView taskId={taskId} onClose={() => window.close()} />
      <Toaster />
      <ConfirmDialogHost />
    </div>
  );
}
