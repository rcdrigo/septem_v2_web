import { useParams } from 'react-router-dom';
import { TaskView } from './TarefasPage';
import { Toaster } from '@/components/ui/Toaster';

/**
 * Tarefa pendente em tela cheia (rota /tarefa/:taskId, fora do AppShell — sem
 * menus laterais), no mesmo padrão da tarefa de início. Aberta em nova aba.
 *
 * Monta o próprio <Toaster/> — fora do AppShell não há o global, e sem ele o
 * usuário não vê os avisos de "Rascunho salvo" / erros ao salvar ou concluir.
 */
export function TarefaPage() {
  const { taskId } = useParams<{ taskId: string }>();
  if (!taskId) return null;
  return (
    <div className="h-screen bg-slate-100">
      <TaskView taskId={taskId} onClose={() => window.close()} />
      <Toaster />
    </div>
  );
}
