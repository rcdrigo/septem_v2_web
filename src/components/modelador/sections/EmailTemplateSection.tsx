import { Field, Section } from '@/components/ui/Field';
import { useExtensionState } from '@/lib/useExtensionState';
import { EmailTemplateSelect } from '../fields/EmailTemplateSelect';

type Props = {
  modeler: any;
  element: any;
};

type EmailTemplate = { templateRef: string };

const DEFAULTS: EmailTemplate = { templateRef: '' };

/** Seção "Template" — referência ao modelo de e-mail (gerido em Configurações). */
export function EmailTemplateSection({ modeler, element }: Props) {
  const { state, flush } = useExtensionState(modeler, element, 'septem:EmailTemplate', DEFAULTS);

  return (
    <Section title="Template do e-mail">
      <Field label="Template a ser executado">
        <EmailTemplateSelect value={state.templateRef} onChange={(v) => flush({ templateRef: v })} />
      </Field>
    </Section>
  );
}
