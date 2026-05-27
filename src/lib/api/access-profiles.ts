import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type AccessProfile = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissions: string[];
};

export function useAccessProfiles() {
  return useQuery({
    queryKey: ['access-profiles'],
    queryFn: () => api.get<AccessProfile[]>('/api/v1/access-profiles/'),
  });
}
