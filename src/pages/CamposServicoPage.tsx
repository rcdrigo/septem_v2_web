import { useSearchParams } from 'react-router-dom';
import { Braces } from 'lucide-react';
import { useServiceFields } from '@/lib/api/document-templates';

/**
 * Campos disponíveis de um serviço (modelos_documentos:44) — abre em aba própria a
 * partir do "Buscar campos disponíveis" no editor de modelos.
 *
 * Mostra agrupamento, nome e a CHAVE pronta para colar no template (já pontuada quando
 * o campo está numa lista dinâmica, ex.: `itens.valor`).
 */
export function CamposServicoPage() {
  const [params] = useSearchParams();
  const key = params.get('key');
  const q = useServiceFields(key);

  const campos = q.data?.fields ?? [];
  const grupos = campos.reduce<Record<string, typeof campos>>((acc, f) => {
    const g = f.group ?? 'Sem agrupamento';
    (acc[g] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Campos disponíveis</p>
          <h1 className="text-lg font-semibold text-slate-900">{q.data?.service ?? key}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Use a <strong>chave</strong> no seu modelo, entre chaves duplas — por exemplo{' '}
            <code className="rounded bg-slate-200 px-1 py-0.5 text-xs">{'{{nome_cliente}}'}</code>.
          </p>
        </header>

        {q.isLoading && <p className="text-sm text-slate-400">Carregando os campos…</p>}
        {q.isError && (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            Não foi possível carregar os campos deste serviço.
          </p>
        )}
        {!q.isLoading && !q.isError && campos.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-md border border-slate-200 bg-white py-12 text-center">
            <Braces size={24} className="text-slate-400" />
            <p className="text-sm text-slate-600">Este serviço ainda não tem campos de formulário.</p>
          </div>
        )}

        {Object.entries(grupos).map(([grupo, itens]) => (
          <section key={grupo} className="mb-4 overflow-hidden rounded-md border border-slate-200 bg-white">
            <h2 className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {grupo}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm" data-testid="campos-tabela">
                <thead className="text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-2 text-left">Nome</th>
                    <th className="px-4 py-2 text-left">Chave</th>
                    <th className="px-4 py-2 text-left">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((f) => (
                    <tr key={f.key} className="border-t border-slate-100" data-testid="campo-linha">
                      <td className="px-4 py-2 text-slate-800">{f.label ?? '—'}</td>
                      <td className="px-4 py-2">
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">{f.key}</code>
                        {f.inList && (
                          <span className="ml-2 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-700">
                            lista dinâmica
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-slate-500">{f.type ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
