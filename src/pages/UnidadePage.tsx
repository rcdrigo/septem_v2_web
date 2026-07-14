import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2, FileStack, FileText, Mail, MapPin, Phone, Printer, Users, Workflow } from 'lucide-react';
import { useOrgUnit, type OrgPerson } from '@/lib/api/org-units';
import { useDocumentTitle } from '@/lib/use-document-title';
import { openTab } from '@/lib/nav';

type AbaKey = 'processos' | 'manuais' | 'documentos' | 'usuarios';

/**
 * Unidade organizacional em ABA PRÓPRIA (sem o menu lateral): dados da unidade,
 * titular e preposto, e um card com abas contadas — Processos, Manuais,
 * Documentos e Usuários.
 *
 * Impressão: o CSS `print:` abre TODAS as abas de uma vez (o dono precisa do
 * documento completo no papel, não só da aba que estava aberta na tela).
 */
export function UnidadePage() {
  const [params] = useSearchParams();
  const id = params.get('id');
  const { data, isLoading, isError } = useOrgUnit(id);
  const [aba, setAba] = useState<AbaKey>('processos');

  useDocumentTitle(data ? `${data.sigla ?? data.name} · Unidade` : 'Unidade');

  if (!id) return <Aviso texto="Informe a unidade (?id=...)." />;
  if (isLoading) return <Aviso texto="Carregando..." />;
  if (isError || !data) return <Aviso texto="Unidade não encontrada." />;

  // `curto` é o rótulo do mobile: com 4 abas + contador, "Documentos" não cabe
  // em 375px e a última aba ficaria fora da tela.
  const abas: Array<{ key: AbaKey; label: string; curto: string; icon: typeof Workflow; count: number }> = [
    { key: 'processos', label: 'Processos', curto: 'Processos', icon: Workflow, count: data.abas.processos.length },
    { key: 'manuais', label: 'Manuais', curto: 'Manuais', icon: FileText, count: data.abas.manuais.length },
    { key: 'documentos', label: 'Documentos', curto: 'Docs', icon: FileStack, count: data.abas.documentos.length },
    { key: 'usuarios', label: 'Usuários', curto: 'Usuários', icon: Users, count: data.abas.usuarios.length },
  ];

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-slate-200 bg-white p-4 sm:p-6">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              {data.parent ? `${data.parent.sigla ?? data.parent.name} ›` : 'Unidade organizacional'}
            </p>
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-slate-900">
              {data.sigla ?? data.name}
              {!data.active && (
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">inativa</span>
              )}
            </h1>
            {data.sigla && <p className="text-sm text-slate-600">{data.name}</p>}
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-md border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 print:hidden"
          >
            <Printer size={16} /> Imprimir
          </button>
        </header>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-md border border-slate-200 bg-white p-4 sm:p-5" data-testid="dados-unidade">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Dados da unidade</h2>
            <dl className="space-y-3">
              <Dado label="Objetivo" valor={data.objetivo} />
              <Dado label="Localização" valor={data.localizacao} icon={MapPin} />
              <Dado label="Unidade orçamentária" valor={data.unidadeOrcamentaria} icon={Building2} />
              <Dado label="Telefone" valor={data.telefone} icon={Phone} />
              <Dado label="E-mail" valor={data.email} icon={Mail} />
            </dl>
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-4 sm:p-5" data-testid="pessoas-unidade">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Titular e preposto</h2>
            <div className="space-y-3">
              <Pessoa papel="Titular" pessoa={data.titular} />
              <Pessoa papel="Preposto" pessoa={data.preposto} />
            </div>
          </section>
        </div>

        <section className="rounded-md border border-slate-200 bg-white" data-testid="abas-unidade">
          <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 px-2 print:hidden" role="tablist">
            {abas.map((a) => {
              const Icon = a.icon;
              const ativa = aba === a.key;
              return (
                <button
                  key={a.key}
                  type="button"
                  role="tab"
                  aria-selected={ativa}
                  onClick={() => setAba(a.key)}
                  className={`flex shrink-0 items-center gap-1 border-b-2 px-2 py-2.5 text-xs font-medium transition-colors sm:gap-1.5 sm:px-3 sm:text-sm ${
                    ativa ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon size={15} className="hidden sm:block" />
                  <span className="sm:hidden">{a.curto}</span>
                  <span className="hidden sm:inline">{a.label}</span>
                  <span
                    data-testid={`contador-${a.key}`}
                    className={`rounded-full px-1.5 text-[11px] ${ativa ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}
                  >
                    {a.count}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Na tela, só a aba ativa. Na impressão, todas (print:block). */}
          {abas.map((a) => (
            <div
              key={a.key}
              data-testid={`painel-${a.key}`}
              className={`${aba === a.key ? 'block' : 'hidden'} p-4 sm:p-5 print:block`}
            >
              <h3 className="mb-3 hidden text-sm font-semibold text-slate-900 print:block">
                {a.label} ({a.count})
              </h3>
              {a.key === 'processos' && <Processos itens={data.abas.processos} />}
              {a.key === 'usuarios' && <Usuarios itens={data.abas.usuarios} />}
              {a.key === 'manuais' && <Vazio texto="Nenhum manual publicado nesta unidade." />}
              {a.key === 'documentos' && <Vazio texto="Nenhum documento emitido por esta unidade." />}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function Processos({ itens }: { itens: { id: string; key: string; name: string; status: string; version: number }[] }) {
  if (itens.length === 0) return <Vazio texto="Nenhum processo desta unidade." />;
  return (
    <ul className="divide-y divide-slate-100">
      {itens.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center gap-2 py-2.5">
          <button
            type="button"
            onClick={() => openTab(`processos/editar?key=${p.key}`)}
            className="text-sm font-medium text-slate-800 hover:underline print:no-underline"
          >
            {p.name}
          </button>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
            {p.status === 'published' ? `publicado · v${p.version}` : p.status}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Usuarios({ itens }: { itens: { id: string; name: string; email: string; photoUrl: string | null; position: string }[] }) {
  if (itens.length === 0) return <Vazio texto="Nenhum usuário lotado nesta unidade." />;
  return (
    <ul className="divide-y divide-slate-100">
      {itens.map((u) => (
        <li key={`${u.id}-${u.position}`} className="flex items-center gap-3 py-2.5">
          <Avatar url={u.photoUrl} nome={u.name} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-slate-800">{u.name}</span>
            <span className="block truncate text-xs text-slate-500">{u.email}</span>
          </span>
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{u.position}</span>
        </li>
      ))}
    </ul>
  );
}

function Pessoa({ papel, pessoa }: { papel: string; pessoa: OrgPerson | null }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-slate-100 p-3">
      <Avatar url={pessoa?.photoUrl ?? null} nome={pessoa?.name ?? papel} size={44} />
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-slate-400">{papel}</p>
        {pessoa ? (
          <>
            <p className="truncate text-sm font-medium text-slate-800">{pessoa.name}</p>
            <p className="truncate text-xs text-slate-500">
              {pessoa.email}
              {pessoa.telefone ? ` · ${pessoa.telefone}` : ''}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-400">Não definido</p>
        )}
      </div>
    </div>
  );
}

function Dado({ label, valor, icon: Icon }: { label: string; valor: string | null; icon?: typeof MapPin }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="flex items-start gap-1.5 text-sm text-slate-800">
        {Icon && valor && <Icon size={14} className="mt-0.5 shrink-0 text-slate-400" />}
        {valor || <span className="text-slate-400">—</span>}
      </dd>
    </div>
  );
}

function Avatar({ url, nome, size = 32 }: { url: string | null; nome: string; size?: number }) {
  const style = { width: size, height: size };
  if (url) return <img src={url} alt={nome} style={style} className="shrink-0 rounded-full object-cover" data-testid="avatar" />;
  return (
    <span
      style={style}
      data-testid="avatar"
      className="flex shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500"
    >
      {nome.slice(0, 2).toUpperCase()}
    </span>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <p className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">{texto}</p>;
}

function Aviso({ texto }: { texto: string }) {
  return <div className="p-6 text-sm text-slate-500">{texto}</div>;
}
