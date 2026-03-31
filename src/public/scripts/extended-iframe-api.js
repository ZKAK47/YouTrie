/* 
  Default YouTube Iframe API doesn't support properly large Playlists
  by capping their youtube.loadPlaylist()'s index at 200 so, i created
  a wrapper that can play videos of playlists above 200 by treating them as
  video lists.
*/

export class YouTriePlayer {
    constructor(id, forYTPlayer = {}) {
      this.id = id
      this.playlists = {}
      this.playingPlaylist = null
      this.playingVideo = null
      this.player = null
      this.videoThatShouldPlay = null
      this.extendedPlaylist = false
      this.ignoreNextUnstarted = false
      this.initPlayer(forYTPlayer)
    }
    
    // stores the playlist in the instance
    loadPlayList(playlistId, array) {
      if (this.playlists[playlistId]) return
      const playlist = [...array].sort((a,b)=>Number(a.position)-Number(b.position));
      const playlistItemByVideoId = new Map()
      const playlistItemByplayListItemId = new Map()
      for (let item of playlist) {
        playlistItemByVideoId.set(item.videoId, item)
        playlistItemByplayListItemId.set(item.playlistItemId, item)
      }
      this.playlists[playlistId] = {
        playlist,
        playlistItemByVideoId,
        playlistItemByplayListItemId
      }
    }
  
    initPlayer(options = {}) {
        // options can contains : onReady, onStateChange, onError, playerVars, host, etc.
        const { onReady, onStateChange, onError, ...rest } = options
      
        this.player = new YT.Player(this.id, {
          height: "220",
          width: "300",
          ...rest,     // every remaining  playerVars, host, etc.
          events: {
            onReady: (event) => { if (onReady) onReady(event) },
            onStateChange: (event) => {
              this.onStateChange(event)           // the instance's native handler
              if (onStateChange) onStateChange(event) // given param if it exists
            },
            onError: (event) => { if (onError) onError(event) }
          }
        })
      }

    
    // Play a video
    playVideo({videoId, playlistId, index}) {
      const playlistRep = this.playlists[playlistId] // Get the playlist
      // if there aren't any playlists stored matching, try loading the video individually
      if (!playlistRep) {
        if (videoId) this.player.loadVideoById(videoId)
        return
      }
  
      const item = videoId ? playlistRep.playlistItemByVideoId.get(videoId) : 
        index ? playlistRep.playlist[index] : null
      // Again, load the video individually, if the video isn't found inside the playlist
      if (!item) {
        if (videoId) this.player.loadVideoById(videoId)
        return
      }
  
      const pos = Number(item.position)

      // keep track of the video in case the video is out of YouTube's cap
      this.videoThatShouldPlay = item.videoId
  
      // if the video's position is below 200, load it "normally"
      if (pos < 199) {
        this.player.loadPlaylist({
          list: playlistId,
          listType: "playlist",
          index: pos
        })
        this.extendedPlaylist = false
      } 
      // it goes past the cap, loads it as a list with 24 videos on each sides
      else {
        const playlist = playlistRep.playlist
        const start = Math.max(pos-24, 0)
        const end = Math.min(pos+24, playlist.length-1)

        // make a list of videoIds that doesn't have signs of being deleted
        const videoIds = playlist.slice(start, end+1).filter(isNotFilteredByYouTube).map(i=>i.videoId)
        let correctIndex = pos - start

        // if there were deleted videos, get the index of the video that's supposed to play 
        if (videoIds.length < 49) correctIndex = videoIds.indexOf(videoId)
        this.player.loadPlaylist(videoIds,correctIndex,0) // try playing the video, native onChange will prevent the player from playing other videos
        this.extendedPlaylist = true
        this.awaitingPlaylistExtension = true
      }
  
      this.playingPlaylist = playlistId
      this.playingVideo = videoId
    }

    getVideoData() {
        const ob = {...this.player.getVideoData(),playlistId:this.playingPlaylist}
        return ob
    }

    // play the previous video
    previousVideo() {
        // get the id of the currently played video
        const avideoId = this.player.getVideoData().video_id

        // get the playlist
        const playlistRep = this.playlists[this.playingPlaylist]
        if (!playlistRep) return
    
        // get the playlistItem ("the video inside the playlist")
        const playlistItem = playlistRep.playlistItemByVideoId.get(avideoId)
        if (!playlistItem) return
    
        // get the playlistItem's index
        const actualIndex = Number(playlistItem.position)
        let previousIndex = actualIndex - 1

        // if it's the first video, the previous one is considered to be the last one
        if (previousIndex < 0) previousIndex = playlistRep.playlist.length - 1
    
        const previousVideo = playlistRep.playlist[previousIndex]
        if (!previousVideo) return
    
        const { videoId, playlistId } = previousVideo
    
        // get the index according to YouTube's player
        const YouTubeIndex = this.player.getPlaylistIndex()
        if (YouTubeIndex - 1 < 0) {
            this.playVideo({ videoId, playlistId })
        } else {
            this.player.previousVideo()
        }
    }
  
    onStateChange(event) {
      this.nextLoadingIsAVideo = false
      if (event.data === 0) {
        const videoData = this.player.getVideoData()
        const videoId = videoData.video_id
        const playlistId = this.playingPlaylist
        const playlistRep = this.playlists[playlistId]
        if (!playlistRep) return
        const item = playlistRep.playlistItemByVideoId.get(videoId)
        if (!item) return
  
        const pos = Number(item.position)
        if (pos >= 199) {
          const playlist = playlistRep.playlist
          const start = Math.max(pos-24, 0)
          const end = Math.min(pos+24, playlist.length-1)
          const videoIds = playlist.slice(start, end+1).map(i=>i.videoId)
          const nextVideo = videoIds[pos - start + 1]
          this.awaitingPlaylistExtension = true
          if (nextVideo !== videoId) this.playVideo({videoId:nextVideo, playlistId})
        }
      } else if (event.data === -1) {
        const videoData = this.player.getVideoData()
        if (videoData) {
            if (this.awaitingPlaylistExtension && videoData?.video_id !== this.videoThatShouldPlay) {
                this.playVideo({videoId:this.videoThatShouldPlay, playlistId:this.playingPlaylist})
                this.awaitingPlaylistExtension = false
            }
        }
      }
    }
}

function isNotFilteredByYouTube(el) {
    if (!el.duration) return false
    return true
}