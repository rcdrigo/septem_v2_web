import { Loader2 } from 'lucide-react';

export function LoadingSplash({ message }: { message?: string }) {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-100">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <Loader2 size={24} className="animate-spin" />
        <p className="text-sm">{message ?? 'Carregando...'}</p>
      </div>
    </div>
  );
}
