import express from 'express';
import { startPayment, confirmPayment } from './payment.controller.js';

const paymentRouter = express.Router();

paymentRouter.post('/intent', startPayment);
paymentRouter.post('/confirm', confirmPayment);

export const paymentRoutes = {
  path: '/payment',
  router: paymentRouter,
};
