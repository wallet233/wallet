import { Request, Response } from 'express';
import { executeDustRecovery } from './recovery.service.js';

export async function recoverDust(req: Request, res: Response) {
  try {
    const address = req.body.walletAddress || req.query.address;

    if (!address || !address.startsWith('0x')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Valid EVM walletAddress required' 
      });
    }

    const data = await executeDustRecovery(address);
    res.status(200).json(data);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
