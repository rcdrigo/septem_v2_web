import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { FormEditor } from '@bpmn-io/form-js';
import emptySchema from '@/assets/empty-form.json';

/** MIME usado no drag-and-drop dos cards da paleta para o canvas. */
export const DND_TYPE = 'application/x-septem-field';

/** Campos novos de entrada nascem obrigatórios por padrão (têm `key`). */
function applyNewFieldDefaults(editor: any, field: any) {
  if (!field?.key) return; // apresentação/container não têm chave
  try { editor.get('modeling').editFormField(field, ['validate'], { ...(field.validate || {}), required: true }); }
  catch { /* ignora se o tipo não aceitar validate */ }
  // O form-js cria datetime como "somente data". A paleta Septem oferece
  // "Data / Hora" e o runtime historicamente usa ambos como padrão.
  if (field.type === 'datetime') {
    try { editor.get('modeling').editFormField(field, ['subtype'], 'datetime'); }
    catch { /* mantém o padrão da engine se a versão não aceitar subtype */ }
  }
}

/** Adiciona um campo do tipo dado no índice (de topo) correspondente à posição Y solta. */
function addTypeAt(editor: any, container: HTMLElement, type: string, clientY: number) {
  try {
    const modeling = editor.get('modeling');
    const registry = editor.get('formFieldRegistry');
    const root = registry.getForm();
    const comps: any[] = Array.isArray(root?.components) ? root.components : [];
    let index = comps.length;
    for (let i = 0; i < comps.length; i++) {
      const node = container.querySelector(`[data-id="${comps[i].id}"]`);
      if (!node) continue;
      const r = node.getBoundingClientRect();
      if (clientY < r.top + r.height / 2) { index = i; break; }
    }
    const field = modeling.addFormField({ type }, root, index);
    applyNewFieldDefaults(editor, field);
    try { editor.get('selection').set(field); } catch { /* seleciona o novo campo, se der */ }
  } catch (err) {
    console.error('Falha ao soltar campo no canvas:', err);
  }
}

export type FormBuilderHandle = {
  importSchema: (schema: unknown) => Promise<void>;
  saveSchema: () => unknown;
  reset: () => Promise<void>;
  /** Adiciona um campo do tipo dado ao fim do formulário (usado pela paleta de cards). */
  addField: (type: string) => void;
  /** Edita uma propriedade do campo (path + valor) via a engine do form-js. */
  editField: (field: any, path: string[], value: unknown) => void;
};

type FormBuilderProps = {
  /** Chamado quando muda o campo selecionado no canvas (null = nada selecionado). */
  onSelect?: (field: any | null) => void;
};

export const FormBuilder = forwardRef<FormBuilderHandle, FormBuilderProps>(({ onSelect }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<FormEditor | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!containerRef.current) return;

    const editor = new FormEditor({ container: containerRef.current } as any);
    editorRef.current = editor;

    // Liga a seleção do canvas ao nosso painel de campo (cockpit).
    const bus = (editor as any).get('eventBus');
    const onSel = (e: any) => onSelectRef.current?.(e?.selection ?? null);
    bus.on('selection.changed', onSel);

    // Drag-and-drop da paleta de cards → canvas (insere na posição solta).
    const el = containerRef.current;
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes(DND_TYPE)) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    };
    const onDrop = (e: DragEvent) => {
      const type = e.dataTransfer?.getData(DND_TYPE);
      if (!type) return;
      e.preventDefault();
      addTypeAt(editor, el, type, e.clientY);
    };
    el.addEventListener('dragover', onDragOver);
    el.addEventListener('drop', onDrop);

    editor
      .importSchema(emptySchema)
      .catch((err: unknown) => console.error('Falha ao importar form inicial:', err));

    return () => {
      bus.off('selection.changed', onSel);
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('drop', onDrop);
      editor.destroy();
      editorRef.current = null;
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      async importSchema(schema: unknown) {
        if (!editorRef.current) return;
        await editorRef.current.importSchema(schema);
      },
      saveSchema() {
        if (!editorRef.current) throw new Error('Editor de form não inicializado');
        return editorRef.current.saveSchema();
      },
      async reset() {
        if (!editorRef.current) return;
        await editorRef.current.importSchema(emptySchema);
      },
      addField(type: string) {
        const editor = editorRef.current as any;
        if (!editor) return;
        try {
          const modeling = editor.get('modeling');
          const registry = editor.get('formFieldRegistry');
          const root = registry.getForm();
          const index = Array.isArray(root?.components) ? root.components.length : 0;
          const field = modeling.addFormField({ type }, root, index);
          applyNewFieldDefaults(editor, field);
          try { editor.get('selection').set(field); } catch { /* seleciona o novo campo, se der */ }
        } catch (err) {
          console.error('Falha ao adicionar campo:', err);
        }
      },
      editField(field: any, path: string[], value: unknown) {
        const editor = editorRef.current as any;
        editor?.get('modeling').editFormField(field, path, value);
      },
    }),
    [],
  );

  return <div ref={containerRef} className="flex-1 overflow-hidden bg-white" />;
});

FormBuilder.displayName = 'FormBuilder';
