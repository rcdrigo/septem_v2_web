import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Form } from '@bpmn-io/form-js-viewer';

const EMPTY = { type: 'default', schemaVersion: 17, components: [] };

export type FormFillResult = { data: Record<string, unknown>; errors: Record<string, unknown> };
export type FormFillHandle = { submit: () => FormFillResult };

/**
 * Form-js viewer interativo (B3): renderiza o schema com os dados atuais e o
 * usuário preenche. `submit()` devolve os dados + erros de validação.
 */
export const FormFill = forwardRef<FormFillHandle, { schema: unknown; data?: unknown }>(({ schema, data }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<Form | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const form = new Form({ container: containerRef.current });
    formRef.current = form;
    void form.importSchema((schema ?? EMPTY) as never, (data ?? {}) as never).catch(() => {});
    return () => { form.destroy(); formRef.current = null; };
  }, []); // monta uma vez com schema/data iniciais

  useImperativeHandle(ref, () => ({
    submit: () => (formRef.current?.submit() as FormFillResult | undefined) ?? { data: {}, errors: {} },
  }), []);

  return <div ref={containerRef} className="fjs-container" />;
});

FormFill.displayName = 'FormFill';
