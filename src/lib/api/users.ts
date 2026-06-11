import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type UserListItem = {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'disabled' | 'invited';
  isInternal: boolean;
};

export type UserCadastral = {
  rg?: string | null;
  cpf?: string | null;
  matricula?: string | null;
  telefone?: string | null;
  cargo?: string | null;
};

export type UserPositionRef = { id: string; key: string; name: string; orgUnitId: string; orgUnitName: string };

export type UserDetail = UserListItem & UserCadastral & {
  accessProfiles: { id: string; name: string }[];
  positions: UserPositionRef[];
};

export type CreatedUser = {
  id: string;
  name: string;
  email: string;
  /** Senha temporária — devolvida UMA VEZ no POST. Exibir ao operador. */
  initialPassword: string;
};

export type UsersPage = { items: UserListItem[]; total: number; page: number; pageSize: number };

export type UsersListParams = { q?: string; status?: string; page?: number; pageSize?: number };

const userKeys = {
  all: ['users'] as const,
  list: (p: UsersListParams) => ['users', 'list', p] as const,
  detail: (id: string) => ['users', 'detail', id] as const,
};

function toQuery(params: UsersListParams): string {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.status) qs.set('status', params.status);
  qs.set('page', String(params.page ?? 1));
  qs.set('pageSize', String(params.pageSize ?? 20));
  return `?${qs.toString()}`;
}

export function useUsersList(params: UsersListParams) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => api.get<UsersPage>(`/api/v1/users/${toQuery(params)}`),
    placeholderData: (prev) => prev,   // pagination não pisca
  });
}

export function useUser(id: string | null) {
  return useQuery({
    queryKey: userKeys.detail(id ?? ''),
    queryFn: () => api.get<UserDetail>(`/api/v1/users/${id}`),
    enabled: !!id,
  });
}

export type CreateUserBody = {
  name: string;
  email: string;
  isInternal: boolean;
  accessProfileIds?: string[];
  positionIds?: string[];
} & UserCadastral;

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateUserBody) => api.post<CreatedUser>('/api/v1/users/', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.all }),
  });
}

export type UpdateUserBody = {
  name?: string;
  status?: 'active' | 'disabled' | 'invited';
  accessProfileIds?: string[];
  positionIds?: string[];
} & UserCadastral;

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateUserBody }) =>
      api.put<void>(`/api/v1/users/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.all }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/api/v1/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.all }),
  });
}
