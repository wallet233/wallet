import { useState, useEffect, useMemo, useCallback } from "react";
import apiClient from "../services/apiClient";

export interface TokenType {
  id: string;             // unique identifier (tokenAddress or backend-provided ID)
  tokenAddress: string;
  symbol: string;
  name: string;
  balance: string;        // on-chain balance as string
  usdValue: number;       // converted USD value
  isSpam: boolean;
  chainId: number;
  isZero?: boolean;       // derived field if balance <= 0
  [key: string]: any;     // for future-proofing: accept extra backend fields
}

export const useTokens = (walletAddress?: string) => {
  const [tokens, setTokens] = useState<TokenType[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // fetch tokens from backend API
  const fetchTokens = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get(`/wallet/${walletAddress}/tokens`);
      
      // map backend response to TokenType; preserve extra fields for future-proofing
      const fetchedTokens: TokenType[] = response.data.map((t: any) => ({
        id: t.id || t.tokenAddress,
        tokenAddress: t.tokenAddress,
        symbol: t.symbol,
        name: t.name,
        balance: t.balance,
        usdValue: t.usdValue || 0,
        isSpam: t.isSpam || false,
        chainId: t.chainId || 1,
        isZero: parseFloat(t.balance) <= 0,
        ...t, // include any future backend fields dynamically
      }));

      setTokens(fetchedTokens);
    } catch (err: any) {
      console.error("Failed to fetch tokens:", err);
      setError(err?.message || "Failed to fetch tokens");
      setTokens([]);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  // auto-fetch on mount or walletAddress change
  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  // derived arrays for convenience
  const spamTokens = useMemo(() => tokens.filter(t => t.isSpam), [tokens]);
  const dustTokens = useMemo(() => tokens.filter(t => !t.isSpam && parseFloat(t.balance) > 0), [tokens]);
  const zeroTokens = useMemo(() => tokens.filter(t => t.isZero), [tokens]);
  const totalValue = useMemo(() => tokens.reduce((sum, t) => sum + t.usdValue, 0), [tokens]);

  // refresh helper for after swaps, burns, recoveries
  const refresh = () => fetchTokens();

  return {
    tokens,
    spamTokens,
    dustTokens,
    zeroTokens,
    totalValue,
    loading,
    error,
    refresh,
  };
};
