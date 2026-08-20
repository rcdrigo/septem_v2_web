import type { LucideIcon } from 'lucide-react';
import { Construction } from 'lucide-react';
import { Link } from 'react-router-dom';

type Props = {
  title: string;
  /** Fase do roadmap em que esta tela ganha backend/funcionalidade real. */
  phase?: string;
  /** Linha de contexto sobre o que a tela vai fazer. */
  hint?: string;
  icon?: LucideIcon;
  /**
   * Saída oferecida ao usuário. Quando presente, a tela deixa de ser
   * "em construção" e vira uma página de erro com caminho de volta — é o caso
   * do 404, que na Fase 1 passou a receber quem chegou por link antigo.
   */
  action?: { label: string; to: string };
};

/**
 * Placeholder de tela ainda não implementada. Existe para o shell de navegação
 * ficar inteiramente clicável enquanto preenchemos cada item de verdade.
 */
export function StubPage({ title, phase, hint, icon: Icon = Construction, action }: Props) {
  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
      </header>
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Icon size={26} />
          </div>
          {!action && <p className="text-sm font-medium text-slate-700">Em construção</p>}
          {hint && <p className={`text-sm text-slate-500 ${action ? '' : 'mt-1'}`}>{hint}</p>}
          {phase && (
            <p className="mt-3 inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500">
              {phase}
            </p>
          )}
          {action && (
            <Link
              to={action.to}
              data-testid="stub-action"
              className="mt-4 inline-flex h-10 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
            >
              {action.label}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
