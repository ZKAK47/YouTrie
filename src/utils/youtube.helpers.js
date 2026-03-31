import { LCSHelper } from "./LCSHelper.js";

// Move all your simplification functions here
export const youtubeHelpers = {
    simplifyPlaylists(items) {
      if (!Array.isArray(items)) return [];
      return items.map(item => ({
        playlistId: item.id,
        title: item.snippet?.title || '',
        itemCount: item.contentDetails?.itemCount || 0,
        thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || '',
        channelId: item.snippet?.channelId
      })).filter(Boolean);
    },
  
    simplifyPlaylistItems(items) {
      if (!Array.isArray(items)) return [];
      if (!items.length) return [];
    
      const results = [];
    
      for (const item of items) {
        const { id, snippet, contentDetails } = item;
    
        if (!snippet) continue;
    
        const { title, thumbnails, position, videoOwnerChannelTitle, publishedAt, playlistId } = snippet;
        const videoId = contentDetails?.videoId || null;
        const note = contentDetails?.note || null;
        const img = thumbnails?.high?.url || thumbnails?.default?.url || "";
    
        results.push({
          playlistItemId: id,
          playlistId,
          videoId,
          title,
          thumbnail: img,
          position,
          insertedAt:publishedAt,
          channelTitle: videoOwnerChannelTitle,
          ...(note && {note})
        });
      }
    
      return results.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    },
  
    simplifyVideos(videos) {
      if (!Array.isArray(videos)) return [];
      if (!videos.length) return [];
    
      const results = [];
    
      for (const video of videos) {
        const { id, snippet, contentDetails, statistics, status } = video;
    
        if (!snippet) continue;
    
        const { title, thumbnails, publishedAt, channelTitle } = snippet;
        const img = thumbnails?.high?.url || thumbnails?.default?.url || "";
    
        results.push({
          videoId:id,
          title,
          thumbnail: img,
          publishedAt,
          channelTitle,
          commentCount: statistics?.commentCount ? parseInt(statistics.commentCount) : 0,
          viewCount: statistics?.viewCount ? parseInt(statistics.viewCount) : 0,
          likeCount: statistics?.likeCount ? parseInt(statistics.likeCount) : 0,
          dislikeCount: statistics?.dislikeCount ? parseInt(statistics.dislikeCount) : 0,
          duration: contentDetails?.duration ? parseDuration(contentDetails.duration) : 0,
          ...getBlockedReason(video)
        });
      }
    
      return results;
    },
  
    putVideosInMap(videos, map) {
      videos.forEach(v => map.set(v.videoId, v));
    },
  
    fillPlaylistVideos(items, videoMap) {
      const result = []
      for (const item of items) {
        const videoData = videoMap.get(item.videoId) || {}
        if (Object.keys(videoData).length === 0) {
          videoData.blocked = true
          videoData.restriction = item.title
          videoData.bcategory = 'missing'
        }
        const merged = {
          ...item,
          ...videoData
        }
        result.push(merged)
      }
      return result
    },

    getVideosToMove(allVideos, videosToMove, finalPosition) {
    
      const moveLists = LCSHelper.findArrayMoveDiff([...allVideos.map(e=>e.playlistItemId)],[...videosToMove.map(e=>e.playlistItemId)],finalPosition)
    
      const minimumVideosToMove = this.translateMoveListToVideoToMoves(allVideos,moveLists.moves)
    
      return minimumVideosToMove
    
    },
    
    translateMoveListToVideoToMoves(videos,moveLists) {
      const videoByPlaylistItemId = new Map()
      const result = []
      for (let video of videos) {
        const {playlistItemId} = video
        videoByPlaylistItemId.set(playlistItemId,video)
      }
      for (const move of moveLists) {
        const playlistItemId = move.element
        const video = videoByPlaylistItemId.get(playlistItemId)
        video.newPosition = move.to
        result.push(video)
      }
      return result
    }
};

