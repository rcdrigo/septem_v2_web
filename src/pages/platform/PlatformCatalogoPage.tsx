import { useState } from 'react';
import { BookOpen, Loader2, PackageCheck, TriangleAlert } from 'lucide-react';
import {
  usePlatformCatalog,
  useCreateCatalogProcess,
  usePublishCatalogVersion,
  type CatalogProcessRow,
  type PublishedVersion,
} from '@/lib/api/platform-catalog';
import { useDocumentTitle } from '@/lib/use-document-title';

/**
 * Catálogo de processos da Septem (ADM-05, Fase 12).
 *
 * ⚠️ Desvio consciente da spec, registrado no plano: a spec pede modelagem DENTRO da área
 * central. Aqui a central **cadastra e publica versões**, e a modelagem usa o modelador do
 * ambiente interno de catálogo — o mesmo com parser, validador e simulador. Por isso a
 * tela mostra, em destaque, qual ambiente é esse.
 */
export function PlatformCatalogoPage() {
  const { data, isLoading, isError } = usePlatformCatalog();
  const criar = useCreateCatalogProcess();
  const publicar = usePublishCatalogVersion();
  const [form, setForm] = useState({ key: '', name: '', description: '' });
  const [ultima, setUltima] = useState<PublishedVersion | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useDocumentTitle('Catálogo de processos · área central');

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    try {
      await criar.mutateAsync({
        key: form.key.trim(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
      });
      setForm({ key: '', name: '', description: '' });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível cadastrar.');
    }
  }

  async function publicarVersao(processo: CatalogProcessRow) {
    setErro(null);
    setUltima(null);
    try {
      setUltima(await publicar.mutateAsync({ id: processo.id }));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível publicar a versão.');
    }
  }

  return (
    <section>
      <header className="mb-4">
        <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <BookOpen className="h-5 w-5 text-slate-500" /> Catálogo de processos
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Os processos são desenhados no <strong>ambiente interno de catálogo</strong>
          {data ? (
            <>
              {' '}(<span data-testid="catalogo-ambiente">{data.catalogTenantId}</span>)
            </>
          ) : null}
          , com o modelador de sempre. Aqui você cadastra a chave e publica as versões que os
          ambientes dos clientes podem instalar.
        </p>
      </header>

      {isLoading && (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </p>
      )}

      {isError && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Não foi possível carregar o catálogo.
        </p>
      )}

      {erro && (
        <p
          data-testid="catalogo-erro"
          className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {erro}
        </p>
      )}

      {ultima && (
        <div
          data-testid="catalogo-publicado"
          className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          <p className="flex items-center gap-2 font-medium">
            <PackageCheck className="h-4 w-4" /> Versão {ultima.version} publicada · {ultima.artifacts}{' '}
            artefato{ultima.artifacts === 1 ? '' : 's'}
          </p>
          {ultima.pendings.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-emerald-900">
              {ultima.pendings.map((p) => (
                <li key={`${p.type}:${p.logicalId}:${p.reason}`}>{p.detail}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <form
        onSubmit={cadastrar}
        data-testid="catalogo-form"
        className="mb-6 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Chave no ambiente de catálogo</span>
          <input
            value={form.key}
            onChange={(e) => setForm({ ...form, key: e.target.value })}
            data-testid="catalogo-key"
            placeholder="licenca-de-obra"
            className="min-h-11 rounded-md border border-slate-300 px-3"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Nome</span>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            data-testid="catalogo-nome"
            placeholder="Licença de obra"
            className="min-h-11 rounded-md border border-slate-300 px-3"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Descrição</span>
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            data-testid="catalogo-descricao"
            className="min-h-11 rounded-md border border-slate-300 px-3"
          />
        </label>
        <div className="sm:col-span-3">
          <button
            type="submit"
            disabled={criar.isPending || !form.key.trim() || !form.name.trim()}
            data-testid="catalogo-cadastrar"
            className="inline-flex min-h-11 items-center rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {criar.isPending ? 'Cadastrando…' : 'Cadastrar processo'}
          </button>
        </div>
      </form>

      {data && data.items.length === 0 && (
        <p
          data-testid="catalogo-vazio"
          className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500"
        >
          Nenhum processo no catálogo. Modele no ambiente interno e cadastre a chave aqui.
        </p>
      )}

      {data && data.items.length > 0 && (
        <ul className="grid gap-3" data-testid="catalogo-lista">
          {data.items.map((p) => (
            <li
              key={p.id}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              data-testid="catalogo-item"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.key}</p>
                  {p.description && <p className="mt-1 text-sm text-slate-600">{p.description}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => void publicarVersao(p)}
                  disabled={publicar.isPending}
                  data-testid={`catalogo-publicar-${p.key}`}
                  className="inline-flex min-h-11 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                >
                  {publicar.isPending ? 'Publicando…' : 'Publicar versão'}
                </button>
              </div>

              {p.versions.length === 0 ? (
                <p className="mt-3 flex items-center gap-1.5 text-sm text-amber-700">
                  <TriangleAlert className="h-4 w-4" /> Sem versão publicada — nenhum ambiente pode
                  instalar este processo ainda.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100 text-sm" data-testid={`catalogo-versoes-${p.key}`}>
                  {p.versions.map((v) => (
                    <li key={v.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-1.5">
                      <span className="font-medium text-slate-800">v{v.version}</span>
                      <span className="text-slate-500">
                        {new Date(v.publishedAt).toLocaleString('pt-BR')}
                      </span>
                      {v.pendingCount > 0 && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                          {v.pendingCount} pendência{v.pendingCount === 1 ? '' : 's'}
                        </span>
                      )}
                      {v.releaseNotes && <span className="text-slate-600">{v.releaseNotes}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
