import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';

const router = Router();

router.get('/', authController.initiate);
router.get('/callback', authController.callback);
router.get('/status', authController.status);
router.post('/logout', authController.logout);

export default router;