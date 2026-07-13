import { Check, X } from 'lucide-react';

/**
 * Requisitos de senha marcando em tempo real. As regras são as mesmas do backend
 * (`PasswordPolicy`) — se mudarem lá, mudam aqui: o endpoint `/auth/password-rules`
 * expõe a lista, e este componente a espelha para não depender de rede em cada tecla.
 */
export const PASSWORD_RULES: Array<{ key: string; label: string; ok: (p: string) => boolean }> = [
  { key: 'length', label: 'Pelo menos 8 caracteres', ok: (p) => p.length >= 8 },
  { key: 'upper', label: 'Uma letra maiúscula', ok: (p) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'Uma letra minúscula', ok: (p) => /[a-z]/.test(p) },
  { key: 'digit', label: 'Um número', ok: (p) => /\d/.test(p) },
  { key: 'special', label: 'Um caractere especial', ok: (p) => /[^A-Za-z0-9]/.test(p) },
];

export function isPasswordValid(password: string): boolean {
  return PASSWORD_RULES.every((r) => r.ok(password));
}

export function PasswordChecklist({ password }: { password: string }) {
  return (
    <ul className="space-y-1" data-testid="password-checklist">
      {PASSWORD_RULES.map((r) => {
        const ok = r.ok(password);
        return (
          <li
            key={r.key}
            data-rule={r.key}
            data-ok={ok}
            className={`flex items-center gap-1.5 text-xs ${ok ? 'text-emerald-600' : 'text-slate-400'}`}
          >
            {ok ? <Check size={13} /> : <X size={13} />} {r.label}
          </li>
        );
      })}
    </ul>
  );
}
