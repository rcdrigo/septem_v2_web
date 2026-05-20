import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';

type Props = {
  /** Label curto usado no fallback ("Painel de propriedades", "Formulário"…). */
  context?: string;
  children: ReactNode;
  /** Callback opcional de telemetria. */
  onError?: (error: Error, info: ErrorInfo) => void;
};

type State = { error: Error | null };

/**
 * Error Boundary React clássico. Embrulha cada região não-crítica do app
 * para que uma exceção em (por exemplo) um Section não derrube o modelador
 * inteiro. Mostra fallback com mensagem e botão de retry.
 *
 * React não tem hook equivalente — precisa ser class component.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', this.props.context ?? '(desconhecido)', error, info);
    this.props.onError?.(error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="rounded-full bg-rose-50 p-3 text-rose-600">
          <TriangleAlert size={20} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Algo deu errado em {this.props.context ?? 'uma parte do modelador'}.
          </h3>
          <p className="mt-1 max-w-xs text-xs text-slate-500">
            {this.state.error.message || 'Erro desconhecido.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw size={14} />
          Tentar novamente
        </button>
      </div>
    );
  }
}
