import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// class used to help manage the cache
class CacheService {
  constructor() {
    this.basePath = path.join(__dirname, '..', 'cache');
  }

  async _ensureDir(dir) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      console.error('Failed to create directory:', error);
    }
  }

  _getPath(type, id) {
    return path.join(this.basePath, type, `${id}.json`);
  }

  // store the data in a JSON file named after the id inside the folder named after type
  async save(type, id, data, metadata = {}) {
    const filePath = this._getPath(type, id);
    await this._ensureDir(path.dirname(filePath));

    const content = {
      lastUpdate: new Date().toISOString(),
      ...metadata,
      data
    };

    // write the data
    await fs.writeFile(filePath, JSON.stringify(content, null, 2));
  }

  // load the stored file if it exists and isn't outdated
  async load(type, id, maxAgeSeconds = null) {
    // try reading the file directly, if an error occurs we consider that the file doesn't exists
    try {
      const filePath = this._getPath(type, id);
      const content = await fs.readFile(filePath, 'utf8'); // try reading the file
      const parsed = JSON.parse(content);

      // check if the file isn't outdated
      if (maxAgeSeconds && parsed.lastUpdate) { 
        const age = (Date.now() - new Date(parsed.lastUpdate).getTime()) / 1000;
        if (age > maxAgeSeconds) return false; // it's outdated, 
      }

      return parsed.data;
    } catch { // the file doesn't exists
      return null;
    }
  }

  // Simple function that save videos of a playlist
  async savePlaylistVideos(playlistId, userId, videos) {
    const key = `${playlistId}`;
    await this.save('playlistItems', key, videos);
  }

  // Simple function that load videos of a playlist
  async loadPlaylistVideos(playlistId, userId, maxAgeSeconds = 86400) {
    const key = `${playlistId}`;
    return this.load('playlistItems', key, maxAgeSeconds);
  }

  // Simple function that moves a video (and update it's notes) in a local saved playlist
  async moveVideoInPlaylist(playlistId, userId, { playlistItemId, newPosition, note }) {
    const key = playlistId;
    const videos = await this.loadPlaylistVideos(playlistId, userId, null); // load the playlist
    
    if (!videos) return; // if the playlist isn't valid, the request is cancelled

    const index = videos.findIndex(v => v.playlistItemId === playlistItemId); // finds the video that will be moved
    if (index === -1) return; // if the video doesn't exists, the request is cancelled

    const [moved] = videos.splice(index, 1); // remove the video from the array of videos
    
    // we update the notes, if they are empty, we remove them
    if (note?.trim()) {
      moved.note = note;
    } else {
      delete moved.note;
    }

    // clamp the target to avoid index out of range errors
    const target = Math.max(0, Math.min(Number(newPosition), videos.length));
    videos.splice(target, 0, moved); // inserts the video to the clamped newPosition
    
    // Reindex positions to keep them in order
    videos.forEach((v, i) => { v.position = i; });

    // save the changes
    await this.savePlaylistVideos(key, userId, videos);
  }
}

// create a global cache instance that will be used for every other components
export const cacheService = new CacheService();