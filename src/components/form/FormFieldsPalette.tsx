import {
  AlignLeft, Calendar, CheckSquare, ChevronDownSquare, CircleDot, Code2, Hash, Image as ImageIcon,
  ListChecks, Minus, MoveVertical, Tags, Text as TextIcon, Type, Upload,
  Group as GroupIcon, Rows3,
} from 'lucide-react';
import { DND_TYPE } from './FormBuilder';

type Item = { type: string; label: string; icon: typeof Type };

/**
 * Paleta categorizada espelhando o conjunto de elementos do form-js
 * (Entrada / Seleção / Apresentação / Container) — sem os campos do "FormBuilder"
 * comercial (pagamento, cálculo, score…) que não se aplicam aqui.
 */
const CATEGORIES: { title: string; items: Item[] }[] = [
  {
    title: 'Container',
    items: [
      { type: 'group', label: 'Grupo', icon: GroupIcon },
      { type: 'dynamiclist', label: 'Lista dinâmica', icon: Rows3 },
    ],
  },
  {
    title: 'Entrada',
    items: [
      { type: 'textfield', label: 'Texto', icon: Type },
      { type: 'textarea', label: 'Área de texto', icon: AlignLeft },
      { type: 'number', label: 'Número', icon: Hash },
      { type: 'datetime', label: 'Data / Hora', icon: Calendar },
      { type: 'filepicker', label: 'Upload de arquivo', icon: Upload },
    ],
  },
  {
    title: 'Seleção',
    items: [
      { type: 'select', label: 'Lista (dropdown)', icon: ChevronDownSquare },
      { type: 'radio', label: 'Opções (radio)', icon: CircleDot },
      { type: 'checkbox', label: 'Caixa de seleção', icon: CheckSquare },
      { type: 'checklist', label: 'Múltipla escolha', icon: ListChecks },
      { type: 'taglist', label: 'Tags', icon: Tags },
    ],
  },
  {
    title: 'Apresentação',
    items: [
      { type: 'text', label: 'Texto estático', icon: TextIcon },
      { type: 'html', label: 'HTML', icon: Code2 },
      { type: 'image', label: 'Imagem', icon: ImageIcon },
      { type: 'separator', label: 'Separador', icon: Minus },
      { type: 'spacer', label: 'Espaçador', icon: MoveVertical },
    ],
  },
];

/**
 * Paleta de cards (estilo "cockpit"): clicar adiciona o campo ao formulário via
 * a engine do form-js (FormBuilder.addField). Substitui a paleta padrão do form-js.
 */
export function FormFieldsPalette({ onAdd }: { onAdd: (type: string) => void }) {
  return (
    <div className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-slate-50 px-3 py-4">
      <p className="mb-3 px-1 text-xs text-slate-500">Clique ou arraste para o formulário.</p>
      <div className="flex flex-col gap-4">
        {CATEGORIES.map((cat) => (
          <div key={cat.title}>
            <p className="mb-1.5 px-1 text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">{cat.title}</p>
            <div className="flex flex-col gap-2">
              {cat.items.map((it) => (
                <button
                  key={`${cat.title}-${it.type}-${it.label}`}
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DND_TYPE, it.type);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => onAdd(it.type)}
                  className="flex cursor-grab items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5 text-left shadow-sm transition hover:border-slate-300 hover:shadow active:cursor-grabbing"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white">
                    <it.icon size={16} />
                  </span>
                  <span className="text-sm font-medium text-slate-800">{it.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
