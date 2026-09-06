import { create } from 'zustand';

/**
 * `currentView` é uma das 4 views navegáveis. "Recursos" é dropdown de ações,
 * não uma view — então não aparece aqui.
 */
export type ModeladorView = 'fluxo' | 'formulario' | 'tarefasXcampos' | 'configuracoes';

type ModeladorState = {
  processName: string;
  currentView: ModeladorView;
  selectedElementId: string | null;
  xml: string | null;
  setProcessName: (name: string) => void;
  setCurrentView: (view: ModeladorView) => void;
  setSelectedElementId: (id: string | null) => void;
  setXml: (xml: string | null) => void;
  /**
   * Empurra AGORA o schema do formulário para dentro do BPMN. A view de formulário
   * propaga por polling (600ms); sem este flush, salvar logo após uma alteração
   * gravava o processo SEM ela — perda silenciosa do que o usuário acabou de mudar.
   */
  flushForm: (() => Promise<void>) | null;
  setFlushForm: (fn: (() => Promise<void>) | null) => void;
};

function defaultProcessName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `Processo-${stamp}`;
}

export const useModeladorStore = create<ModeladorState>((set) => ({
  processName: defaultProcessName(),
  currentView: 'fluxo',
  selectedElementId: null,
  xml: null,
  setProcessName: (name) => set({ processName: name }),
  setCurrentView: (view) => set({ currentView: view }),
  setSelectedElementId: (id) => set({ selectedElementId: id }),
  setXml: (xml) => set({ xml }),
  flushForm: null,
  setFlushForm: (fn) => set({ flushForm: fn }),
}));
