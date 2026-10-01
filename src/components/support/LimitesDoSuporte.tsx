import { createContext, useContext, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { platformApi } from '@/lib/platform-api';
import type { SupportScope } from '@/lib/api/support';

/**
 * Limites de texto do suporte, PUBLICADOS pelo servidor (requisito transversal do plano 26_09:
 * "limites vivem num contrato compartilhado — o servidor publica, o front lê"). Antes a tela repetia
 * os números à mão em 13 lugares; agora eles vêm de `GET …/support/limits`.
 *
 * Enquanto carrega, os campos ficam sem `maxLength` — o servidor valida de todo jeito, e um número
 * "de reserva" aqui seria o mesmo número escrito em dois lugares outra vez.
 */
export type LimitesDoSuporte = {
  subject: number;
  body: number;
  reason: number;
  impact: number;
  teamName: number;
  teamDescription: number;
  attachmentsPerMessage: number;
  attachmentBytes: number;
};

const Contexto = createContext<LimitesDoSuporte | undefined>(undefined);

export function ProvedorDeLimites({ escopo, children }: { escopo: SupportScope; children: ReactNode }) {
  const limites = useQuery({
    queryKey: ['support', escopo, 'limits'] as const,
    queryFn: () => (escopo === 'septem'
      ? platformApi.get<LimitesDoSuporte>('/support/limits')
      : api.get<LimitesDoSuporte>('/api/v1/support/limits')),
    staleTime: Infinity,
  });
  return <Contexto.Provider value={limites.data}>{children}</Contexto.Provider>;
}

/** Os limites do servidor, ou `undefined` enquanto chegam. */
export function useLimites(): Partial<LimitesDoSuporte> {
  return useContext(Contexto) ?? {};
}