function parseDuration(isoDuration) {
  // Convertit PT#H#M#S en secondes
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || 0);
  const minutes = parseInt(match[2] || 0);
  const seconds = parseInt(match[3] || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function getBlockedReason(videoData) {
  // Default return object
  const result = {
    blocked: false,
    restriction: null,
    bdetails: null,
    bcategory: null
  };

  if (!videoData) {
    result.restriction = 'No video data';
    result.blocked = true;
    result.bcategory = 'data';
    return result;
  }

  const { status, contentDetails } = videoData;
  if (!status) {
    result.restriction = 'No status information';
    result.blocked = true;
    result.bcategory = 'unknown';
    return result;
  }

  const { uploadStatus, privacyStatus, rejectionReason, failureReason } = status;

  // 1. Upload Status Checks
  if (uploadStatus !== 'processed') {
    const reasons = {
      'uploaded': { msg: 'Video is still processing', block: false },
      'rejected': { 
        msg: `Rejected: ${rejectionReason || failureReason || 'Unknown reason'}`,
        block: true 
      },
      'failed': { 
        msg: `Upload failed: ${failureReason || 'Unknown error'}`,
        block: true 
      },
      'deleted': { msg: 'Video was deleted', block: true },
      'none': { msg: 'No video file', block: true }
    };

    const reason = reasons[uploadStatus] || { msg: `Upload status: ${uploadStatus}`, block: true };
    
    result.restriction = reason.msg;
    result.uploadStatus = uploadStatus
    result.blocked = reason.block;
    result.bcategory = 'upload';
    if (uploadStatus === 'rejected') {
      result.bdetails = { rejectionReason, failureReason };
    }
    return result;
  }

  // 2. Privacy Status Checks
  if (privacyStatus !== 'public') {
    const privacyReasons = {
      'private': { msg: 'Private video', block: true },
      'rejected': { 
        msg: `Blocked: ${rejectionReason || 'Policy violation'}`,
        block: true 
      }
    };

    const reason = privacyReasons[privacyStatus] || { 
      msg: `Privacy: ${privacyStatus}`, 
      block: true 
    };

    result.restriction = reason.msg;
    result.blocked = reason.block;
    result.bcategory = 'privacy';
    return result;
  }

  // 3. Age Restriction
  if (contentDetails?.contentRating?.ytRating === 'ytAgeRestricted') {
    result.restriction = 'Age restricted';
    result.blocked = true; // Blocked for anonymous/underage users
    result.bcategory = 'age';
    return result;
  }

  // 4. Copyright Takedowns
  if (uploadStatus === 'rejected' && rejectionReason === 'copyright') {
    result.restriction = 'Copyright takedown';
    result.blocked = true;
    result.bcategory = 'copyright';
    return result;
  }

  // 5. Scheduled Videos
  if (status.publishAt && new Date(status.publishAt) > new Date()) {
    result.restriction = `Scheduled for ${new Date(status.publishAt).toLocaleString()}`;
    result.blocked = true;
    result.bcategory = 'schedule';
    return result;
  }

  // 6. Region Restrictions (if you decide to keep it)
  if (contentDetails?.regionRestriction) {
    const { allowed, blocked } = contentDetails.regionRestriction;
    if (allowed && allowed.length > 0) {
      result.restriction = `Region restricted (only in: ${allowed.join(', ')})`;
      result.bcategory = 'region';
      result.bdetails = { allowedCountries: allowed };
      return result;
    }
    if (blocked && blocked.length > 0) {
      result.restriction = `Region blocked (blocked in: ${blocked.join(', ')})`;
      result.bcategory = 'region';
      result.bdetails = { blockedCountries: blocked };
      return result;
    }
  }

  // 7. Content ID Claims (NOT a blocking reason, just info)
  if (contentDetails?.licensedContent) {
    result.restriction = 'Monetized via Content ID';
    result.blocked = false; // Content ID claims don't block videos
    result.bcategory = 'copyright';
    return result;
  }

  // Video is available
  return result;
}