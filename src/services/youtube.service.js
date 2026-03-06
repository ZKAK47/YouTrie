import { google } from 'googleapis';
import { youtubeHelpers } from '../utils/youtube.helpers.js';
import { AppError } from '../utils/errors.js';

class YouTubeService {
  createClient(oauth2Client) {
    console.log(oauth2Client)
    return google.youtube({ version: 'v3', auth: oauth2Client });
  }

  async getPlaylists(youtube) {
    try {
      const response = await youtube.playlists.list({
        part: ['snippet', 'contentDetails'],
        mine: true,
        maxResults: 100
      });
      
      return youtubeHelpers.simplifyPlaylists(response.data.items);
    } catch (error) {
      throw this._handleError(error);
    }
  }

  async getPlaylistVideos(youtube, playlistId) {
    let allVideos = [];
    let nextPageToken = null;
    const videoMap = new Map();

    do {
      // Get playlist items
      const itemsResponse = await youtube.playlistItems.list({
        part: ['snippet', 'contentDetails'],
        playlistId,
        maxResults: 50,
        pageToken: nextPageToken
      });

      const items = itemsResponse.data.items || [];
      const simplifiedItems = youtubeHelpers.simplifyPlaylistItems(items);

      // Get video details
      const videoIds = items
        .map(item => item.contentDetails?.videoId)
        .filter(Boolean)
        .join(',');

      if (videoIds) {
        const videosResponse = await youtube.videos.list({
          part: ['snippet', 'contentDetails', 'statistics', 'status'],
          id: videoIds
        });

        const simplifiedVideos = youtubeHelpers.simplifyVideos(videosResponse.data.items || []);
        youtubeHelpers.putVideosInMap(simplifiedVideos, videoMap);
        
        const enriched = youtubeHelpers.fillPlaylistVideos(simplifiedItems, videoMap);
        allVideos.push(...enriched);
      }

      nextPageToken = itemsResponse.data.nextPageToken;
    } while (nextPageToken);

    return allVideos;
  }

  async moveVideo(youtube, { playlistItemId, playlistId, videoId, newPosition, note = '' }) {
    try {
      const response = await youtube.playlistItems.update({
        part: ['snippet', 'contentDetails'],
        requestBody: {
          id: playlistItemId,
          snippet: {
            playlistId,
            resourceId: { kind: 'youtube#video', videoId },
            position: Number(newPosition)
          },
          ...(note && { contentDetails: { note } })
        }
      });
      return response.data;
    } catch (error) {
      throw this._handleError(error);
    }
  }

  async moveVideos(youtube, playlistId, videos) {
    const results = {
      success: true,
      failed: []
    };

    const sorted = [...videos]
      .filter(v => v.playlistId === playlistId)
      .sort((a,b) => a.newPosition - b.newPosition)

    for (const video of sorted) {
      try {
        await this.moveVideo(youtube, { ...video, playlistId });
        console.log(`a bougé ${video.title} de ${video.position} à ${video.newPosition}`)
      } catch (error) {
        results.failed.push(video);
        results.success = false;
      }
    }

    return results;
  }

  _handleError(error) {
    const status = error.code || error.response?.status;
    const reason = error.errors?.[0]?.reason;

    if (status === 401) return new AppError('Token expiré', 401, '/auth');
    if (status === 403 && reason === 'quotaExceeded') {
      return new AppError('Quota YouTube dépassé', 429);
    }
    
    return new AppError(
      error.message || 'Erreur YouTube',
      status || 500
    );
  }
}

export const youtubeService = new YouTubeService();