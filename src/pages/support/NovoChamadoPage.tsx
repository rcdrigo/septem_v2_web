import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Paperclip, X, AlertTriangle, Loader2 } from 'lucide-react';
import {
  useAbrirChamado, subirArquivoDeSuporte, NATUREZAS,
  type SupportScope,
} from '@/lib/api/support';
import { Field, TextInput, TextArea, RadioGroup } from '@/components/ui/Field';
import { routes } from '@/lib/routes';
import { toast } from '@/stores/toast';
import { useSessionStore } from '@/stores/session';
import { useLimites } from '@/components/support/LimitesDoSuporte';

/** Estado de um arquivo escolhido: subindo, pronto ou falhou — por arquivo, não por lote. */
type Escolhido = {
  nome: string;
  tamanho: number;
  estado: 'subindo' | 'pronto' | 'falhou';
  id?: string;
  erro?: string;
};

/**
 * Abrir chamado (Fase 4 — SUP-01).
 *
 * <p>
 * Três cuidados que a spec cobra e que são a diferença entre um formulário e um formulário que
 * não faz a pessoa perder trabalho:
 * </p>
 * <ul>
 *   <li>o limite de tamanho aparece ANTES de escolher o arquivo, não como erro depois;</li>
 *   <li>progresso e falha são <b>por arquivo</b> — um anexo recusado não derruba os outros nem
 *       apaga o que já foi escrito;</li>
 *   <li>envio duplo é bloqueado: dois cliques não podem virar dois chamados.</li>
 * </ul>
 */
export function NovoChamadoPage({ escopo = 'cliente' }: { escopo?: SupportScope }) {
  const limites = useLimites();
  const navigate = useNavigate();
  const abrir = useAbrirChamado(escopo);

  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [nature, setNature] = useState('');
  const [impact, setImpact] = useState('');
  const [arquivos, setArquivos] = useState<Escolhido[]>([]);

  // Trava de envio em REF, não em estado. `abrir.isPending` só fica verdadeiro depois de um
  // re-render: dois cliques no MESMO instante (duplo clique rápido, Enter repetido) rodam os dois
  // handlers antes disso e abrem dois chamados com protocolos diferentes. A ref muda na hora.
  const enviando = useRef(false);

  // O teto vem da configuração pública do tenant — o MESMO número que o backend aplica.
  const maxBytes = useSessionStore((s) => s.tenant?.arquivos?.maxBytes ?? 25_000_000);
  const maxPorEnvio = useSessionStore((s) => s.tenant?.arquivos?.maxPorEnvio ?? 10);
  const maxMb = Math.floor(maxBytes / 1_000_000);

  const subindo = arquivos.some((a) => a.estado === 'subindo');
  const podeEnviar = subject.trim().length > 0 && description.trim().length > 0 && nature.length > 0
    && !subindo && !abrir.isPending;

  async function escolher(lista: FileList | null) {
    if (!lista) return;
    for (const file of Array.from(lista)) {
      const marca = `${file.name}:${file.size}:${Date.now()}`;
      setArquivos((a) => [...a, { nome: file.name, tamanho: file.size, estado: 'subindo' }]);
      try {
        const salvo = await subirArquivoDeSuporte(escopo, file);
        setArquivos((a) => a.map((x) => x.nome === file.name && x.estado === 'subindo'
          ? { ...x, estado: 'pronto', id: salvo.id } : x));
      } catch (err) {
        const erro = err instanceof Error ? err.message : 'falhou';
        setArquivos((a) => a.map((x) => x.nome === file.name && x.estado === 'subindo'
          ? { ...x, estado: 'falhou', erro } : x));
      }
      void marca;
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!podeEnviar || enviando.current) return;
    enviando.current = true;
    try {
      const chamado = await abrir.mutateAsync({
        subject: subject.trim(),
        description: description.trim(),
        nature,
        impact: impact.trim() || undefined,
        fileIds: arquivos.filter((a) => a.id).map((a) => a.id!),
      });
      toast.success(`Chamado ${chamado.protocol} aberto.`);
      navigate(routes.supportTicket(chamado.id));
    } catch {
      // O texto FICA na tela: a pessoa não escreve tudo de novo por causa de uma falha de rede.
      toast.error('Não foi possível abrir o chamado. O que você escreveu continua aqui.');
      // Liberou de novo SÓ no erro: no sucesso a tela navega, e reabrir a trava permitiria um
      // segundo envio no intervalo até a navegação.
      enviando.current = false;
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <button
          type="button" onClick={() => navigate(routes.support)}
          className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50"
          aria-label="Voltar para meus chamados"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Abrir chamado</h1>
          <p className="text-sm text-slate-500">Conte o que aconteceu. Quanto mais concreto, mais rápido o atendimento.</p>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <form onSubmit={enviar} className="mx-auto flex max-w-2xl flex-col gap-4" data-testid="form-chamado">
          <Field label="Assunto" help="Uma frase que resume o problema.">
            <TextInput name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={limites.subject} required autoFocus />
          </Field>

          <Field label="Natureza" help="Do que se trata — é isso que decide para quem o chamado vai.">
            <RadioGroup
              value={nature}
              onChange={setNature}
              name="nature"
              options={NATUREZAS.map((n) => ({ value: n.value, label: n.label, hint: n.help }))}
            />
          </Field>

          <Field label="Descrição" help="O que você fez, o que esperava e o que aconteceu.">
            <TextArea name="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={7} maxLength={limites.body} required />
          </Field>

          <Field label="Impacto (opcional)" help="Quem ou o que está parado por causa disso.">
            <TextArea name="impact" value={impact} onChange={(e) => setImpact(e.target.value)} rows={3} maxLength={limites.impact} />
          </Field>

          <div>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-slate-700">Anexos (opcional)</span>
              {/* O limite antes da escolha, não como erro depois. */}
              <span className="text-xs text-slate-500" data-testid="limite-upload">
                Até {maxMb} MB por arquivo, {maxPorEnvio} arquivos
              </span>
            </div>
            <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
              <Paperclip size={14} /> Escolher arquivos
              <input type="file" multiple className="hidden" data-testid="input-anexo" onChange={(e) => void escolher(e.target.files)} />
            </label>

            <ul className="mt-2 space-y-1">
              {arquivos.map((a, i) => (
                <li key={`${a.nome}-${i}`} className="flex min-w-0 items-center gap-2 text-sm" data-testid="anexo-escolhido">
                  {a.estado === 'subindo' && <Loader2 size={14} className="shrink-0 animate-spin text-slate-400" />}
                  {a.estado === 'falhou' && <AlertTriangle size={14} className="shrink-0 text-amber-600" />}
                  <span className={`min-w-0 flex-1 truncate ${a.estado === 'falhou' ? 'text-amber-800' : 'text-slate-700'}`}>
                    {a.nome}
                  </span>
                  {a.estado === 'falhou' && (
                    <span className="shrink-0 text-xs text-amber-700" data-testid="anexo-falhou">{a.erro}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setArquivos((lista) => lista.filter((_, idx) => idx !== i))}
                    className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100"
                    aria-label={`Remover ${a.nome}`}
                  >
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button" onClick={() => navigate(routes.support)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!podeEnviar}
              data-testid="enviar-chamado"
              className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {abrir.isPending ? 'Enviando…' : subindo ? 'Aguardando anexos…' : 'Abrir chamado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
