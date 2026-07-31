import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Select } from '@/components/ui/Field';
import type { FieldChoice, FieldChoices, ReportColumnMeta } from '@/lib/api/reports';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Campos ambíguos (erro `field_choice_required`): pedem escolha do usuário. */
  choices: FieldChoice[];
  /** Mensagens de recusa (erro `repeated_field_not_reducible` e afins): só explicam. */
  issues: string[];
  columns: ReportColumnMeta[];
  onConfirm: (escolhas: FieldChoices) => void;
  pending?: boolean;
};

/**
 * O que a publicação precisa perguntar ou explicar antes de deixar publicar.
 *
 * Dois casos, um diálogo só porque os dois chegam pelo MESMO erro de publicar e
 * o usuário está no mesmo ponto do fluxo:
 *
 * 1. **Escolha de caminho** — a mesma key existe em duas listas do processo
 *    (`produto` em "Itens" e em "Outros"). A spec §7.4 proíbe o sistema escolher
 *    sozinho: apontar para a lista errada troca os dados do relatório em
 *    silêncio. Aqui o usuário escolhe, e quem reescreve a definição é o backend.
 * 2. **Recusa** — campo de lista usado onde é preciso um valor único por
 *    processo (agrupar, somar, série temporal). Não há o que escolher: a
 *    mensagem diz o que está errado e o usuário volta e ajusta o bloco.
 */
export function PublishIssuesDialog({ open, onClose, choices, issues, columns, onConfirm, pending }: Props) {
  const [escolhas, setEscolhas] = useState<FieldChoices>({});

  // Cada abertura começa limpa e já com a 1ª opção marcada: o <select> nativo
  // mostra a primeira mesmo sem valor, e confirmar sem tocar nele mandaria um
  // objeto vazio — o usuário veria "escolhi" e nada teria sido escolhido.
  useEffect(() => {
    if (!open) return;
    setEscolhas(Object.fromEntries(choices.map((c) => [c.field, c.options[0]])));
  }, [open, choices]);

  const rotulo = (caminho: string) => {
    const col = columns.find((c) => c.key === caminho);
    if (!col) return caminho;
    return col.group ? `${col.group} › ${col.label}` : col.label;
  };

  const precisaEscolher = choices.length > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={precisaEscolher ? 'De qual lista vem cada campo?' : 'Não é possível publicar ainda'}
      width="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            {precisaEscolher ? 'Cancelar' : 'Voltar e ajustar'}
          </button>
          {precisaEscolher && (
            <button
              type="button"
              disabled={pending}
              onClick={() => onConfirm(escolhas)}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Publicar com esta escolha
            </button>
          )}
        </>
      }
    >
      {precisaEscolher ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Este relatório foi criado quando o campo era identificado só pelo nome. Agora existe mais de um
            campo com esse nome no processo — escolha de qual lista cada um deve vir.
          </p>
          {choices.map((c) => (
            <Field key={c.field} label={`Campo "${c.field}"`}>
              <Select
                value={escolhas[c.field] ?? c.options[0]}
                onChange={(e) => setEscolhas((a) => ({ ...a, [c.field]: e.target.value }))}
                options={c.options.map((o) => ({ value: o, label: `${rotulo(o)} — ${o}` }))}
              />
            </Field>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <p className="text-sm text-amber-900">
              Campo que se repete a cada item de uma lista não tem um valor único por processo, então não
              serve para agrupar, somar ou montar série temporal. Exibir em coluna, filtrar e ordenar
              continuam funcionando normalmente.
            </p>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            {issues.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </div>
      )}
    </Dialog>
  );
}
