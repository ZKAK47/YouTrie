import { youtubeService } from '../services/youtube.service.js';
import { cacheService } from '../services/cache.service.js';
import { oauthStore } from '../database/oauth-store.js';
import { prod_tt_sasportal } from 'googleapis/build/src/apis/prod_tt_sasportal/index.js';
import { getPatch } from 'fast-array-diff';
import arrayDiff from 'arraydiff';
import { youtubeHelpers } from '../utils/youtube.helpers.js';

export const videoController = {
  moveSingle: async (req, res) => {
    const { playlistItemId, playlistId, videoId, newPosition, note } = req.body;
    const {userId, oauth2Client} = req.userObject

    const client = oauth2Client;
    
    const youtube = youtubeService.createClient(client);
    
    // Move on YouTube
    await youtubeService.moveVideo(youtube, {
      playlistItemId, playlistId, videoId, newPosition, note
    });
    
    // Update local cache
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

    console.log(videosToMove)
    
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

function losslessMove(array, index, newPosition) {
  const clone = [...array]
  if (index === newPosition) return clone
  // Ajuster newPosition si on déplace vers la droite
  const adjustedPos = index < newPosition ? newPosition - 1 : newPosition
  const [indexedEl] = clone.splice(index, 1)
  clone.splice(adjustedPos, 0, indexedEl)
  return clone
}