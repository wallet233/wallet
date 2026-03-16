const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export interface SwapResult {
  success: boolean;
  message?: string;
}

export async function fetchWalletTokens(walletAddress: string) {
  try {
    const res = await fetch(`${API_BASE}/wallet/${walletAddress}/tokens`);
    return await res.json(); // Expected: TokenType[]
  } catch (err) {
    console.error("Fetch wallet tokens failed:", err);
    return [];
  }
}

export async function executeManualSwap(walletAddress: string): Promise<SwapResult> {
  try {
    const res = await fetch(`${API_BASE}/tokens/manual-swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress }),
    });
    const data = await res.json();
    return { success: data.success, message: data.message };
  } catch (err) {
    console.error("Manual swap failed:", err);
    return { success: false, message: String(err) };
  }
}

export async function executeAutoSwap(walletAddress: string): Promise<SwapResult> {
  try {
    const res = await fetch(`${API_BASE}/tokens/auto-swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress }),
    });
    const data = await res.json();
    return { success: data.success, message: data.message };
  } catch (err) {
    console.error("Auto swap failed:", err);
    return { success: false, message: String(err) };
  }
}
