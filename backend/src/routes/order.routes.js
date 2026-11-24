import { Router } from 'express';
import * as orderController from '../controllers/order.controller.js';
import { protect, requireVerifiedEmail } from '../middleware/auth.middleware.js';
import { uploadGeneral, handleMulterError } from '../middleware/upload.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { paymentLimiter } from '../middleware/rateLimiter.js';
import {
  placeOrderSchema,
  declineOrderSchema,
  listOrdersSchema,
  deliverOrderSchema,
  requestRevisionSchema,
  completeOrderSchema,
  reportOrderSchema,
} from '../validations/order.validation.js';

const router = Router();

router.use(protect);

router.get('/', validate(listOrdersSchema, 'query'), orderController.listOrders);
router.get('/stats', orderController.getOrderStats);
router.post(
  '/',
  requireVerifiedEmail,
  handleMulterError(uploadGeneral),
  validate(placeOrderSchema),
  orderController.placeOrder
);
router.get('/:orderId', orderController.getOrder);
router.post('/:orderId/fund', paymentLimiter, orderController.fundOrder);
router.post('/:orderId/accept', paymentLimiter, orderController.acceptOrder);
router.post('/:orderId/decline', paymentLimiter, validate(declineOrderSchema), orderController.declineOrder);
router.post('/:orderId/cancel', orderController.cancelOrder);
router.post(
  '/:orderId/deliver',
  handleMulterError(uploadGeneral),
  validate(deliverOrderSchema),
  orderController.deliverOrder
);
router.post('/:orderId/request-revision', validate(requestRevisionSchema), orderController.requestRevision);
router.post('/:orderId/complete', paymentLimiter, validate(completeOrderSchema), orderController.completeOrder);
router.post('/:orderId/report', validate(reportOrderSchema), orderController.reportOrder);

export default router;
