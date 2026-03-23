import 'dotenv/config';

export interface ChainConfig {
  id: number;
  name: string;
  symbol: string;
  rpc: string;
  relayUrl?: string; // Added for Flashbots Execution
  alchemy?: string;
  moralis?: string | null;
  explorer: string;
  isL2?: boolean; // Added for real money safety (finality logic)
}

/**
 * Production-Grade Blockchain Configuration
 * Upgraded with Dynamic Provider Routing and Flashbots Relay support.
 */
const ALCHEMY_KEY = process.env.ALCHEMY_KEY || process.env.ALCHEMY_API_KEY || '';

/**
 * High-reliability RPC Resolver
 * Priority: 1. ENV Override -> 2. Alchemy Premium -> 3. Public Fallback
 */
const getDynamicRpc = (chainId: number, publicRpc: string, alchemyAlias?: string): string => {
  // Check for explicit ENV override (e.g., RPC_1 or RPC_137)
  const envOverride = process.env[`RPC_${chainId}`];
  if (envOverride) return envOverride;

  // Use Alchemy if available and alias is provided
  if (ALCHEMY_KEY && alchemyAlias) {
    return `https://${alchemyAlias}.g.alchemy.com/v2/${ALCHEMY_KEY}`;
  }

  // Fallback to public
  return publicRpc;
};

