import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Toaster } from '@/components/ui/Toaster';
import { ConfirmDialogHost } from '@/components/ui/ConfirmDialog';

export function AppShell() {
  return (
    <div className="flex h-screen w-screen bg-slate-100 text-slate-800">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
      <Toaster />
      <ConfirmDialogHost />
    </div>
  );
}
