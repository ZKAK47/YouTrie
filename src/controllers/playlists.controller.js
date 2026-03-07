import { youtubeService } from '../services/youtube.service.js';
import { cacheService } from '../services/cache.service.js';

export const playlistController = {
  // fetch the user's YouTube Playlist
  getPlaylists: async (req, res) => {

    const {oauth2Client} = req.userObject

    const client = oauth2Client;
    const youtube = youtubeService.createClient(client);

    const playlists = await youtubeService.getPlaylists(youtube);
    
    // Cache the list of playlists to save some API calls (not fully implemented yet)
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

    /* 
      First, we try to find a valid version of the playlist if it's stored
      if it exists : 
        we send it in order to speed up the request (especially for large Playlists)
        and save some API calls
    */
    if (!forcedUpdate) {
      const cached = await cacheService.loadPlaylistVideos(playlistId, userId);
      if (cached) {
        return res.json(cached);
      }
    }

    // create a YouTube Client
    const youtube = youtubeService.createClient(client);

    // fetch the playlist videos using the API
    const videos = await youtubeService.getPlaylistVideos(youtube, playlistId);
    
    // Save the playlist videos to cache
    await cacheService.savePlaylistVideos(playlistId, userId, videos);

    res.json(videos);
  }
};