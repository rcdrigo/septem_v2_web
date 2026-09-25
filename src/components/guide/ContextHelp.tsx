import { CircleHelp } from 'lucide-react';
import { routes } from '@/lib/routes';
import { appHref } from '@/lib/nav';
import { useSessionStore } from '@/stores/session';

type TechnicalManualKey =
  | 'modelador-processos'
  | 'modelador-formularios'
  | 'operacao-tarefas-requisicoes'
  | 'simulacao-homologacao'
  | 'consultas-relatorios'
  | 'criacao-relatorios'
  | 'administracao-manuais-guide'
  | 'fontes-dados-integracoes'
  | 'documentos-assinaturas'
  | 'usuarios-perfis-permissoes'
  | 'modelos-email-notificacoes'
  | 'jornada-solicitante-externo'
  | 'estrutura-organizacional'
  | 'auditoria-rastreabilidade'
  | 'parametros-seguranca'
  | 'automacao-formularios'
  | 'validacao-documentos'
  | 'categorias-catalogos';

type Props = {
  manual: TechnicalManualKey;
  section: string;
  label: string;
  className?: string;
};

/** Link contextual para o manual técnico. O Guia resolve as chaves estáveis para
 * os IDs gerados pelo servidor e abre o capítulo em uma aba independente. */
export function ContextHelp({ manual, section, label, className = '' }: Props) {
  const canViewTechnicalManuals = useSessionStore((state) => state.can('manuals:technical'));

  if (!canViewTechnicalManuals) return null;

  const params = new URLSearchParams({
    tab: 'tecnico',
    manualKey: manual,
    section,
  });

  return (
    <a
      href={appHref(`${routes.guide}?${params.toString()}`)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={`${label} (abre em nova aba)`}
      className={`inline-flex size-7 shrink-0 items-center justify-center rounded-md text-slate-400 outline-none transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-1 ${className}`}
    >
      <CircleHelp size={15} aria-hidden="true" />
    </a>
  );
}
