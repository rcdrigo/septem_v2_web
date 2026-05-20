import { useEffect } from 'react';
import type { RecursosHandlers } from '@/components/modelador/ModeladorNavbar';
import { useModeladorStore, type ModeladorView } from '@/stores/modelador';

/**
 * Atalhos globais do modelador. Ignora teclas digitadas dentro de inputs/areas
 * (não roubar Ctrl+S durante digitação de texto).
 *
 *  - Ctrl/Cmd + S → Exportar fluxo (.bpmn)
 *  - Ctrl/Cmd + Shift + S → Salvar como PNG
 *  - Ctrl/Cmd + O → Importar fluxo
 *  - Ctrl/Cmd + 1 / 2 / 3 / 4 → Trocar de view
 */
const VIEW_KEYS: Record<string, ModeladorView> = {
  '1': 'fluxo',
  '2': 'formulario',
  '3': 'tarefasXcampos',
  '4': 'configuracoes',
};

export function useKeyboardShortcuts(recursos: RecursosHandlers) {
  const setCurrentView = useModeladorStore((s) => s.setCurrentView);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (isTypingTarget(target)) return;

      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      // Ctrl+Shift+S → PNG
      if (e.key.toLowerCase() === 's' && e.shiftKey) {
        e.preventDefault();
        recursos.onExportPng();
        return;
      }
      // Ctrl+S → exportar BPMN
      if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        recursos.onExport();
        return;
      }
      // Ctrl+O → importar
      if (e.key.toLowerCase() === 'o') {
        e.preventDefault();
        recursos.onImport();
        return;
      }
      // Ctrl+1..4 → views
      const view = VIEW_KEYS[e.key];
      if (view) {
        e.preventDefault();
        setCurrentView(view);
        return;
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [recursos, setCurrentView]);
}

function isTypingTarget(el: HTMLElement | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  // bpmn-js direct-editing usa div com tabindex
  if (el.closest('.djs-direct-editing-content')) return true;
  return false;
}
