import { GeneralInfoSection } from '../sections/GeneralInfoSection';
import { PlaceholderBox, Section } from '@/components/ui/Field';
import type { PanelProps } from './types';

/**
 * Painel-fallback para tipos BPMN sem painel especializado
 * (ex: SequenceFlow, Process root, Lane, etc.).
 */
export function GenericPanel({ modeler, element }: PanelProps) {
  return (
    <>
      <GeneralInfoSection modeler={modeler} element={element} />
      <Section title="Configurações específicas">
        <PlaceholderBox>
          Este tipo de elemento não tem configurações adicionais previstas na spec.
        </PlaceholderBox>
      </Section>
    </>
  );
}
