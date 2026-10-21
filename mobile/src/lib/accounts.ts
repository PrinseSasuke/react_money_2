// The user's react-money accounts (core-api GET /api/accounts), for the account choice on the receipt card.
import { useQuery } from "@tanstack/react-query";
import { coreFetch } from "@/api/fetcher";

export interface Account {
  id: string;
  name: string;
  currency: string;
}

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: () => coreFetch<Account[]>("/api/accounts"),
    staleTime: 5 * 60_000,
  });
}
