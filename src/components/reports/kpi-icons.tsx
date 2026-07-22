import {
  TrendingUp, DollarSign, Users, FileText, Clock, CheckCircle2, AlertTriangle, Gauge, Hash, type LucideIcon,
} from 'lucide-react';

/** Ícones disponíveis para o KPI (F7.11) — nome estável salvo na definição. */
export const KPI_ICONS: Record<string, LucideIcon> = {
  trendingUp: TrendingUp,
  dollar: DollarSign,
  users: Users,
  file: FileText,
  clock: Clock,
  check: CheckCircle2,
  alert: AlertTriangle,
  gauge: Gauge,
  hash: Hash,
};

export const KPI_ICON_OPTIONS = [
  { value: '', label: 'Sem ícone' },
  { value: 'trendingUp', label: 'Tendência' },
  { value: 'dollar', label: 'Dinheiro' },
  { value: 'users', label: 'Pessoas' },
  { value: 'file', label: 'Documento' },
  { value: 'clock', label: 'Tempo' },
  { value: 'check', label: 'Concluído' },
  { value: 'alert', label: 'Alerta' },
  { value: 'gauge', label: 'Medidor' },
  { value: 'hash', label: 'Número' },
];
