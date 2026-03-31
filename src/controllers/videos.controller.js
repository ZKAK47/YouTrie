import { youtubeService } from '../services/youtube.service.js';
import { cacheService } from '../services/cache.service.js';
import { youtubeHelpers } from '../utils/youtube.helpers.js';

export const videoController = {
  moveSingle: async (req, res) => {
    const { playlistItemId, playlistId, videoId, newPosition, note } = req.body;
    const {userId, oauth2Client} = req.userObject

    const client = oauth2Client;
    
    const youtube = youtubeService.createClient(client);
    
    // Move the video (and update it's note) on YouTube
    await youtubeService.moveVideo(youtube, {
      playlistItemId, playlistId, videoId, newPosition, note
    });
    
    // Update local cache to avoid waste of API quota on large playlists
    await cacheService.moveVideoInPlaylist(playlistId, userId, {
      playlistItemId, newPosition, note
    });

    res.json({ success: true });
  },

  moveBatch: async (req, res) => {
    const { version } = req.body;
    if (version !== "v0.5") {
      return videoController.moveBatch2(req, res)
    }
    const { playlistId, videos, finalPosition } = req.body;
    const {userId, oauth2Client} = req.userObject

    const client = oauth2Client;
    
    const youtube = youtubeService.createClient(client);
    
    const result = await youtubeService.moveVideos(youtube, playlistId, videos, {version});
    
    // Update cache for each video
    for (const video of videos) {
      await cacheService.moveVideoInPlaylist(playlistId, userId, {
        playlistItemId: video.playlistItemId,
        newPosition: video.newPosition,
        note: video.note
      });
    }

    res.json(result);
  },

  moveBatch2: async (req, res) => {
    const { playlistId, videos, finalPosition } = req.body;
    const {userId, oauth2Client} = req.userObject

    const client = oauth2Client;
    
    const youtube = youtubeService.createClient(client);
    
    const wholePlayList = await cacheService.loadPlaylistVideos(playlistId, userId);

    const movedIndexes = []

    for (let video of videos) {
      movedIndexes.push(Number(video.position))
    }

    const videosToMove = youtubeHelpers.getVideosToMove(wholePlayList, videos, finalPosition)
    
    const result = await youtubeService.moveVideos(youtube, playlistId, videosToMove);
    
    // Update cache for each video
    for (const video of videosToMove) {
      if (video.newPosition)
      await cacheService.moveVideoInPlaylist(playlistId, userId, {
        playlistItemId: video.playlistItemId,
        newPosition: video.newPosition,
        note: video.note
      });
    }

    res.json(result);
  }
};

// move element at index "index" to a new index by taking account of the offset after it's temporary removal
function losslessMove(array, index, newPosition) {
  const clone = [...array] // avoid original array mutations

  if (index === newPosition) return clone // the element is already at it's correct position

  // removing an element offsets every others (next) element in the right by -1
  const adjustedPos = index < newPosition ? newPosition - 1 : newPosition

  const [indexedEl] = clone.splice(index, 1) // remove and store the element

  clone.splice(adjustedPos, 0, indexedEl) // push the element at the correct position
  return clone
}