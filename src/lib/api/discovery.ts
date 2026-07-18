import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type DiscoveryType = 'service' | 'request' | 'task' | 'query';

export type DiscoveryItem = {
  type: DiscoveryType;
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
  status: string | null;
  icon: string | null;
  categoryName: string | null;
  categoryColor: string | null;
};

type SearchResponse = { items: DiscoveryItem[]; total: number };
export type FavoritesResponse = { items: DiscoveryItem[]; limit: number };

export const favoriteKeys = { all: ['me', 'favorites'] as const };

export function useGlobalSearch(query: string, type: DiscoveryType | 'all') {
  const normalized = query.trim();
  const params = new URLSearchParams({ q: normalized, limit: '32' });
  if (type !== 'all') params.set('type', type);
  return useQuery({
    queryKey: ['global-search', normalized, type],
    queryFn: () => api.get<SearchResponse>(`/api/v1/search?${params.toString()}`),
    enabled: normalized.length >= 2,
    staleTime: 30_000,
  });
}

export function useFavorites() {
  return useQuery({
    queryKey: favoriteKeys.all,
    queryFn: () => api.get<FavoritesResponse>('/api/v1/me/favorites'),
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ type, key, favorite }: { type: 'service' | 'query'; key: string; favorite: boolean }) =>
      favorite
        ? api.put<void>(`/api/v1/me/favorites/${type}/${encodeURIComponent(key)}`)
        : api.del<void>(`/api/v1/me/favorites/${type}/${encodeURIComponent(key)}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: favoriteKeys.all }),
  });
}
