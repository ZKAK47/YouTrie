
// validate a request to move a video in a playlist
export const validateVideoMove = (req, res, next) => {
  const { playlistItemId, playlistId, videoId, position, newPosition } = req.body;
  
  const errors = [];

  // checks if every required params are there
  if (!playlistItemId) errors.push('playlistItemId is required');
  if (!playlistId) errors.push('playlistId is required');
  if (!videoId) errors.push('videoId is required');
  
  if (newPosition === undefined || newPosition === null) {
    errors.push('newPosition is required');
  } else if (isNaN(parseInt(newPosition))) {
    errors.push('newPosition must be a number');
  }

  if (position === undefined || position === null) {
    errors.push('position is required');
  } else if (isNaN(parseInt(newPosition))) {
    errors.push('position must be a number');
  }

  // if at least one required param is missing : cancel the request
  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors
    });
  }

  next();
};

// validate a playlistId (not fully implemented yet)
export const validatePlaylistId = (req, res, next) => {
  const { playlistId } = req.params;
  
  // make sure the playlistId fits YouTube API's Id standards
  if (!playlistId || !playlistId.match(/^[A-Za-z0-9_-]+$/)) {
    return res.status(400).json({
      error: 'Invalid playlist ID format'
    });
  }

  next();
};