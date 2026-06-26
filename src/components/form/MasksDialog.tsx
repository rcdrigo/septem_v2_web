import { useState } from 'react';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import { useFormMasks, useCreateFormMask, useUpdateFormMask, useDeleteFormMask, type FormMask } from '@/lib/api/forms';
import { Dialog } from '@/components/ui/Dialog';
import { Field, TextInput, Checkbox } from '@/components/ui/Field';
import { toast } from '@/stores/toast';
import { slugify } from '@/lib/slugify';
import { regexToTemplate, applyMask } from '@/lib/mask';

/** Gestão de máscaras de campo (Forms F2) com campo de teste ao vivo do regex. */
export function MasksDialog({ onClose }: { onClose: () => void }) {
  const masks = useFormMasks();
  const del = useDeleteFormMask();
  const [editing, setEditing] = useState<FormMask | 'new' | null>('new');

  return (
    <Dialog open onClose={onClose} width="lg" title="Máscaras de campo" footer={<button onClick={onClose} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm">Fechar</button>}>
      <div className="mb-4 overflow-hidden rounded-md border border-slate-200">
        {masks.data?.length === 0 && <p className="px-3 py-3 text-sm text-slate-400">Nenhuma máscara cadastrada.</p>}
        {masks.data?.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0">
            <span className="min-w-0">
              <span className="font-medium text-slate-800">{m.name}</span>
              <code className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">{m.regex}</code>
              {m.shouldValidate && <span className="ml-1 rounded-full bg-amber-100 px-1.5 text-[10px] text-amber-700">obrigatória</span>}
            </span>
            <span className="flex shrink-0 gap-1">
              <button type="button" onClick={() => setEditing(m)} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-800"><Pencil size={14} /></button>
              <button type="button" onClick={() => del.mutate(m.id)} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={14} /></button>
            </span>
          </div>
        ))}
      </div>

      {editing && <MaskForm key={editing === 'new' ? 'new' : editing.id} mask={editing === 'new' ? null : editing} onDone={() => setEditing('new')} />}
    </Dialog>
  );
}

function MaskForm({ mask, onDone }: { mask: FormMask | null; onDone: () => void }) {
  const create = useCreateFormMask();
  const update = useUpdateFormMask();
  const [name, setName] = useState(mask?.name ?? '');
  const [regex, setRegex] = useState(mask?.regex ?? '');
  const [templateInput, setTemplateInput] = useState(mask?.template ?? '');
  const [shouldValidate, setShouldValidate] = useState(mask?.shouldValidate ?? false);
  const [test, setTest] = useState('');

  // Formato explícito tem prioridade; senão deriva do regex (compat).
  const template = templateInput.trim() || regexToTemplate(regex);
  const result = testRegex(regex, test);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const tpl = templateInput.trim() || undefined;
    try {
      if (mask) await update.mutateAsync({ id: mask.id, body: { name, regex, template: tpl, shouldValidate } });
      else await create.mutateAsync({ key: slugify(name), name, regex, template: tpl, shouldValidate });
      toast.success(mask ? 'Máscara atualizada.' : 'Máscara criada.');
      setName(''); setRegex(''); setTemplateInput(''); setShouldValidate(false); setTest('');
      onDone();
    } catch { toast.error('Não foi possível salvar a máscara.'); }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{mask ? 'Editar máscara' : 'Nova máscara'}</p>
      <Field label="Nome"><TextInput required value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Formato" hint="# dígito · A letra · * alfanumérico. Ex.: (##) #####-#### ou ###.###.###-##">
        <TextInput value={templateInput} onChange={(e) => setTemplateInput(e.target.value)} className="font-mono text-xs" placeholder="(##) #####-####" />
      </Field>
      <Field label="Regex (validação, opcional)" hint="Usado só para validar; o formato acima é quem formata."><TextInput value={regex} onChange={(e) => setRegex(e.target.value)} className="font-mono text-xs" placeholder="\d{3}\.\d{3}\.\d{3}-\d{2}" /></Field>
      <Field label="Testar máscara" hint={template ? 'A formatação é aplicada ao digitar.' : 'Defina um Formato para ver a formatação.'}>
        <div className="flex items-center gap-2">
          <TextInput
            value={test}
            onChange={(e) => setTest(template ? applyMask(template, e.target.value) : e.target.value)}
            placeholder={template ?? 'ex: 123.456.789-00'}
          />
          <span className="w-28 shrink-0 text-xs font-medium">
            {!regex || !test ? <span className="text-slate-400">—</span>
              : result === 'invalid' ? <span className="text-rose-600">regex inválida</span>
              : result ? <span className="inline-flex items-center gap-1 text-emerald-600"><Check size={13} /> casa</span>
              : <span className="inline-flex items-center gap-1 text-rose-600"><X size={13} /> não casa</span>}
          </span>
        </div>
      </Field>
      <Checkbox checked={shouldValidate} onChange={setShouldValidate} label="Obrigatória (bloqueia concluir a tarefa se não casar)" />
      <button type="submit" disabled={!name || (!regex && !templateInput.trim())} className="self-start rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">{mask ? 'Salvar' : 'Adicionar'}</button>
    </form>
  );
}

function testRegex(regex: string, value: string): boolean | 'invalid' {
  if (!regex || !value) return false;
  try { return new RegExp(regex).test(value); } catch { return 'invalid'; }
}
