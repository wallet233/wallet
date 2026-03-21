import { fetchWalletTokens } from '../tokens/token.service.js';
import { getProvider } from '../../blockchain/provider.js';
import { EVM_CHAINS } from '../../blockchain/chains.js';
import { formatUnits, parseUnits } from 'ethers';

export async function detectDustTokens(walletAddress: string) {
  // 1. Get ALL tokens from our multi-chain scanner
  const report = await fetchWalletTokens(walletAddress);
  const assets = report.assets;

  const dustAssets = await Promise.all(assets.map(async (asset) => {
    try {
      const chain = EVM_CHAINS.find(c => c.name === asset.chain);
      if (!chain || asset.type !== 'erc20' || asset.status === 'spam') return null;

      // 2. Fetch LIVE Gas Price for this specific chain
      const provider = getProvider(chain.rpc);
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice ?? parseUnits('20', 'gwei');
      
      // A swap + transfer takes roughly 250k gas
      const rescueCost = gasPrice * 250000n;
      const assetValue = parseUnits(asset.balance, 18); // Simplified scaling

      // 3. Identification: If value > gas but < 0.05 native, it's "Rescue Dust"
      const upperThreshold = parseUnits('0.05', 18);
      
      if (assetValue > rescueCost && assetValue < upperThreshold) {
        return {
          ...asset,
          rescueCost: formatUnits(rescueCost, 18),
          profitable: true
        };
      }
      return null;
    } catch { return null; }
  }));

  return dustAssets.filter(Boolean);
}
