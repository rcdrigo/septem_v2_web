import { useState } from 'react';
import { CheckCircle2, FileSearch, Loader2, TriangleAlert } from 'lucide-react';
import { TurnstileWidget } from '@/components/public/TurnstileWidget';
import { validarDocumento, type DocumentoValidado } from '@/lib/api/catalog';
import { ApiError } from '@/lib/api';
import { useSessionStore } from '@/stores/session';

const SITUACOES: Record<string, string> = {
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

export function DocumentValidationForm({ initialNumber = '', initialCode = '', embedded = false }: { initialNumber?: string; initialCode?: string; embedded?: boolean }) {
  const tenant = useSessionStore((s) => s.tenant);
  const [numero, setNumero] = useState(initialNumber);
  const [codigo, setCodigo] = useState(initialCode);
  const [token, setToken] = useState<string | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [achado, setAchado] = useState<DocumentoValidado | null>(null);


  async function consultar() {
    setConsultando(true); setErro(null); setAchado(null);
    try {
      setAchado(await validarDocumento(Number(numero), codigo.trim(), token));
    } catch (e) {
      const corpo = e instanceof ApiError ? (e.body as { detail?: string } | undefined) : undefined;
      setErro(corpo?.detail ?? 'Documento não encontrado. Confira o número do processo e o código.');
    } finally {
      setConsultando(false);
    }
  }

  return (
    <>
        <form onSubmit={(event) => { event.preventDefault(); if (!consultando && token && numero && codigo.trim()) void consultar(); }} className={embedded ? '' : 'rounded-xl border border-slate-200 bg-white p-5 sm:p-6'}>
          <div className={embedded ? 'grid gap-4' : 'grid gap-3 sm:grid-cols-2'}>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Número do processo</span>
              <input value={numero} onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))}
                     autoFocus={embedded} inputMode="numeric" data-testid="validacao-numero" autoComplete="off"
                     className="rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-800" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Código verificador</span>
              <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                     data-testid="validacao-codigo" autoComplete="off" maxLength={16}
                     className="rounded-md border border-slate-300 px-3 py-2.5 text-sm uppercase tracking-widest outline-none focus:border-slate-800" />
            </label>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {tenant?.turnstileSiteKey
              ? <TurnstileWidget siteKey={tenant.turnstileSiteKey} onToken={setToken} />
              : <p className="text-sm text-amber-700" data-testid="validacao-sem-captcha">
                  A validação está indisponível no momento.
                </p>}

            {erro && (
              <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                 role="alert" data-testid="validacao-erro">
                <TriangleAlert size={15} className="mt-0.5 shrink-0" /> {erro}
              </p>
            )}

            <button type="submit" data-testid="validacao-consultar"
                    disabled={consultando || !token || !numero || !codigo.trim()}
                    className={embedded
                      ? 'flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60'
                      : 'inline-flex items-center justify-center gap-2 self-start rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50'}>
              {consultando ? <Loader2 size={16} className="animate-spin" /> : <FileSearch size={16} />}
              {consultando ? 'Validando…' : 'Validar documento'}
            </button>
          </div>
        </form>

        {achado && (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-white p-5" role="status" data-testid="validacao-resultado">
            <p className="mb-3 flex items-center gap-2 font-medium text-emerald-700">
              <CheckCircle2 size={18} /> Documento autêntico
            </p>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Linha rotulo="Serviço" valor={achado.servico ?? '—'} />
              <Linha rotulo="Processo" valor={String(achado.numero)} />
              <Linha rotulo="Situação do processo" valor={SITUACOES[achado.situacao] ?? achado.situacao} />
              <Linha rotulo="Emitido em" valor={new Date(achado.emitidoEm).toLocaleDateString('pt-BR')} />
            </dl>

            {/* "O resultado deve ser aberto em uma nova aba" — requisito literal. */}
            <a href={achado.arquivo.url} target="_blank" rel="noreferrer" data-testid="validacao-abrir"
               className="mt-4 inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700">
              Abrir documento
            </a>

            {/* O código vale pela VAGA: o arquivo mostrado é sempre o vigente. Dizer isto
                evita que alguém conclua que o papel na mão é o que está sendo exibido. */}
            <p className="mt-3 text-xs text-slate-500">
              Esta consulta mostra sempre a <strong>versão mais recente</strong> do documento.
              Se ele foi reemitido, o arquivo acima pode ser diferente do que você tem em mãos.
            </p>
          </div>
        )}
    </>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-slate-500">{rotulo}</dt>
      <dd className="truncate font-medium text-slate-800">{valor}</dd>
    </div>
  );
}
