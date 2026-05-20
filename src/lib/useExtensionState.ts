import { useCallback, useEffect, useState } from 'react';
import { getExtensionConfig, setExtensionConfig, type ConfigShape } from './bpmn-helpers';

/**
 * Hook utilitário para seções de painel que editam uma extensão moddle `septem:*`.
 *
 * Mantém estado local controlado e expõe duas formas de propagar para o XML:
 *  - `flush(patch)` — escreve um patch agora (usado em onBlur / onChange para
 *    selects, checkboxes, radios — controles atômicos).
 *  - `commit(field)` — escreve o valor atual do field (usado em onBlur de inputs
 *    livres para evitar disparar updateProperties a cada tecla).
 *
 * Recarrega o estado local sempre que o elemento selecionado muda.
 */
export function useExtensionState<T extends ConfigShape>(
  modeler: any,
  element: any,
  type: string,
  defaults: T,
) {
  const [state, setState] = useState<T>(defaults);

  useEffect(() => {
    setState(getExtensionConfig(element, type, defaults));
    // defaults é estável por convenção (const no módulo) — não vamos depender dele
    // para evitar reset em cada render do parent
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element, type]);

  const update = useCallback((patch: Partial<T>) => {
    setState((s) => ({ ...s, ...patch }));
  }, []);

  const flush = useCallback(
    (patch: Partial<T>) => {
      setState((s) => ({ ...s, ...patch }));
      setExtensionConfig(modeler, element, type, patch);
    },
    [modeler, element, type],
  );

  const commit = useCallback(
    (field: keyof T) => {
      const current = getExtensionConfig(element, type, defaults);
      if (state[field] !== current[field]) {
        setExtensionConfig(modeler, element, type, { [field]: state[field] } as Partial<T>);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [modeler, element, type, state],
  );

  return { state, update, flush, commit } as const;
}
