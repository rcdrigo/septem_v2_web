import type { LucideIcon } from 'lucide-react';
import { Construction } from 'lucide-react';

type Props = {
  title: string;
  /** Fase do roadmap em que esta tela ganha backend/funcionalidade real. */
  phase?: string;
  /** Linha de contexto sobre o que a tela vai fazer. */
  hint?: string;
  icon?: LucideIcon;
};

/**
 * Placeholder de tela ainda não implementada. Existe para o shell de navegação
 * ficar inteiramente clicável enquanto preenchemos cada item de verdade.
 */
export function StubPage({ title, phase, hint, icon: Icon = Construction }: Props) {
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
          <p className="text-sm font-medium text-slate-700">Em construção</p>
          {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
          {phase && (
            <p className="mt-3 inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500">
              {phase}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
