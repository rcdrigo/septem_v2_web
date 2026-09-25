import { useSessionStore } from '@/stores/session';

/**
 * Funcionalidades contratadas pelo ambiente (ADM-04, Fase 10).
 *
 * A autoridade é o SERVIDOR — ele recusa a ação com `feature_disabled` de qualquer jeito.
 * Isto aqui existe só para a tela não oferecer o que não vai funcionar: esconder o botão
 * é melhor experiência que deixar a pessoa clicar e tomar um erro.
 */
export const FEATURES = {
  signatures: 'signatures',
  documents: 'documents',
  reports: 'reports',
  publicPortal: 'public_portal',
  publicValidation: 'public_validation',
  manuals: 'manuals',
  dashboards: 'dashboards',
  aiAgents: 'ai_agents',
} as const;

/** Mensagem única do ponto de uso — a mesma frase que o servidor devolve. */
export const FEATURE_DISABLED_MESSAGE =
  'Esta funcionalidade foi desabilitada. Entre em contato com a Septem para resolução.';

/** Versão reutilizável: devolve um predicado, para filtrar listas de itens. */
export function useFeatureCheck(): (key?: string) => boolean {
  const modulos = useSessionStore((s) => s.tenant?.modulos);
  return (key?: string) => {
    if (!key) return true;
    if (!modulos) return true;   // config ainda não carregou: o servidor decide
    return modulos.includes(key);
  };
}

export function useFeature(key: string): boolean {
  const modulos = useSessionStore((s) => s.tenant?.modulos);
  // Sem config carregada ainda, não escondemos nada: o servidor decide de verdade, e
  // esconder por falta de dado faria a tela piscar a cada carregamento.
  if (!modulos) return true;
  return modulos.includes(key);
}
