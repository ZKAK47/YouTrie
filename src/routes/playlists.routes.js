import { Router } from 'express';
import { playlistController } from '../controllers/playlists.controller.js';
import { validateSession } from '../middleware/auth.middleware.js';

const router = Router();

// All playlist routes require authentication
router.use(validateSession);

router.get('/', playlistController.getAll);
router.get('/:playlistId/videos', playlistController.getVideos);

export default router;