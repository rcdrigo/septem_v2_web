import { Section } from '@/components/ui/Field';
import { FieldVisibilityEditor } from '../editors/FieldVisibilityEditor';

type Props = {
  modeler: any;
  element: any;
};

/**
 * Seção "Configuração do formulário" — visibilidade dos campos
 * (oculto / visível / editável) e fonte de dados por campo.
 *
 * O schema do formulário vem do `formStore` (Zustand). O wire com o FormBuilder
 * é feito na Fase 5 — até lá o editor mostra empty-state quando não há campos.
 */
export function FormFieldsSection({ modeler, element }: Props) {
  return (
    <Section
      title="Configuração do formulário"
      help="Define a visibilidade dos campos do formulário nesta tarefa."
    >
      <FieldVisibilityEditor modeler={modeler} element={element} />
    </Section>
  );
}
