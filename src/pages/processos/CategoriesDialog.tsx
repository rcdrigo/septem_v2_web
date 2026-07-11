import { CategoryManagerDialog } from '@/components/categories/CategoryManagerDialog';
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '@/lib/api/catalog';

/**
 * Modal "Categorias" (Admin › Processos): CRUD das categorias que agrupam e
 * colorem os serviços. Substitui a antiga página stub do menu. UI genérica em
 * `CategoryManagerDialog` (compartilhada com Admin › Relatórios).
 */
export function CategoriesDialog({ onClose }: { onClose: () => void }) {
  return (
    <CategoryManagerDialog
      title="Categorias de processos"
      inUseHint="Processos vinculados impedem a exclusão."
      api={{
        useList: useCategories,
        useCreate: useCreateCategory,
        useUpdate: useUpdateCategory,
        useDelete: useDeleteCategory,
      }}
      onClose={onClose}
    />
  );
}
