/**
 * Campo "Data / Hora" no CANVAS do modelador.
 *
 * O form-js renderiza o `datetime` como DOIS controles lado a lado (uma caixa de
 * data com flatpickr + uma caixa de hora em 12h "hh:mm --"), com os rótulos
 * `dateLabel`/`timeLabel` em inglês. Quem modela via "Data e hora" via dois
 * campos para preencher — e nenhum deles é o seletor que o usuário final usa de
 * fato (o preenchimento é o `DatePickerField`: UM campo `DD/MM/YYYY HH:mm`, 24h,
 * com calendário e as colunas de hora ao lado).
 *
 * Este módulo troca o renderizador do `datetime` NO EDITOR por uma prévia fiel ao
 * preenchimento: UM campo só, com o formato do modo escolhido (data / hora /
 * data e hora) e o efeito da restrição de data escrito embaixo. O canvas do
 * form-js é uma prévia (todos os controles nascem desabilitados), então aqui não
 * há calendário interativo — o calendário adaptável vive no `DatePickerField`.
 *
 * Registrado via `additionalModules` do `FormEditor` (o form-js aplica os módulos
 * adicionais por último, então esta versão vence a padrão). Preact é dependência
 * direta e HOISTED do form-js — `h` aqui é a MESMA instância que renderiza o
 * canvas.
 *
 * A pintura usa as classes do PRÓPRIO form-js (`fjs-*`), e não o design system do
 * app: o campo divide a tela com componentes desenhados pela engine, e qualquer
 * estilo nosso aqui faz a data destoar de todo o resto do formulário.
 */
import { h } from 'preact';
import {
  DATE_LIMIT_HINT, DATE_PLACEHOLDER, dateFieldLabel, dateModeOfComponent,
  type DateLimit, type DateMode,
} from '@/lib/datafield';

type Field = {
  type?: string;
  subtype?: string;
  label?: string;
  dateLabel?: string;
  timeLabel?: string;
  validate?: { required?: boolean };
  properties?: Record<string, string | undefined>;
};

/** Ícone do gatilho — os mesmos traços do `DatePickerField` (lucide). */
function icone(mode: DateMode) {
  const comuns = {
    width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true',
  } as const;
  if (mode === 'time') {
    return h('svg', comuns,
      h('circle', { cx: 12, cy: 12, r: 10 }),
      h('polyline', { points: '12 6 12 12 16.5 12' }));
  }
  return h('svg', comuns,
    h('path', { d: 'M8 2v4' }),
    h('path', { d: 'M16 2v4' }),
    h('rect', { width: 18, height: 18, x: 3, y: 4, rx: 2 }),
    h('path', { d: 'M3 10h18' }),
    h('path', { d: 'M8 14h.01' }),
    h('path', { d: 'M12 14h.01' }),
    h('path', { d: 'M16 14h.01' }),
    h('path', { d: 'M8 18h.01' }),
    h('path', { d: 'M12 18h.01' }),
    h('path', { d: 'M16 18h.01' }));
}

export function SeptemDatetimePreview(props: { field?: Field }) {
  const field = props.field ?? {};
  const mode = dateModeOfComponent(field);
  const nome = dateFieldLabel(field);
  const limite = (field.properties?.septemDateLimit ?? '') as DateLimit;
  const dica = limite ? DATE_LIMIT_HINT[limite] : null;

  // ⚠️ Classes do FORM-JS, não Tailwind. Este componente vive DENTRO do canvas do
  // editor, ao lado de campos pintados pelo próprio form-js: usar o nosso design
  // system aqui fazia o campo de data ser o único visualmente diferente da tela —
  // exatamente o estranhamento que o dono relatou. A marcação abaixo é a mesma que o
  // form-js gera para um `textfield` desabilitado (label + input-group + input).
  return h('div', {
    class: 'fjs-form-field fjs-form-field-datetime fjs-disabled',
    'data-septem-date-preview': mode,
  },
    nome
      ? h('label', { class: 'fjs-form-field-label' },
          nome,
          field.validate?.required
            ? h('span', { 'aria-hidden': 'true', class: 'fjs-asterix' }, '*')
            : null)
      : null,
    h('div', { class: 'fjs-input-group fjs-disabled' },
      h('input', { type: 'text', disabled: true, class: 'fjs-input', placeholder: DATE_PLACEHOLDER[mode] }),
      h('span', { class: 'fjs-input-adornment' }, icone(mode))),
    dica ? h('div', { class: 'fjs-form-field-description' }, dica) : null);
}

/**
 * Substitui o renderizador do `datetime` mantendo a CONFIG original do form-js
 * (`keyed`, `sanitizeValue`, `create`, grupo da paleta…): só a pintura muda, o
 * comportamento da engine continua o dela.
 */
function registrarPreviaDeData(formFields: {
  get: (type: string) => { config?: unknown } | undefined;
  register: (type: string, formField: unknown) => void;
}) {
  const base = formFields.get('datetime');
  if (!base?.config) return; // versão do form-js sem datetime: mantém o padrão
  (SeptemDatetimePreview as unknown as { config: unknown }).config = base.config;
  formFields.register('datetime', SeptemDatetimePreview);
}
registrarPreviaDeData.$inject = ['formFields'];

export const septemDatetimeEditorModule = {
  __init__: ['septemDatetimePreview'],
  septemDatetimePreview: ['type', registrarPreviaDeData],
};
