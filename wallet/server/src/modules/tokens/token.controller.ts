import { Request, Response } from 'express';
import { tokenService } from './token.service.js';
import { logger } from '../../utils/logger.js';

/**
 * Premium Token Controller
 * Serves categorized asset data with real-time classification.
 */
export async function scanTokensController(req: Request, res: Response) {
  const address = (req.query.address || req.body.address) as string;

  try {
    if (!address || !address.startsWith('0x')) {
      return res.status(400).json({ 
        success: false, 
        error: 'A valid EVM wallet address is required' 
      });
    }

    logger.info(`[TokenController] Scanning tokens for: ${address}`);
    
    // Use the correctly named service function
    const report = await tokenService.fetchWalletTokens(address);

    res.status(200).json({
      success: true,
      wallet: address,
      timestamp: new Date().toISOString(),
      data: report
    });
  } catch (err: any) {
    logger.error(`[TokenController] ${err.message}`);
    res.status(500).json({ success: false, error: 'Token scan failed' });
  }
}