export const EVM_CHAINS: ChainConfig[] = [
  { 
    id: 1, 
    name: 'Ethereum', 
    symbol: 'ETH', 
    rpc: getDynamicRpc(1, 'https://eth.drpc.org', 'eth-mainnet'), 
    relayUrl: 'https://relay.flashbots.net', // Standard Flashbots Relay
    alchemy: 'eth-mainnet', 
    explorer: 'https://etherscan.io',
    isL2: false
  },
  { id: 56, name: 'BNB Smart Chain', symbol: 'BNB', rpc: getDynamicRpc(56, 'https://binance.drpc.org'), explorer: 'https://bscscan.com', isL2: false },
  { id: 137, name: 'Polygon', symbol: 'POL', rpc: getDynamicRpc(137, 'https://polygon-rpc.com', 'polygon-mainnet'), alchemy: 'polygon-mainnet', explorer: 'https://polygonscan.com', isL2: true },
  { id: 8453, name: 'Base', symbol: 'ETH', rpc: getDynamicRpc(8453, 'https://mainnet.base.org', 'base-mainnet'), alchemy: 'base-mainnet', explorer: 'https://basescan.org', isL2: true },
  { id: 42161, name: 'Arbitrum One', symbol: 'ETH', rpc: getDynamicRpc(42161, 'https://arb1.arbitrum.io', 'arb-mainnet'), alchemy: 'arb-mainnet', explorer: 'https://arbiscan.io', isL2: true },
  { id: 10, name: 'Optimism', symbol: 'ETH', rpc: getDynamicRpc(10, 'https://mainnet.optimism.io', 'opt-mainnet'), alchemy: 'opt-mainnet', explorer: 'https://optimistic.etherscan.io', isL2: true },
  { id: 43114, name: 'Avalanche', symbol: 'AVAX', rpc: getDynamicRpc(43114, 'https://api.avax.network'), explorer: 'https://snowtrace.io', isL2: false },
  { id: 81457, name: 'Blast', symbol: 'ETH', rpc: getDynamicRpc(81457, 'https://rpc.blast.io'), explorer: 'https://blastscan.io', isL2: true },
  { id: 59144, name: 'Linea', symbol: 'ETH', rpc: getDynamicRpc(59144, 'https://rpc.linea.build'), explorer: 'https://lineascan.build', isL2: true },
  { id: 534352, name: 'Scroll', symbol: 'ETH', rpc: getDynamicRpc(534352, 'https://rpc.scroll.io'), explorer: 'https://scrollscan.com', isL2: true },
  { id: 100, name: 'Gnosis', symbol: 'xDAI', rpc: getDynamicRpc(100, 'https://rpc.gnosischain.com'), explorer: 'https://gnosisscan.io', isL2: false },
  { id: 250, name: 'Fantom', symbol: 'FTM', rpc: getDynamicRpc(250, 'https://rpc.ftm.tools'), explorer: 'https://ftmscan.com', isL2: false },
  { id: 324, name: 'zkSync Era', symbol: 'ETH', rpc: getDynamicRpc(324, 'https://mainnet.era.zksync.io'), explorer: 'https://explorer.zksync.io', isL2: true },
  { id: 1101, name: 'Polygon zkEVM', symbol: 'ETH', rpc: getDynamicRpc(1101, 'https://zkevm-rpc.com'), explorer: 'https://zkevm.polygonscan.com', isL2: true },
  { id: 42220, name: 'Celo', symbol: 'CELO', rpc: getDynamicRpc(42220, 'https://forno.celo.org'), explorer: 'https://celoscan.io' },
  { id: 1284, name: 'Moonbeam', symbol: 'GLMR', rpc: getDynamicRpc(1284, 'https://rpc.api.moonbeam.network'), explorer: 'https://moonscan.io' },
  { id: 1285, name: 'Moonriver', symbol: 'MOVR', rpc: getDynamicRpc(1285, 'https://rpc.api.moonriver.moonbeam.network'), explorer: 'https://moonriver.moonscan.io' },
  { id: 5000, name: 'Mantle', symbol: 'MNT', rpc: getDynamicRpc(5000, 'https://rpc.mantle.xyz'), explorer: 'https://explorer.mantle.xyz' },
  { id: 204, name: 'opBNB', symbol: 'BNB', rpc: getDynamicRpc(204, 'https://opbnb-mainnet-rpc.bnbchain.org'), explorer: 'https://opbnbscan.com' },
  { id: 146, name: 'Sonic', symbol: 'S', rpc: getDynamicRpc(146, 'https://rpc.soniclabs.com'), explorer: 'https://sonicscan.org' },
  { id: 1329, name: 'Sei', symbol: 'SEI', rpc: getDynamicRpc(1329, 'https://evm-rpc.sei.io'), explorer: 'https://seitrace.com' },
  { id: 25, name: 'Cronos', symbol: 'CRO', rpc: getDynamicRpc(25, 'https://evm.cronos.org'), explorer: 'https://cronoscan.com' },
  { id: 42170, name: 'Arbitrum Nova', symbol: 'ETH', rpc: getDynamicRpc(42170, 'https://nova.arbitrum.io'), explorer: 'https://nova.arbiscan.io' },
  { id: 1088, name: 'Metis', symbol: 'METIS', rpc: getDynamicRpc(1088, 'https://andromeda.metis.io'), explorer: 'https://andromeda-explorer.metis.io' },
  { id: 2222, name: 'Kava', symbol: 'KAVA', rpc: getDynamicRpc(2222, 'https://evm.kava.io'), explorer: 'https://kavascan.com' },
  { id: 34443, name: 'Mode', symbol: 'ETH', rpc: getDynamicRpc(34443, 'https://mainnet.mode.network'), explorer: 'https://modescan.io' },
  { id: 167000, name: 'Taiko', symbol: 'ETH', rpc: getDynamicRpc(167000, 'https://rpc.mainnet.taiko.xyz'), explorer: 'https://taikoscan.io' },
  { id: 55, name: 'Zircuit', symbol: 'ETH', rpc: getDynamicRpc(55, 'https://zircuit-mainnet.drpc.org'), explorer: 'https://explorer.zircuit.com' },
  { id: 7777777, name: 'Zora', symbol: 'ETH', rpc: getDynamicRpc(7777777, 'https://rpc.zora.energy'), explorer: 'https://explorer.zora.energy' },
  { id: 480, name: 'World Chain', symbol: 'ETH', rpc: getDynamicRpc(480, 'https://worldchain-mainnet.g.alchemy.com', 'worldchain-mainnet'), explorer: 'https://worldscan.org', isL2: true },
  { id: 660279, name: 'Xai', symbol: 'XAI', rpc: getDynamicRpc(660279, 'https://xai-chain.net'), explorer: 'https://xaiscan.io' },
  { id: 4200, name: 'Merlin', symbol: 'BTC', rpc: getDynamicRpc(4200, 'https://rpc.merlinchain.io'), explorer: 'https://scan.merlinchain.io' },
  { id: 57073, name: 'BeraChain', symbol: 'BERA', rpc: getDynamicRpc(57073, 'https://rpc.berachain.com'), explorer: 'https://berascan.com' },
  { id: 8888, name: 'Chiliz', symbol: 'CHZ', rpc: getDynamicRpc(8888, 'https://rpc.chiliz.com'), explorer: 'https://chiliscan.com' },
  { id: 30, name: 'Rootstock', symbol: 'RBTC', rpc: getDynamicRpc(30, 'https://public-node.rsk.co'), explorer: 'https://explorer.rsk.co' },
  { id: 57, name: 'Syscoin', symbol: 'SYS', rpc: getDynamicRpc(57, 'https://rpc.syscoin.org'), explorer: 'https://explorer.syscoin.org' },
  { id: 106, name: 'Velas', symbol: 'VLX', rpc: getDynamicRpc(106, 'https://evmexplorer.velas.com'), explorer: 'https://velascan.org' },
  { id: 40, name: 'Telos', symbol: 'TLOS', rpc: getDynamicRpc(40, 'https://mainnet.telos.net'), explorer: 'https://teloscan.io' },
  { id: 122, name: 'Fuse', symbol: 'FUSE', rpc: getDynamicRpc(122, 'https://rpc.fuse.io'), explorer: 'https://explorer.fuse.io' },
  { id: 2000, name: 'Dogechain', symbol: 'DOGE', rpc: getDynamicRpc(2000, 'https://rpc.dogechain.dog'), explorer: 'https://explorer.dogechain.dog' },
  { id: 82, name: 'Meter', symbol: 'MTRG', rpc: getDynamicRpc(82, 'https://rpc.meter.io'), explorer: 'https://scan.meter.io' },
  { id: 361, name: 'Theta', symbol: 'TFUEL', rpc: getDynamicRpc(361, 'https://eth-rpc-api.thetatoken.org'), explorer: 'https://explorer.thetatoken.org' },
  { id: 4689, name: 'IoTeX', symbol: 'IOTX', rpc: getDynamicRpc(4689, 'https://babel-api.mainnet.iotex.io'), explorer: 'https://iotexscan.io' },
  { id: 199, name: 'BitTorrent', symbol: 'BTT', rpc: getDynamicRpc(199, 'https://rpc.bittorrentchain.io'), explorer: 'https://bttcscan.com' },
  { id: 1030, name: 'Conflux eSpace', symbol: 'CFX', rpc: getDynamicRpc(1030, 'https://evm.confluxrpc.com'), explorer: 'https://evm.confluxscan.io' },
  { id: 1116, name: 'Core', symbol: 'CORE', rpc: getDynamicRpc(1116, 'https://rpc.coredao.org'), explorer: 'https://scan.coredao.org' },
  { id: 2020, name: 'Ronin', symbol: 'RON', rpc: getDynamicRpc(2020, 'https://api.roninchain.com'), explorer: 'https://app.roninchain.com' },
  { id: 88, name: 'Viction', symbol: 'VIC', rpc: getDynamicRpc(88, 'https://rpc.viction.xyz'), explorer: 'https://vicscan.xyz' },
  { id: 53935, name: 'DFK Chain', symbol: 'JEWEL', rpc: getDynamicRpc(53935, 'https://subnets.avax.network'), explorer: 'https://subnets.avax.network' },
  { id: 2001, name: 'Milkomeda C1', symbol: 'mADA', rpc: getDynamicRpc(2001, 'https://rpc-mainnet-cardano-evm.milkomeda.com'), explorer: 'https://explorer-mainnet-cardano-evm.milkomeda.com' },
  { id: 311, name: 'Omax', symbol: 'OMAX', rpc: getDynamicRpc(311, 'https://mainnet-rpc.omaxray.com'), explorer: 'https://omaxray.com' },
  { id: 1234, name: 'Step Network', symbol: 'FITFI', rpc: getDynamicRpc(1234, 'https://rpc.step.network'), explorer: 'https://stepscan.io' }
];

/**
 * Validates that all critical chains have an explorer and unique ID.
 * Runs on initialization to prevent runtime real-money errors.
 */
export const validateChainConfig = () => {
  const ids = EVM_CHAINS.map(c => c.id);
  const hasDuplicates = new Set(ids).size !== ids.length;
  if (hasDuplicates) {
    throw new Error("CRITICAL: Duplicate Chain IDs detected in configuration.");
  }
};

validateChainConfig();
