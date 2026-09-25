import { Link } from 'react-router-dom';
import { Building2, Loader2 } from 'lucide-react';
import { usePlatformClients } from '@/lib/api/platform-clients';
import { routes } from '@/lib/routes';
import { useDocumentTitle } from '@/lib/use-document-title';

/** Clientes da plataforma — leitura (Fase 2a). O cadastro nasce na Fase 11a. */
export function PlatformClientesPage() {
  const { data, isLoading, isError } = usePlatformClients();
  useDocumentTitle('Clientes · área central');

  return (
    <section>
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold text-slate-900">Clientes</h1>
        <span className="flex items-center gap-3">
          <span className="text-sm text-slate-500" data-testid="platform-clientes-total">
            {data ? `${data.total} cliente${data.total === 1 ? '' : 's'}` : ''}
          </span>
          <Link
            to={routes.platformNewClient}
            data-testid="novo-cliente"
            className="inline-flex min-h-11 items-center rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800"
          >
            Novo cliente
          </Link>
        </span>
      </header>

      {isLoading && (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </p>
      )}

      {isError && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Não foi possível carregar os clientes.
        </p>
      )}

      {data && data.items.length === 0 && (
        <p
          data-testid="platform-clientes-vazio"
          className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500"
        >
          Nenhum cliente cadastrado ainda. O cadastro de clientes e o provisionamento de ambientes chegam na
          fase de provisionamento.
        </p>
      )}

      {data && data.items.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="platform-clientes-lista">
          {data.items.map((c) => (
            <li key={c.id}>
              <Link
                to={routes.platformClient(c.id)}
                className="flex h-full flex-col gap-1 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-400"
              >
                <span className="flex items-center gap-2 font-medium text-slate-900">
                  <Building2 className="h-4 w-4 text-slate-400" />
                  {c.name}
                </span>
                <span className="text-sm text-slate-500">
                  {c.environments} ambiente{c.environments === 1 ? '' : 's'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
