import { google } from 'googleapis';
import { youtubeHelpers } from '../utils/youtube.helpers.js';
import { AppError } from '../utils/errors.js';

class YouTubeService {
  // create a YouTube Client with a logged in Google Account
  createClient(oauth2Client) {
    return google.youtube({ version: 'v3', auth: oauth2Client });
  }

  // fetch an user's playlists
  async getPlaylists(youtube) {
    try {
      const response = await youtube.playlists.list({
        part: ['snippet', 'contentDetails'],
        mine: true,
        maxResults: 50
      });
      
      return youtubeHelpers.simplifyPlaylists(response.data.items);
    } catch (error) {
      throw this._handleError(error);
    }
  }

  // fetch the videos of an user's playlist, YouTube API's pagination makes it quite time-consuming
  async getPlaylistVideos(youtube, playlistId) {
    let allVideos = [];
    let nextPageToken = null;
    const videoMap = new Map();

    // process the 50 (YouTube API's max results limit) next videos of the playlist until it is empty
    do {
      const itemsResponse = await youtube.playlistItems.list({
        part: ['snippet', 'contentDetails'],
        playlistId,
        maxResults: 50,
        pageToken: nextPageToken
      });

      const items = itemsResponse.data.items || [];

      // simplifie YouTube's playlistItems format into a flat format 
      const simplifiedItems = youtubeHelpers.simplifyPlaylistItems(items);

      // get video ids to get remaining useful properties such as duration and channels
      const videoIds = items
        .map(item => item.contentDetails?.videoId)
        .filter(Boolean)
        .join(',');

      if (videoIds?.length) {
        // make the second call for additional properties
        const videosResponse = await youtube.videos.list({
          part: ['snippet', 'contentDetails', 'statistics', 'status'],
          id: videoIds // comma-separated list of videoIds in the same order the playlistItems were received
        });

        // simplifie YouTube's video format into a flat format
        const simplifiedVideos = youtubeHelpers.simplifyVideos(videosResponse.data.items || []);
        youtubeHelpers.putVideosInMap(simplifiedVideos, videoMap);
        
        // enrich the playlistItems
        const enriched = youtubeHelpers.fillPlaylistVideos(simplifiedItems, videoMap);
        allVideos.push(...enriched); // push the enriched video togethers
      }

      nextPageToken = itemsResponse.data.nextPageToken;
    } while (nextPageToken) // we process the next 50 videos until nothing are left

    return allVideos;
  }

  // moves a video (and update it's notes) to another position in a YouTube playlist
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
          ...(note && { contentDetails: { note } }) // if note is provided, we add it, or else we do not and remove it
        }
      });
      return response.data;
    } catch (error) {
      throw this._handleError(error);
    }
  }

  // moves multiple videos one by one in ascending order by new positions
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