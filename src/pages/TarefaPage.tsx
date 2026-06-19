import { useParams } from 'react-router-dom';
import { TaskView } from './TarefasPage';

/**
 * Tarefa pendente em tela cheia (rota /tarefa/:taskId, fora do AppShell — sem
 * menus laterais), no mesmo padrão da tarefa de início. Aberta em nova aba.
 */
export function TarefaPage() {
  const { taskId } = useParams<{ taskId: string }>();
  if (!taskId) return null;
  return (
    <div className="h-screen bg-slate-100">
      <TaskView taskId={taskId} onClose={() => window.close()} />
    </div>
  );
}
