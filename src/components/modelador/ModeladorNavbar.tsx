import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
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
  Save,
  Send,
  GitBranch,
  LoaderCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useModeladorStore, type ModeladorView } from '@/stores/modelador';
import { MenuItem, Popover } from '@/components/ui/Popover';
import { DiagnosticsBadge } from './DiagnosticsBadge';
import { routes } from '@/lib/routes';

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

/** Persistência no backend (IF2): salvar no lugar, versionar e publicar. */
export type PersistenceHandlers = {
  onSave: () => Promise<void>;
  onVersion: () => Promise<void>;
  onPublish: () => Promise<void>;
  pendingAction: 'save' | 'publish' | 'version' | null;
  /** Há alterações no fluxo ainda não salvas no servidor. */
  dirty: boolean;
  /** draft | homologation | published | inactive — pinta o selo ao lado do nome. */
  status?: string | null;
  version?: number | null;
};

type Props = {
  recursos: RecursosHandlers;
  modeler: any | null;
  persistence?: PersistenceHandlers;
};

/**
 * Barra superior do modelador. Tem 3 zonas:
 *  - Esquerda: nome do processo (clique para renomear; sincronizado com `bpmn:Process.name`)
 *  - Centro/Direita: 4 botões de view + dropdown "Recursos" + Salvar/Publicar
 */
export function ModeladorNavbar({ recursos, modeler, persistence }: Props) {
  const navigate = useNavigate();
  const processName = useModeladorStore((s) => s.processName);
  const setProcessName = useModeladorStore((s) => s.setProcessName);
  const currentView = useModeladorStore((s) => s.currentView);
  const setCurrentView = useModeladorStore((s) => s.setCurrentView);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(processName);

  function goBack() {
    if (persistence?.dirty && !window.confirm('Há alterações não salvas. Sair mesmo assim?')) return;
    // Aba aberta via "Novo/Editar": fecha; se não der (URL direta), volta para a lista.
    window.close();
    navigate(routes.adminFlows);
  }

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
    // overflow-x-auto: em telas estreitas a navbar rola horizontalmente em vez
    // de cortar Salvar/Publicar fora da viewport (modelador é usável no mobile).
    <header className="flex items-center justify-between gap-2 overflow-x-auto border-b border-slate-200 bg-white px-5 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={goBack}
          className="shrink-0 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          title="Voltar para Processos"
        >
          <ArrowLeft size={18} />
        </button>
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
            {/* Selo de HOMOLOGAÇÃO (Fase 5): sem ele o usuário não tem como saber que
                está editando a versão de teste, e não a que roda em produção. */}
            {persistence?.status === 'homologation' && (
              <span
                data-testid="selo-homologacao"
                title="Esta versão está em homologação: só a simulação a usa. Produção segue na versão publicada até você clicar em Publicar."
                className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800"
              >
                Em homologação{persistence?.version ? ` · v${persistence.version}` : ''}
              </span>
            )}
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
              {persistence && (
                <>
                  <div className="my-1 h-px bg-slate-200" />
                  <MenuItem
                    disabled={persistence.pendingAction != null}
                    ariaBusy={persistence.pendingAction === 'version'}
                    onClick={async () => {
                      await persistence.onVersion();
                      close();
                    }}
                  >
                    {persistence.pendingAction === 'version' ? <LoaderCircle size={14} className="animate-spin" /> : <GitBranch size={14} />}
                    {persistence.pendingAction === 'version' ? 'Versionando…' : 'Versionar processo'}
                  </MenuItem>
                </>
              )}
            </>
          )}
        </Popover>

        {persistence && (
          <>
            <span className="mx-1 h-5 w-px bg-slate-200" />
            {persistence.dirty && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600" title="Há alterações no fluxo ainda não salvas">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Alterações pendentes
              </span>
            )}
            <button
              type="button"
              onClick={persistence.onSave}
              disabled={persistence.pendingAction != null}
              aria-busy={persistence.pendingAction === 'save'}
              className={[
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50',
                persistence.dirty ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'text-slate-700 hover:bg-slate-100',
              ].join(' ')}
            >
              {persistence.pendingAction === 'save' ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
              {persistence.pendingAction === 'save' ? 'Salvando…' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={persistence.onPublish}
              disabled={persistence.pendingAction != null}
              aria-busy={persistence.pendingAction === 'publish'}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {persistence.pendingAction === 'publish' ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
              {persistence.pendingAction === 'publish' ? 'Publicando…' : 'Publicar'}
            </button>
          </>
        )}
      </nav>
    </header>
  );
}
