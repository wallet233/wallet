export type TokenAddress = string;
export type ChainName = string;

export interface Asset {
  chain: ChainName;
  symbol: string;
  name: string;
  balance: string;  
  rawBalance: string; 
  decimals: number;
  type: 'native' | 'erc20';
  contract: TokenAddress | null;
  logo: string | null;
  usdValue: number;
  status: 'verified' | 'spam' | 'dust' | 'clean';
}

export interface WalletScanResult {
  wallet: string;
  timestamp: string;
  latency: string;
  summary: {
    totalAssets: number;
    totalUsdValue: number;
    spamCount: number;
    dustCount: number;
  };
  groups: {
    clean: Asset[];
    dust: Asset[];
    spam: Asset[];
  };
  all: Asset[];
}
