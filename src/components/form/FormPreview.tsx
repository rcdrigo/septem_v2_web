import { useEffect, useRef } from 'react';
import { Form } from '@bpmn-io/form-js-viewer';

/**
 * Renderiza um schema form-js com o viewer (read-only para o usuário do builder).
 * Decisão 2: o form-js é o renderer; nossa autoria deriva o schema.
 */
export function FormPreview({ schema }: { schema: unknown }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<Form | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const form = new Form({ container: containerRef.current });
    formRef.current = form;
    return () => { form.destroy(); formRef.current = null; };
  }, []);

  useEffect(() => {
    formRef.current?.importSchema(schema as never).catch(() => {
      // schema incompleto durante a edição — ignora até ficar válido
    });
  }, [schema]);

  return <div ref={containerRef} className="fjs-container" />;
}
