import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, FileSignature, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react';
import {
  abrirBlobEmNovaAba, avisarAssinatura, estaAssinado, fetchSignaturesPreview, fetchTaskSignatures,
  signDocument, signWithCertificate, urlExibivel, type SignatureDoc, type TaskSignatures,
} from '@/lib/upload';
import { ApiError } from '@/lib/api';
import { useDocumentTitle } from '@/lib/use-document-title';

/** Tipos de assinatura oferecidos. O A1 chega na etapa 7b — o espaço já fica visível. */
type Tipo = 'simple' | 'a1';

/**
 * Página de assinatura de um documento (Fase 7a), aberta em ABA PRÓPRIA a partir do
 * ícone ao lado do anexo.
 *
 * Estrutura exigida pela spec: o documento num iframe e, ABAIXO dele, um card para
 * escolher o tipo de assinatura — com a "pré-definida" já marcada a cada carregamento.
 */
export function AssinaturaPage() {
  const [params] = useSearchParams();
  const taskId = params.get('task');
  const fieldKey = params.get('field');

  const [dados, setDados] = useState<TaskSignatures | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [assinando, setAssinando] = useState(false);

  // "deve ser o método padrão de assinatura sempre que a página for carregada":
  // o estado nasce em 'simple' a cada montagem, sem lembrar escolha anterior.
  const [tipo, setTipo] = useState<Tipo>('simple');
  // O .pfx e a senha vivem só neste estado, durante o envio. Nada de persistir.
  const [pfx, setPfx] = useState<File | null>(null);
  const [senha, setSenha] = useState('');

  useDocumentTitle('Assinar documento');

  const doc: SignatureDoc | undefined = useMemo(
    () => dados?.documentos.find((d) => d.fieldKey === fieldKey),
    [dados, fieldKey],
  );
  const assinado = estaAssinado(doc);

  async function carregar() {
    if (!taskId) return;
    try {
      setDados(await fetchTaskSignatures(taskId));
      setErro(null);
    } catch {
      setErro('Não foi possível carregar o documento.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { void carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [taskId]);

  // O arquivo do storage exige autenticação: baixa com o cliente e mostra como blob.
  const [href, setHref] = useState<string | null>(null);
  const fileUrl = doc?.fileUrl ?? null;
  useEffect(() => {
    if (!fileUrl) return;
    let revoke = () => {};
    let vivo = true;
    urlExibivel(fileUrl)
      .then((r) => { if (vivo) { setHref(r.href); revoke = r.revoke; } else r.revoke(); })
      .catch(() => { if (vivo) setErro('Não foi possível abrir o documento.'); });
    return () => { vivo = false; revoke(); };
  }, [fileUrl]);

  async function verAssinaturas() {
    if (!taskId || !fieldKey) return;
    try { abrirBlobEmNovaAba(await fetchSignaturesPreview(taskId, fieldKey)); }
    catch { setErro('Não foi possível gerar a visualização das assinaturas.'); }
  }

  async function assinar() {
    if (!taskId || !fieldKey) return;
    setAssinando(true); setErro(null);
    try {
      if (tipo === 'a1') {
        if (!pfx) { setErro('Escolha o arquivo do certificado (.pfx).'); return; }
        await signWithCertificate(taskId, fieldKey, pfx, senha);
        // Some com o arquivo e a senha assim que o envio termina.
        setPfx(null); setSenha('');
      } else {
        await signDocument(taskId, fieldKey);
      }
      await carregar();
      avisarAssinatura(taskId);   // a aba da tarefa repinta o ícone na hora
    } catch (e) {
      const body = e instanceof ApiError ? (e.body as { detail?: string } | undefined) : undefined;
      setErro(body?.detail ?? 'Não foi possível assinar o documento.');
    } finally {
      setAssinando(false);
    }
  }

  if (!taskId || !fieldKey) return <Aviso texto="Informe a tarefa e o campo (?task=…&field=…)." />;
  if (carregando) return <Aviso texto="Carregando documento…" />;
  if (!doc?.fileUrl) return <Aviso texto="Não há documento anexado neste campo." />;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-4 p-4" data-testid="pagina-assinatura">
      <header className="flex min-w-0 items-center gap-2">
        <FileSignature size={20} className="shrink-0 text-slate-500" />
        <h1 className="min-w-0 truncate text-lg font-semibold text-slate-800" data-testid="assinatura-titulo">
          {doc.fileName ?? 'Documento'}
        </h1>
      </header>

      {/* O documento em si. `min-h` para o iframe não colapsar no mobile. */}
      <iframe
        src={href ?? undefined}
        title={doc.fileName ?? 'Documento'}
        data-testid="assinatura-iframe"
        className="min-h-[45vh] w-full flex-1 rounded-lg border border-slate-200 bg-slate-50"
      />

      {/* Nem todo navegador exibe PDF embutido — sobretudo no celular. Assinar sem
          conseguir ler o documento é o pior desfecho possível desta tela, então a
          saída fica sempre à mão. */}
      {href && (
        <a
          href={href} target="_blank" rel="noreferrer" data-testid="assinatura-abrir"
          className="-mt-2 self-start text-xs text-slate-500 underline hover:text-slate-700"
        >
          Não está vendo o documento? Abrir em outra aba
        </a>
      )}

      {/* Card de escolha do tipo — ABAIXO do iframe, como a spec pede. */}
      <section className="rounded-lg border border-slate-200 bg-white p-4" data-testid="assinatura-card">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Tipo de assinatura</h2>

        <div className="flex flex-col gap-2">
          <label className="flex items-start gap-2 rounded-md border border-slate-200 p-3 text-sm has-[:checked]:border-slate-800 has-[:checked]:bg-slate-50">
            <input
              type="radio" name="tipo-assinatura" className="mt-0.5" checked={tipo === 'simple'}
              onChange={() => setTipo('simple')} disabled={assinado} data-testid="assinatura-tipo-simples"
            />
            <span className="min-w-0">
              <span className="block font-medium text-slate-800">Assinatura pré-definida (digital)</span>
              <span className="block text-xs text-slate-500">
                Assinatura eletrônica simples, nos termos da Lei nº 14.063/2020. Seu nome, CPF,
                data e hora ficam registrados junto ao documento.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2 rounded-md border border-slate-200 p-3 text-sm has-[:checked]:border-slate-800 has-[:checked]:bg-slate-50">
            <input
              type="radio" name="tipo-assinatura" className="mt-0.5" disabled={assinado}
              checked={tipo === 'a1'} onChange={() => setTipo('a1')} data-testid="assinatura-tipo-a1"
            />
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-slate-800">Certificado ICP-Brasil (A1)</span>
              <span className="block text-xs text-slate-500">
                Comprova sua identidade pelo certificado. O CPF do certificado precisa ser o
                mesmo do seu cadastro.
              </span>

              {tipo === 'a1' && !assinado && (
                <span className="mt-3 flex flex-col gap-2">
                  <input
                    type="file" accept=".pfx,.p12" data-testid="assinatura-pfx"
                    onChange={(e) => setPfx(e.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-slate-600 file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-slate-200"
                  />
                  <input
                    type="password" placeholder="Senha do certificado" value={senha}
                    autoComplete="off" data-testid="assinatura-senha"
                    onChange={(e) => setSenha(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                  />
                  <span className="text-[11px] text-slate-400">
                    O arquivo e a senha são usados apenas para esta assinatura e não ficam guardados.
                  </span>
                </span>
              )}
            </span>
          </label>
        </div>

        {/* Como a assinatura vai aparecer: a cursiva é gerada pelo servidor. */}
        {!assinado && (
          <p className="mt-3 text-xs text-slate-500">
            Ao assinar, fica registrado o <strong>SHA-256</strong> do arquivo. Se o documento
            for substituído depois, a assinatura deixa de valer para ele.
          </p>
        )}

        {erro && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-rose-600" data-testid="assinatura-erro">
            <TriangleAlert size={14} /> {erro}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {assinado ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700"
                  data-testid="assinatura-concluida">
              <CheckCircle2 size={16} /> Documento assinado
            </span>
          ) : (
            <button
              type="button" onClick={assinar} disabled={assinando} data-testid="assinatura-assinar"
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {assinando ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              {assinando ? 'Assinando…' : 'Assinar documento'}
            </button>
          )}

          {(doc.assinaturas.length > 0) && (
            <button
              type="button" onClick={verAssinaturas} data-testid="assinatura-ver"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Visualizar assinaturas
            </button>
          )}
        </div>
      </section>

      {doc.assinaturas.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-4" data-testid="assinatura-lista">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Assinaturas registradas</h2>
          <ul className="flex flex-col gap-2">
            {doc.assinaturas.map((a) => (
              <li key={a.id} className="flex min-w-0 flex-col gap-0.5 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                <span className="text-sm font-medium text-slate-800">
                  {a.signerName}{a.signerCpf ? ` — CPF ${a.signerCpf}` : ''}
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(a.signedAt).toLocaleString('pt-BR')} ·{' '}
                  {a.type === 'a1' ? 'certificado ICP-Brasil A1' : 'assinatura eletrônica simples'}
                </span>
                {a.type === 'a1' && a.certSubject && (
                  <span className="text-xs text-slate-500" data-testid="assinatura-cert">
                    Titular: {a.certSubject}
                    {a.certIssuer ? ` · Emissor: ${a.certIssuer}` : ''}
                  </span>
                )}
                {a.state !== 'valid' && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600" data-testid="assinatura-invalida">
                    <TriangleAlert size={12} />
                    {a.state === 'file_missing'
                      ? 'O arquivo não está mais disponível.'
                      : 'O arquivo foi alterado depois desta assinatura.'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Aviso({ texto }: { texto: string }) {
  return <div className="p-6 text-sm text-slate-500" data-testid="assinatura-aviso">{texto}</div>;
}
