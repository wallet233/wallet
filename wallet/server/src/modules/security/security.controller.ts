import { Request, Response } from 'express';
import { isAddress } from 'ethers';
import { securityService } from './security.service.js';
import { logger } from '../../utils/logger.js';

export async function scanSecurityController(req: Request, res: Response) {
  const address = (req.query.address || req.body.address) as string;
  const network = (req.query.network || 'ethereum') as string;

  try {
    if (!address || !isAddress(address)) {
      return res.status(400).json({ success: false, error: 'Valid wallet address required' });
    }

    logger.info(`[SecurityController] Scanning risk for: ${address}`);
    const allowances = await securityService.scanApprovals(address, network);

    return res.status(200).json({
      success: true,
      wallet: address.toLowerCase(),
      network,
      riskReport: {
        totalApprovals: allowances.length,
        highRiskCount: allowances.filter(a => a.riskLevel === 'HIGH').length,
        allowances
      }
    });
  } catch (err: any) {
    logger.error(`[SecurityController] ${err.message}`);
    res.status(500).json({ success: false, error: 'Security scan failed' });
  }
}
