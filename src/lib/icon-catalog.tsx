import {
  Check, CheckCircle2, X, XCircle, ThumbsUp, ThumbsDown, Send, Save, Trash2,
  ArrowRight, ArrowLeft, RotateCcw, Ban, Flag, AlertTriangle, Clock, Pause,
  Play, Pencil, Eye, FileCheck, FileX, Mail, Forward, Reply, ShieldCheck,
  Lock, Unlock, Star, Bookmark, Plus, Minus,
  type LucideIcon,
} from 'lucide-react';
import { FA_ALL_ICON_NAMES, FA_REGULAR_ICON_NAMES } from './fa-icon-names';

const faNames = new Set(FA_ALL_ICON_NAMES);

/**
 * Catálogo curado de ícones (lucide) para botões de ação. Mantém o bundle
 * enxuto (importes nominais) e dá um conjunto previsível ao usuário no picker.
 * A chave é o nome canônico gravado no XML (`septem:actionButton@icon`) e
 * reusado na execução.
 */
export const ICON_CATALOG: Record<string, LucideIcon> = {
  Check, CheckCircle2, X, XCircle, ThumbsUp, ThumbsDown, Send, Save, Trash2,
  ArrowRight, ArrowLeft, RotateCcw, Ban, Flag, AlertTriangle, Clock, Pause,
  Play, Pencil, Eye, FileCheck, FileX, Mail, Forward, Reply, ShieldCheck,
  Lock, Unlock, Star, Bookmark, Plus, Minus,
};

export const ICON_NAMES = Object.keys(ICON_CATALOG);

/** Renderiza um ícone do catálogo pelo nome; retorna null se vazio/desconhecido. */
export function renderIcon(name: string | undefined | null, size = 14) {
  if (!name) return null;
  const fa = /^(fa-solid|fa-regular) fa-([a-z0-9-]+)$/.exec(name);
  if (fa && faNames.has(fa[2]) && (fa[1] !== 'fa-regular' || FA_REGULAR_ICON_NAMES.has(fa[2]))) {
    return <i aria-hidden="true" className={name} style={{ fontSize: size }} />;
  }
  const Icon = ICON_CATALOG[name];
  return Icon ? <Icon size={size} /> : null;
}
