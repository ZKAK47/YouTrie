import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  async save(type, id, data, metadata = {}) {
    const filePath = this._getPath(type, id);
    await this._ensureDir(path.dirname(filePath));

    const content = {
      lastUpdate: new Date().toISOString(),
      ...metadata,
      data
    };

    await fs.writeFile(filePath, JSON.stringify(content, null, 2));
  }

  async load(type, id, maxAgeSeconds = null) {
    try {
      const filePath = this._getPath(type, id);
      const content = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(content);

      if (maxAgeSeconds && parsed.lastUpdate) {
        const age = (Date.now() - new Date(parsed.lastUpdate).getTime()) / 1000;
        if (age > maxAgeSeconds) return null;
      }

      return parsed.data;
    } catch {
      return null;
    }
  }

  async savePlaylistVideos(playlistId, userId, videos) {
    const key = `${playlistId}`;
    await this.save('playlistItems', key, videos);
  }

  async loadPlaylistVideos(playlistId, userId, maxAgeSeconds = 86400) {
    const key = `${playlistId}`;
    return this.load('playlistItems', key, maxAgeSeconds);
  }

  async moveVideoInPlaylist(playlistId, userId, { playlistItemId, newPosition, note }) {
    const key = `${userId}_${playlistId}`;
    const videos = await this.loadPlaylistVideos(playlistId, userId, null);
    
    if (!videos) return;

    const index = videos.findIndex(v => v.playlistItemId === playlistItemId);
    if (index === -1) return;

    const [moved] = videos.splice(index, 1);
    
    if (note?.trim()) {
      moved.note = note;
    } else {
      delete moved.note;
    }

    const target = Math.max(0, Math.min(Number(newPosition), videos.length));
    videos.splice(target, 0, moved);
    
    // Reindex positions
    videos.forEach((v, i) => { v.position = i; });

    await this.savePlaylistVideos(playlistId, userId, videos);
  }
}

export const cacheService = new CacheService();