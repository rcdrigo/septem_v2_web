import { useEffect } from 'react';
import { useFormStore } from '@/stores/form';
import { extractFields } from '@/lib/form-schema';
import { getEmbeddedFormSchema } from '@/lib/bpmn-process';

/**
 * Garante que o `formStore` esteja populado com os campos do formulário a partir
 * do schema embutido no XML — usado em painéis do modelador (matriz, seletores
 * de campo) que abrem sem ter passado pela aba Formulário (onde o polling popula).
 */
export function useEnsureFormFields(modeler: any | null) {
  const setFields = useFormStore((s) => s.setFields);
  useEffect(() => {
    if (!modeler) return;
    const schema = getEmbeddedFormSchema(modeler);
    if (schema) setFields(extractFields(schema as any));
  }, [modeler, setFields]);
}
