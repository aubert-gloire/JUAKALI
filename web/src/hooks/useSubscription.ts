import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { subscriptionApi } from '@/lib/subscriptionApi';
import { useAuth } from './useAuth';

export function useSubscription() {
  const { data: auth } = useAuth();
  return useQuery({
    queryKey: ['subscription'],
    queryFn: subscriptionApi.status,
    enabled: !!auth?.user,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useRedeemToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => subscriptionApi.redeem(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscription'] }),
  });
}
