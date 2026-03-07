import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';

const router = Router();

router.get('/', authController.initiate); // Login
router.get('/callback', authController.callback); // Login results
router.get('/status', authController.status); // check if the user is already logged in
router.post('/logout', authController.logout); // Log out the user

export default router;