import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/**
 * Parâmetros do sistema (Fase 1). Visão consolidada: branding do catálogo master
 * + configurações do tenant (hero do login, expediente, SMTP, S3).
 * Segredos (senha SMTP / secret key do S3) NUNCA chegam no front — só os flags
 * `passwordSet` / `secretKeySet`. Ao salvar, campo em branco = "não altera".
 */
export type SettingsGeneral = {
  tenantId: string;
  host: string | null;
  clienteNome: string;
  ambienteNome: string;
  logoUrl: string | null;
  primaryColor: string;
  heroImageUrl: string | null;
  systemDescription: string | null;
  businessHourStart: number;
  businessHourEnd: number;
  businessDays: string;
};

export type SettingsEmail = {
  host: string | null;
  port: number;
  useSsl: boolean;
  authMode: string;
  user: string | null;
  passwordSet: boolean;
  fromAddress: string | null;
  fromName: string | null;
};

export type SettingsStorage = {
  bucketName: string | null;
  region: string | null;
  endpoint: string | null;
  accessKey: string | null;
  secretKeySet: boolean;
  baseFolder: string | null;
  cdnUrl: string | null;
  useSignedUrls: boolean;
  urlExpirationMinutes: number;
  storageClass: string | null;
  encryption: string | null;
  maxUploadMb: number;
  blockedExtensions: string;
};

export type Settings = {
  general: SettingsGeneral;
  email: SettingsEmail;
  storage: SettingsStorage;
  updatedAt: string;
};

export type GeneralPayload = {
  clienteNome: string;
  ambienteNome: string;
  logoUrl: string | null;
  primaryColor: string;
  heroImageUrl: string | null;
  systemDescription: string | null;
  businessHourStart: number;
  businessHourEnd: number;
  businessDays: string;
};

export type EmailPayload = {
  host: string | null;
  port: number;
  useSsl: boolean;
  authMode: string;
  user: string | null;
  /** null = mantém a senha atual; '' = limpa; texto = substitui. */
  password: string | null;
  fromAddress: string | null;
  fromName: string | null;
};

export type StoragePayload = {
  bucketName: string | null;
  region: string | null;
  endpoint: string | null;
  accessKey: string | null;
  /** null = mantém a secret key atual; '' = limpa; texto = substitui. */
  secretKey: string | null;
  baseFolder: string | null;
  cdnUrl: string | null;
  useSignedUrls: boolean;
  urlExpirationMinutes: number;
  storageClass: string | null;
  encryption: string | null;
  maxUploadMb: number;
  blockedExtensions: string;
};

const KEY = ['settings'];

export function useSettings() {
  return useQuery({ queryKey: KEY, queryFn: () => api.get<Settings>('/api/v1/settings') });
}

export function useSaveGeneral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: GeneralPayload) => api.put('/api/v1/settings/general', p),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useSaveEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: EmailPayload) => api.put('/api/v1/settings/email', p),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Envia um e-mail de teste com a config JÁ SALVA (salve antes de testar). */
export function useTestEmail() {
  return useMutation({ mutationFn: (to: string) => api.post('/api/v1/settings/email/test', { to }) });
}

export function useSaveStorage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: StoragePayload) => api.put('/api/v1/settings/storage', p),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Testa o bucket com a config JÁ SALVA (salve antes de testar). */
export function useTestStorage() {
  return useMutation({ mutationFn: () => api.post('/api/v1/settings/storage/test', {}) });
}

/** Dias úteis: ISO-8601 (1 = segunda … 7 = domingo), como o backend guarda. */
export const WEEKDAYS: Array<{ value: number; label: string; short: string }> = [
  { value: 1, label: 'Segunda-feira', short: 'Seg' },
  { value: 2, label: 'Terça-feira', short: 'Ter' },
  { value: 3, label: 'Quarta-feira', short: 'Qua' },
  { value: 4, label: 'Quinta-feira', short: 'Qui' },
  { value: 5, label: 'Sexta-feira', short: 'Sex' },
  { value: 6, label: 'Sábado', short: 'Sáb' },
  { value: 7, label: 'Domingo', short: 'Dom' },
];

export function parseDays(csv: string): number[] {
  return csv
    .split(',')
    .map((d) => Number(d.trim()))
    .filter((d) => d >= 1 && d <= 7);
}
