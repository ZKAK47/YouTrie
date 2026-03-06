import { Router } from 'express';
import authRoutes from './auth.routes.js';
import playlistRoutes from './playlists.routes.js';
import videoRoutes from './videos.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/playlists', playlistRoutes);
router.use('/videos', videoRoutes);

export default router;