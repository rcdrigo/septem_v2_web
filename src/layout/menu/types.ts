import type { LucideIcon } from 'lucide-react';
import type { AccessMode, SessionState } from '@/stores/session';

/** Link de navegação (rota interna). */
export type MenuLink = {
  kind: 'link';
  label: string;
  to: string;
  icon: LucideIcon;
  /** Badge de dados carregado pelo item, sem acoplar o menu à implementação da consulta. */
  badge?: 'pendingTasks';
  /** Permissão necessária; ausente = sempre visível. */
  perm?: string;
  /** Visibilidade condicional extra (ex: Dashboard só se configurado). */
  visible?: (s: SessionState) => boolean;
};

/** Ação imperativa (não navega — abre popover, faz logout, etc.). */
export type MenuAction = {
  kind: 'action';
  label: string;
  icon: LucideIcon;
  action: 'impersonate' | 'logout';
  perm?: string;
};

/** Grupo colapsável com sub-itens (ex: Admin › Processos). */
export type MenuGroup = {
  kind: 'group';
  label: string;
  icon: LucideIcon;
  perm?: string;
  children: MenuLink[];
};

export type MenuNode = MenuLink | MenuGroup;

/** Bloco vertical do menu, com cabeçalho opcional ("Geral", "Admin"). */
export type MenuSection = {
  label?: string;
  items: MenuNode[];
};

/** Layout completo de um modo de acesso. */
export type MenuLayout = {
  main: MenuSection[];
  /** Itens alinhados ao final da barra (Personificar, Suporte, Sair). */
  footer: (MenuLink | MenuAction)[];
};

export type MenuByMode = Record<AccessMode, MenuLayout>;
