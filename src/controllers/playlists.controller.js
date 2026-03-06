import { youtubeService } from '../services/youtube.service.js';
import { cacheService } from '../services/cache.service.js';
import { oauthStore } from '../database/oauth-store.js';
import { AppError } from '../utils/errors.js';

export const playlistController = {
  getAll: async (req, res) => {

    const {oauth2Client} = req.userObject

    const client = oauth2Client;
    const youtube = youtubeService.createClient(client);

    const playlists = await youtubeService.getPlaylists(youtube);
    
    // Cache by channel ID
    const channelId = playlists[0]?.channelId;
    if (channelId) {
      await cacheService.save('playlists', channelId, playlists);
    }

    res.json(playlists);
  },

  getVideos: async (req, res) => {
    const { playlistId } = req.params;
    const { forcedUpdate } = req.query;

    console.log(playlistId)
    
    const {userId, oauth2Client} = req.userObject

    const client = oauth2Client;
    
    // Check cache
    if (!forcedUpdate) {
      const cached = await cacheService.loadPlaylistVideos(playlistId, userId);
      if (cached) {
        return res.json(cached);
      }
    }

    const youtube = youtubeService.createClient(client);
    const videos = await youtubeService.getPlaylistVideos(youtube, playlistId);
    
    // Save to cache
    await cacheService.savePlaylistVideos(playlistId, userId, videos);

    res.json(videos);
  }
};