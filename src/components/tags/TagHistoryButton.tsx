import { useState } from 'react';
import { History } from 'lucide-react';
import { useTagsAccess } from '@/lib/api/tags';
import { ExecutionTagHistoryDialog } from './TagHistory';

export function TagHistoryButton({
  executionId,
  className = '',
}: {
  executionId: string | number;
  className?: string;
}) {
  const hasAccess = useTagsAccess();
  const [open, setOpen] = useState(false);
  if (!hasAccess) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 ${className}`}
      >
        <History size={15} aria-hidden="true" /> Histórico de tags
      </button>
      {open && <ExecutionTagHistoryDialog executionId={executionId} onClose={() => setOpen(false)} />}
    </>
  );
}
