import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, TriangleAlert, XCircle } from 'lucide-react';
import { Popover } from '@/components/ui/Popover';
import { validateProcess, type IssueSeverity, type ValidationIssue } from '@/lib/validation';
import { useModeladorStore } from '@/stores/modelador';

type Props = {
  modeler: any | null;
};

/**
 * Badge fixo na navbar que exibe a saúde do processo:
 *  - verde, sem texto → 0 issues
 *  - amarelo "N avisos" → só warnings
 *  - vermelho "N erros" → 1+ erro
 *
 * Clicar abre popover com a lista; clicar num issue seleciona o elemento no canvas
 * (e troca para a view "Fluxo" automaticamente).
 */
export function DiagnosticsBadge({ modeler }: Props) {
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const setCurrentView = useModeladorStore((s) => s.setCurrentView);
  const xmlVersion = useModeladorStore((s) => s.xml);

  useEffect(() => {
    if (!modeler) return;
    function refresh() {
      setIssues(validateProcess(modeler));
    }
    refresh();
    const bus = modeler.get('eventBus');
    const events = ['commandStack.changed', 'elements.changed', 'shape.added', 'shape.removed'];
    events.forEach((ev) => bus.on(ev, refresh));
    return () => events.forEach((ev) => bus.off(ev, refresh));
  }, [modeler, xmlVersion]);

  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const tone: IssueSeverity | 'ok' = errors > 0 ? 'error' : warnings > 0 ? 'warning' : 'ok';

  function selectElement(elementId?: string) {
    if (!modeler || !elementId) return;
    setCurrentView('fluxo');
    const el = modeler.get('elementRegistry').get(elementId);
    if (el) {
      modeler.get('selection').select(el);
      modeler.get('canvas').scrollToElement(el, { top: 80, bottom: 80, left: 80, right: 80 });
    }
  }

  return (
    <Popover
      trigger={() => (
        <span
          className={[
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            tone === 'error' && 'bg-rose-100 text-rose-800 hover:bg-rose-200',
            tone === 'warning' && 'bg-amber-100 text-amber-800 hover:bg-amber-200',
            tone === 'ok' && 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <ToneIcon tone={tone} />
          {tone === 'ok' && 'Tudo certo'}
          {tone === 'warning' && `${warnings} aviso${warnings === 1 ? '' : 's'}`}
          {tone === 'error' && `${errors} erro${errors === 1 ? '' : 's'}`}
          <ChevronDown size={12} />
        </span>
      )}
    >
      {(close) => (
        <div className="max-h-[420px] w-[360px] overflow-y-auto">
          <header className="border-b border-slate-100 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Diagnóstico
          </header>
          {issues.length === 0 && (
            <div className="px-3 py-4 text-center text-sm text-slate-500">
              Nenhuma inconsistência encontrada.
            </div>
          )}
          {issues.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {issues.map((issue) => (
                <li key={issue.id}>
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      selectElement(issue.elementId);
                    }}
                    disabled={!issue.elementId}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-60"
                  >
                    <span className="mt-0.5 shrink-0">
                      <SeverityDot severity={issue.severity} />
                    </span>
                    <span className="flex-1 text-slate-700">{issue.message}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Popover>
  );
}

function ToneIcon({ tone }: { tone: 'ok' | IssueSeverity }) {
  if (tone === 'ok') return <CheckCircle2 size={14} />;
  if (tone === 'warning') return <TriangleAlert size={14} />;
  return <XCircle size={14} />;
}

function SeverityDot({ severity }: { severity: IssueSeverity }) {
  return (
    <span
      className={[
        'inline-block h-2.5 w-2.5 rounded-full',
        severity === 'error' ? 'bg-rose-500' : 'bg-amber-500',
      ].join(' ')}
    />
  );
}
