import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { FormEditor } from '@bpmn-io/form-js';
import emptySchema from '@/assets/empty-form.json';

export type FormBuilderHandle = {
  importSchema: (schema: unknown) => Promise<void>;
  saveSchema: () => unknown;
  reset: () => Promise<void>;
};

export const FormBuilder = forwardRef<FormBuilderHandle>((_, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<FormEditor | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const editor = new FormEditor({ container: containerRef.current });
    editorRef.current = editor;

    editor
      .importSchema(emptySchema)
      .catch((err: unknown) => console.error('Falha ao importar form inicial:', err));

    return () => {
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
    }),
    [],
  );

  return <div ref={containerRef} className="flex-1 overflow-hidden bg-white" />;
});

FormBuilder.displayName = 'FormBuilder';
