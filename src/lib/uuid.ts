/**
 * Identificador único para uso no cliente.
 *
 * `crypto.randomUUID` só existe em **contexto seguro** (https ou localhost): numa
 * instalação on-premise servida por `http://10.0.0.5`, a chamada estoura com
 * "crypto.randomUUID is not a function" e derruba quem depende dela — foi assim que o
 * editor de formulário nativo ficava travado em "Carregando formulário…", com o Salvar do
 * processo recusando em seguida ("o formulário não está pronto para salvar").
 *
 * `crypto.getRandomValues` existe também em contexto inseguro, então o desvio mantém a
 * qualidade da aleatoriedade; `Math.random` fica como último recurso para ambiente sem
 * `crypto` nenhum (só para não quebrar a tela — nada aqui é usado como segredo).
 */
export function novoId(): string {
  const c: Crypto | undefined = globalThis.crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();

  const bytes = new Uint8Array(16);
  if (typeof c?.getRandomValues === 'function') c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);

  // Versão 4, variante RFC 4122 — o formato importa porque os ids viajam no XML do processo.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
