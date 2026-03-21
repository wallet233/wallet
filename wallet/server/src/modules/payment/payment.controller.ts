import { Request, Response } from 'express';
import { paymentService } from './payment.service.js';
import { apiService } from './api.service.js';

export async function startPayment(req: Request, res: Response) {
  try {
    const { wallet, amount, chain } = req.body;
    const intent = await paymentService.createIntent(wallet, amount, chain);
    res.json({ success: true, wip_id: intent.id });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function confirmPayment(req: Request, res: Response) {
  try {
    const { wip_id, txHash } = req.body;
   
    const confirmed = await paymentService.verifyOnChain(wip_id, txHash);
    
    // Auto-generate API key for the wallet
    await apiService.generateKey(confirmed.wallet, "PRO_PLAN");

    res.json({ success: true, status: 'confirmed', data: confirmed });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}
