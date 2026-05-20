import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Checkbox, Field, TextInput } from '@/components/ui/Field';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { IconButton } from '@/components/ui/IconButton';
import { slugify } from '@/lib/slugify';
import { uid } from '@/lib/uid';
import {
  getActionButtons,
  setActionButtons,
  type ActionButton,
} from '@/lib/bpmn-action-buttons';

type Props = {
  modeler: any;
  element: any;
  /** Label do primeiro botão criado por padrão (ex: "Concluir" ou "Enviar requisição"). */
  defaultLabel: string;
};

/**
 * Editor de botões de ação por tarefa. Espelha o bloco do `ConfigTaskGeneral.aspx`
 * que define `inpStShowPositiveButton`, `inpStShowNegativeButton` etc. — mas
 * aqui é uma lista arbitrária, com cor primária, cor do texto e checkbox de validação.
 *
 * Persistência: `septem:ActionButtons > septem:ActionButton[]` na própria tarefa.
 */
export function ActionButtonsEditor({ modeler, element, defaultLabel }: Props) {
  const [buttons, setButtons] = useState<ActionButton[]>([]);

  useEffect(() => {
    const stored = getActionButtons(element);
    if (stored.length > 0) {
      setButtons(stored);
    } else {
      // Cria o botão default in-memory; só persiste quando o usuário tocar.
      setButtons([makeDefaultButton(defaultLabel)]);
    }
  }, [element, defaultLabel]);

  function persist(next: ActionButton[]) {
    setButtons(next);
    setActionButtons(modeler, element, next);
  }

  function update(idx: number, patch: Partial<ActionButton>) {
    persist(buttons.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  }

  function removeAt(idx: number) {
    if (buttons.length <= 1) return;
    persist(buttons.filter((_, i) => i !== idx));
  }

  function addNew() {
    persist([...buttons, makeDefaultButton('Novo botão')]);
  }

  return (
    <div className="flex flex-col gap-3">
      {buttons.map((btn, idx) => (
        <ActionButtonRow
          key={btn.id || idx}
          button={btn}
          canRemove={buttons.length > 1}
          onChange={(patch) => update(idx, patch)}
          onRemove={() => removeAt(idx)}
        />
      ))}
      <IconButton onClick={addNew} className="self-start">
        <Plus size={14} /> Adicionar botão
      </IconButton>
    </div>
  );
}

function ActionButtonRow({
  button,
  canRemove,
  onChange,
  onRemove,
}: {
  button: ActionButton;
  canRemove: boolean;
  onChange: (patch: Partial<ActionButton>) => void;
  onRemove: () => void;
}) {
  const [draftLabel, setDraftLabel] = useState(button.label);
  const [draftId, setDraftId] = useState(button.id);

  useEffect(() => {
    setDraftLabel(button.label);
    setDraftId(button.id);
  }, [button.label, button.id]);

  function commitLabel() {
    const trimmed = draftLabel.trim();
    if (trimmed === button.label) return;
    // se id está vazio ou era derivado do label antigo, atualiza
    const previousAuto = slugify(button.label);
    const idShouldFollow = !button.id || button.id === previousAuto;
    const nextId = idShouldFollow ? slugify(trimmed) : button.id;
    onChange({ label: trimmed, id: nextId });
  }

  function commitId() {
    const slugged = slugify(draftId);
    if (slugged !== button.id) onChange({ id: slugged });
    setDraftId(slugged);
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <header
        className="-mx-3 -mt-3 mb-3 flex items-center justify-between rounded-t-md px-3 py-2 text-sm font-medium"
        style={{ backgroundColor: button.primaryColor, color: button.textColor }}
      >
        <span className="truncate">{button.label || 'Sem nome'}</span>
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label="Remover botão"
          className="rounded p-1 hover:bg-black/10 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ color: button.textColor }}
        >
          <Trash2 size={14} />
        </button>
      </header>

      <div className="flex flex-col gap-3">
        <Field label="Nome">
          <TextInput
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            onBlur={commitLabel}
            placeholder="ex: Aprovar"
          />
        </Field>
        <Field label="Id" hint="Auto-gerado a partir do nome; pode ser editado.">
          <TextInput
            value={draftId}
            onChange={(e) => setDraftId(e.target.value)}
            onBlur={commitId}
            placeholder="ex: aprovar"
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Cor primária">
            <ColorPicker
              value={button.primaryColor}
              onChange={(v) => onChange({ primaryColor: v })}
              ariaLabel="Cor primária"
            />
          </Field>
          <Field label="Cor do texto">
            <ColorPicker
              value={button.textColor}
              onChange={(v) => onChange({ textColor: v })}
              ariaLabel="Cor do texto"
            />
          </Field>
        </div>

        <Checkbox
          checked={button.validateForm}
          onChange={(v) => onChange({ validateForm: v })}
          label="Validar campos do formulário antes de submeter"
        />
      </div>
    </div>
  );
}

function makeDefaultButton(label: string): ActionButton {
  return {
    id: slugify(label) || uid('btn'),
    label,
    primaryColor: '#1e293b',
    textColor: '#ffffff',
    validateForm: true,
  };
}
