import { Field, Section, TextInput } from '@/components/ui/Field';
import { useExtensionState } from '@/lib/useExtensionState';

type Props = {
  modeler: any;
  element: any;
};

type EmailTemplate = { templateRef: string };

const DEFAULTS: EmailTemplate = { templateRef: '' };

/**
 * Seção "Template" — referência a um template de e-mail a ser disparado.
 * Espelha o bloco de configuração de mensagem em `ConfigEventEmail.aspx`
 * (assunto/corpo na ZEEV; no septem o template é gerenciado em outro lugar,
 * aqui referenciamos pela chave).
 */
export function EmailTemplateSection({ modeler, element }: Props) {
  const { state, update, commit } = useExtensionState(modeler, element, 'septem:EmailTemplate', DEFAULTS);

  return (
    <Section title="Template do e-mail">
      <Field label="Template a ser executado">
        <TextInput
          value={state.templateRef}
          onChange={(e) => update({ templateRef: e.target.value })}
          onBlur={() => commit('templateRef')}
          placeholder="ex: tpl_aviso_recebimento"
        />
      </Field>
    </Section>
  );
}
