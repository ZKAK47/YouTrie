import { Router } from 'express';
import { videoController } from '../controllers/videos.controller.js';
import { validateSession } from '../middleware/auth.middleware.js';
import { validateVideoMove } from '../middleware/validation.middleware.js';

const router = Router();

// All video routes require authentication
router.use(validateSession);

router.post('/move', validateVideoMove, videoController.moveSingle);
router.post('/move-batch', videoController.moveBatch);

export default router;