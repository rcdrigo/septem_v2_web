import { Link } from 'react-router-dom';
import { routes } from '@/lib/routes';
import { useSessionStore } from '@/stores/session';

/** A configuração permanece acessível enquanto novos processos estão bloqueados. */
export function CalendarSetupNotice() {
  const canConfigure = useSessionStore((s) => s.can('admin:settings'));
  if (useSessionStore((s) => s.tenant?.calendarReady) !== false) return null;
  return (
    <div role="status" data-testid="calendar-not-configured" className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <p>Os processos apenas podem ser iniciados após a configuração de estado, município, fuso horário e horário de funcionamento deste ambiente.</p>
      {canConfigure && <Link to={routes.adminSettings} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center font-semibold underline">Configurar calendário</Link>}
    </div>
  );
}
