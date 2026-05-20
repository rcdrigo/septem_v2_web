import { useState } from 'react';
import {
  Workflow,
  FormInput,
  Table2,
  FolderOpen,
  Settings,
  Pencil,
  Upload,
  Download,
  Image as ImageIcon,
  ChevronDown,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useModeladorStore, type ModeladorView } from '@/stores/modelador';
import { MenuItem, Popover } from '@/components/ui/Popover';
import { DiagnosticsBadge } from './DiagnosticsBadge';

type ViewButton = { view: ModeladorView; label: string; icon: LucideIcon };

const viewButtons: ViewButton[] = [
  { view: 'fluxo', label: 'Fluxo', icon: Workflow },
  { view: 'formulario', label: 'Formulário', icon: FormInput },
  { view: 'tarefasXcampos', label: 'Tarefas × Campos', icon: Table2 },
  { view: 'configuracoes', label: 'Configurações', icon: Settings },
];

export type RecursosHandlers = {
  onImport: () => void;
  onExport: () => void;
  onExportPng: () => void;
};

type Props = {
  recursos: RecursosHandlers;
  modeler: any | null;
};

/**
 * Barra superior do modelador. Tem 3 zonas:
 *  - Esquerda: nome do processo (clique para renomear; sincronizado com `bpmn:Process.name`)
 *  - Centro/Direita: 4 botões de view + dropdown "Recursos"
 *
 * Espelha a toolbar do `Designer.ascx/Designer2.ascx` do ZEEV, mas com paleta
 * reduzida e menus enxutos.
 */
export function ModeladorNavbar({ recursos, modeler }: Props) {
  const processName = useModeladorStore((s) => s.processName);
  const setProcessName = useModeladorStore((s) => s.setProcessName);
  const currentView = useModeladorStore((s) => s.currentView);
  const setCurrentView = useModeladorStore((s) => s.setCurrentView);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(processName);

  function startEdit() {
    setDraft(processName);
    setEditing(true);
  }
  function commitEdit() {
    const trimmed = draft.trim();
    if (trimmed.length > 0) setProcessName(trimmed);
    setEditing(false);
  }
  function cancelEdit() {
    setEditing(false);
  }

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit();
              if (e.key === 'Escape') cancelEdit();
            }}
            className="min-w-0 rounded-md border border-slate-300 px-2 py-1 text-base font-semibold text-slate-900 focus:border-slate-500 focus:outline-none"
            style={{ width: `${Math.max(draft.length + 2, 12)}ch` }}
          />
        ) : (
          <button
            type="button"
            onClick={startEdit}
            className="group flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-base font-semibold text-slate-900 hover:bg-slate-100"
            title="Clique para renomear o processo"
          >
            <span className="truncate">{processName}</span>
            <Pencil
              size={14}
              className="shrink-0 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100"
            />
          </button>
        )}
      </div>

      <nav className="flex items-center gap-1">
        <div className="mr-2">
          <DiagnosticsBadge modeler={modeler} />
        </div>
        {viewButtons.map(({ view, label, icon: Icon }) => {
          const active = view === currentView;
          return (
            <button
              key={view}
              type="button"
              onClick={() => setCurrentView(view)}
              className={[
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100',
              ].join(' ')}
            >
              <Icon size={16} />
              {label}
            </button>
          );
        })}

        <Popover
          trigger={(open) => (
            <span
              className={[
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                open ? 'bg-slate-200 text-slate-900' : 'text-slate-700 hover:bg-slate-100',
              ].join(' ')}
            >
              <FolderOpen size={16} />
              Recursos
              <ChevronDown size={12} />
            </span>
          )}
        >
          {(close) => (
            <>
              <MenuItem
                onClick={() => {
                  close();
                  recursos.onImport();
                }}
              >
                <Upload size={14} />
                Importar fluxo
              </MenuItem>
              <MenuItem
                onClick={() => {
                  close();
                  recursos.onExport();
                }}
              >
                <Download size={14} />
                Exportar fluxo
              </MenuItem>
              <MenuItem
                onClick={() => {
                  close();
                  recursos.onExportPng();
                }}
              >
                <ImageIcon size={14} />
                Salvar como imagem (PNG)
              </MenuItem>
            </>
          )}
        </Popover>
      </nav>
    </header>
  );
}
