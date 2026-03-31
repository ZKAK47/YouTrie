import { YouTriePlayer } from "./extended-iframe-api.js"
import { PlaylistList } from "./playlist-store.js"

const style = document.createElement("style")

style.textContent = `
  #playlistsContainer {
    display:flex;
    max-width:50vw;
    flex-wrap:wrap;
    gap:10px;
  }

.videos-wrapper {
    display:flex;
    flex-direction: column;
    width: 20%;
    gap: 5px;
    border: 1px solid #AAA; /* optionnel, pour voir le container */
    padding: 5px;           /* optionnel, un peu d’air */
}

.videosContainer {
    display: flex;
    flex-direction: column;
    gap: 5px;
    border: 1px solid #ccc; /* optionnel, pour voir le container */
    padding: 5px;           /* optionnel, un peu d’air */
}

  .video img {
    width:100%;
  }

  .video {
    display:flex;
    flex-direction:column;
    height:10%;
    width:100%;
    position:relative;
    box-sizing:border-box;
  }

  .video.blocked {
    border:1px solid red;
  }

  .video .thumbnail-wrapper {
    height:50%;
    background-image:
    linear-gradient(45deg, rgba(200,200,200,0.4) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(200,200,200,0.4) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(200,200,200,0.4) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(200,200,200,0.4) 75%);
    background-size: 20px 20px;
    background-position: 0 0, 0 10px, 10px -10px, -10px 0;
  }

  .checkers {
    position:absolute;
    right:105%;
    top:50%;
    transform:translateY(-50%);
  }

  .playlist {
    height:200px;
    display:flex;
    flex-direction:column;
    position:relative;
    box-sizing:border-box;
  }

  .playlist img {
    height:100%;
  }

  .selectable {
    padding:10px;
  }

  .selectable:hover {
    background:#FFFFFF77;
    cursor:pointer;
  }

  .selectable:active {
    background:#FFFFFF;
    cursor:pointer;
  }

  .body2 {
    display:flex;
    height:100%;
    width:100%;
    justify-content: space-around;
    align-items:baseline;
  }

  .title {
    margin:0;
    width:100%;
    background: #00000077;
    justify-content:center;
    display:flex;
    text-overflow: ellipsis;
  }

  .label-container {
    flex:1;
    display:flex;
    flex-direction:column;
  }

  .channel {
    font-size:.75em;
    padding:.1em;
    background:#3e3e3e;
  }

  .duration {
    position:absolute;
    bottom:0;
    right:0;
    background-color: #212121;
    padding: .1em;
    font-size: .75em;
  }

  .little-note {
    position:absolute;
    top:1%;
    left:1%;
    background: #00000077;
    display:flex
  }

  .videos-container {
    display:flex;
  }

  .item-field {
    width:100%;
    padding:5px;
    margin-bottom:6px;
    box-sizing: border-box;
  }

  #navibari {
    position:fixed;
    display:flex;
    width:100%;
    bottom:0;
    right:0;
    background: #AAA;
  }

  .overlay {
    position:absolute;
    width:100%;
    height:100%;
    top:0;
    right:0;
    display:flex;
    justify-content:center;
    align-items:center;
    background: #00000077
  }

  .onPlay {
    background:#00FF00
  }

  #youtube-play {
    width:300px;
    height:200px;
    position:fixed;
    top:0;
    left:50%;
    z-index: 1000000;
    transform: translate(-50%, 0)
  }
`

const YouTubeVideoListLimit = 200

document.head.appendChild(style)

const body2 = document.createElement("div")
body2.classList.add("body2")
let body_in_DOM = false
let lastClickedPlayList = null
let lastClickedPlayListList = []

const videoArray = new Map()

let session = null

function resetLogin() {

}

export async function fetchPlaylists(sessionId) {
  session = sessionId
  try {
      const res = await fetch(`/api/playlists`,{
        credentials: 'include' // Important pour les cookies
      })
      if (!res.ok) throw new Error('Erreur serveur playlists')
      const playlists = await res.json()
      renderPlaylists(playlists)
  } catch (err) {
      console.error(err)
      document.body.innerHTML = `<p>Impossible de charger les playlists</p>`
  }
}

const nodeToPlayer = new Map()

function putPlayingVisualOnVideo({ videoId, playlistId, playlistItemId, index }) {
  document.querySelectorAll(".onPlay").forEach(el => el.classList.remove("onPlay"));

  let selector;

  if (playlistId != null && index != null) {
    selector = `[data-playlist-id="${playlistId}"][data-position="${index}"]`;
  } else if (videoId != null) {
    selector = `[data-video-id="${videoId}"]`;
  }

  if (!selector) return;

  const vid = document.querySelector(selector);
  if (vid) vid.classList.add("onPlay");
}

function playerError(event) {
  console.log(event.data, event);
}

function makePlaylistAppear(playlistId, videoId, position) {
  const pl = nodeToPlayer.get("youtube-play");
  const videos = playlistMap.get(playlistId);

  const indexInt = Number(position)

  if (pl) {
    pl.loadPlayList(playlistId, videos);
    if (videoId) pl.playVideo({videoId, playlistId, index:indexInt});
    window.pl = pl
    return;
  }

  const player = new YouTriePlayer("youtube-play", {
    host: "https://www.youtube-nocookie.com",
    height: "220",
    width: "300",
    onReady: () => {
      if (videoId) player.playVideo({videoId, playlistId, index:indexInt});
      const playerWrapper = document.getElementById("youtube-play")
      playerWrapper.style.display = ""
      playerWrapper.dataset.status = "1"
    },
    onStateChange: (event) => {checkVideoItIs(event,player)},
    onError: playerError
  });

  nodeToPlayer.set("youtube-play", player);
  player.loadPlayList(playlistId, videos);
}

function checkVideoItIs(event, player) {
  if (event.data === 1) {
    const {playlistId, video_id} = player.getVideoData()
    const videoId = video_id
    putPlayingVisualOnVideo({playlistId,videoId})
  }
}


// 2️⃣ Render les playlists
function renderPlaylists(playlists) {
  if (!body_in_DOM) {document.body.appendChild(body2);body_in_DOM = true}
  const player = document.getElementById("youtube-play") || document.createElement("div")
  player.id = "youtube-play"
  if (!player.dataset?.status) player.style.display = "none"
  if (!document.getElementById("youtube-play"))
  body2.appendChild(player)
  const container = document.getElementById("playlistsContainer") || document.createElement('div')
  container.id = 'playlistsContainer'
  container.innerHTML = ""
  playlists.forEach(pl => {
      const div = document.createElement('div')
      div.id = pl.playlistId
      div.className = 'playlist'
      div.classList.add('selectable')
      div.dataset.number = pl.itemCount
      div.innerHTML = `
          <img src="${pl.thumbnail}" alt="${pl.title}">
          <h3 class="title">${pl.title}</h3>
          <small class="little-note">${pl.itemCount} vidéos</small>
      `
      // Click pour charger les vidéos
      div.addEventListener('click', () => {
        fetchVideos(pl.playlistId)
        lastClickedPlayList = pl.playlistId
      })
      container.appendChild(div)
  })
  if (!document.getElementById("playlistsContainer"))
  body2.appendChild(container)
}

// 3️⃣ Récupérer les vidéos d’une playlist
export async function fetchVideos(playlistId) {
  try {
      const res = await fetch(`/api/playlists/${playlistId}/videos`, {credentials:'include'})
      if (!res.ok) throw new Error('Erreur serveur vidéos')
      const videos = await res.json()
      renderVideos(playlistId, videos)
  } catch (err) {
      console.error(err)
      alert('Impossible de charger les vidéos')
  }
}

const playlistMap = new Map()

let playlistListInstance

// 4️⃣ Render les vidéos
function renderVideos(playlistId, videos) {
  // Supprime l'ancien container de vidéos si existant
  createNavBar()
  if (!playlistListInstance) {
    const container = document.createElement('div')
    container.id = 'videosContainer'
    container.classList.add("videos-wrapper")
    playlistListInstance = new PlaylistList(container,{renderLimit:500,onVideoClick:checkTheVideo,search:true})
    window.testi = playlistListInstance
  }

  const id = playlistListInstance.loadPlaylist({playlistId,playlistList:videos}, {forceRefresh:true})

  playlistListInstance.renderPlaylist(id)

  playlistMap.set(playlistId,videos)

  const container = playlistListInstance.mainElement

  body2.appendChild(container)
}

function checkTheVideo(videoTarget,target) {
  const mode = document.getElementById("smode").value
  const data = videoTarget.dataset
  try {
    makePlaylistAppear(data.playlistId, data.videoId, data.position)
  } catch (e) {
    console.error("Problème d'affichage de vidéo", e)
  }

  let tocheck = target

  while (tocheck.parentElement && !tocheck.classList.contains("video")) tocheck = tocheck.parentElement

  if (tocheck.classList.contains('video') && mode === "single") {
    setOrderOfElement(tocheck);
    return
  }

};

function addVideoToMap(key, ob) {
  const objecto = {...ob,order:videoArray.size}
  videoArray.set(key, objecto)
  const div = document.getElementById(key)
  const overlay = document.createElement("div")
  overlay.id = "overl"
  overlay.classList.add("overlay")
  overlay.textContent = videoArray.size
  div.appendChild(overlay)
}

function removeVideoToMap(key) {
  // Supprime la vidéo de la Map
  videoArray.delete(key);

  document.getElementById(key).querySelector("#overl").remove()

  // Récupère les clés restantes
  const keyArray = [...videoArray.keys()];

  keyArray.forEach((k, i) => {
    // Chaque div a un id basé sur la clé
    const div = document.getElementById(k); 
    if (div) {
      const overlay = div.querySelector("#overl"); // attention, classe ou id ?
      if (overlay) overlay.textContent = i+1;
    }
  });
}


function setOrderOfElement(node, pl) {
  if (!(node instanceof HTMLElement)) return;
  const plEl = document.getElementById(node.dataset.playlistId)
  const limit = plEl.dataset.number

  // Supprimer ancien overlay s'il existe
  const old = document.getElementById('orderOverlay');
  if (old) old.remove();

  const queries = node.dataset

  // Overlay container
  const overlay = document.createElement('div');
  overlay.id = 'orderOverlay';
  overlay.style.cssText = `
    position: fixed;
    top: 10px;
    left: 10px;
    background: #111;
    color: #fff;
    padding: 10px;
    z-index: 9999;
    border-radius: 6px;
    width: 220px;
    font-family: sans-serif;
  `;

  // Clone visuel
  const clone = node.cloneNode(true);
  clone.style.pointerEvents = 'none';
  clone.style.opacity = '0.8';
  clone.style.marginBottom = '8px';

  // Input
  const input = document.createElement('input');
  input.type = 'number';
  input.min = 1;
  input.value = Number(queries.position) + 1
  input.dataset.originalValue = Number(queries.position) + 1
  input.max = Number(limit) + 1
  input.placeholder = 'Choisir sa position (1 based)';
  input.classList.add("item-field")

  const ninput = document.createElement('textarea');
  ninput.maxlength="280"
  ninput.placeholder = 'Ajouter des notes';
  ninput.classList.add("item-field")

  if (queries.note) ninput.value = queries.note

  // Bouton
  const btn = document.createElement('button');
  btn.textContent = 'Appliquer';
  Object.assign(btn.dataset, queries)
  btn.style.cssText = `
    width: 100%;
    padding: 6px;
    cursor: pointer;
  `;
  btn.disabled = true;

  btn.dataset.position = queries.position

  input.addEventListener("input", function (e) {
    const value = e.target.value;
  
    // Si vide → désactive le bouton
    if (value === "") {
      btn.disabled = true;
      return;
    }
  
    // Empêche les caractères non numériques
    if (isNaN(value)) {
      e.target.value = value.slice(0, -1);
      btn.disabled = true;
      return;
    }
  
    const num = Number(value);
    const min = Number(e.target.min);
    const max = Number(e.target.max);
  
    // Clamp
    if (!isNaN(min) && num < min) {
      e.target.value = min;
    }
  
    if (!isNaN(max) && num > max) {
      e.target.value = max;
    }
  
    btn.disabled = false;
  });
  

  btn.addEventListener('click', async () => {
    const value = input.value ? Number(input.value) : Number(input.dataset.originalValue);
    if (Number.isNaN(value)) return;

    const videoArray2 = propagateIndex(Array.from(plEl.children),value-1)

    btn.dataset.newPosition = value-1
    btn.dataset.note = ninput.value

    btn.style.background = "blue"

    try {
      const result = await setOrderOfElementC(btn.dataset)
      if (result.success) {
        btn.style.background = "green"
        simulateVideoUpdate(btn.dataset.playlistId,btn.dataset)
      }
    } catch (e) {
      console.error(e)
      btn.style.background = "yellow"
    }

    const playlistId = btn.dataset.playlistId

    setTimeout(() => {
      overlay.remove();
      fetchVideos(playlistId)
    },3000)
  });

  // Assemblage
  overlay.appendChild(clone);
  overlay.appendChild(input);
  overlay.appendChild(ninput)
  overlay.appendChild(btn);
  document.body.appendChild(overlay);
}

function createNavBar() {
  if (document.getElementById("navibari")) return
  const div = document.createElement("div")
  div.id = "navibari"
  const select = document.createElement("select")
  select.id = "smode"
  const single = document.createElement("option")
  single.textContent = "Individuelle"
  single.value = "single"
  const multi = document.createElement("option")
  multi.textContent = "Séléction multiple"
  multi.value = "multi"
  const ft = document.createElement("option")
  ft.textContent = "Séléction De - à"
  ft.value = "fromto"
  const multiByOrder = document.createElement("option")
  multiByOrder.textContent = "Séléction ordonnée"
  multiByOrder.value = "order"
  select.appendChild(single)
  select.appendChild(multi)
  select.appendChild(multiByOrder)
  select.appendChild(ft)
  const button = document.createElement("button")
  button.textContent = "Confirmer"
  button.id = "confirm"
  button.disabled = true
  div.appendChild(select)
  div.appendChild(button)
  document.body.appendChild(div)
  select.addEventListener("change", function () {
    const confirmbut = document.getElementById("confirm")
    clearMap()
    playlistListInstance.changeMode(this.value)
    if (this.value === "multi" || this.value === "fromto" || this.value === "order") {
      confirmbut.disabled = ""
    } else confirmbut.disabled = true
  });
  button.addEventListener("click",()=>{
    const arr =  Array.from(videoArray.values())
    const sortedarr = arr.sort((a,b) => a-b)
    confirmManyUpload(document.getElementById("smode").value,sortedarr)
  })
}

function confirmManyUpload(mode,array) {
  if (!mode || mode === "single") return
  const plInfo = playlistListInstance.getPlaylistInfo()

  const {playlistId} = plInfo

  const limit = plInfo.size

  // Supprimer ancien overlay s'il existe
  const old = document.getElementById('orderOverlay');
  if (old) old.remove();

  // Overlay container
  const overlay = document.createElement('div');
  overlay.id = 'orderOverlay';
  overlay.style.cssText = `
    position: fixed;
    top: 10px;
    left: 10px;
    background: #111;
    color: #fff;
    padding: 10px;
    z-index: 9999;
    border-radius: 6px;
    width: 220px;
    font-family: sans-serif;
  `;

  // Input
  const input = document.createElement('input');
  input.type = 'number';
  input.min = 1;
  input.max = Number(limit) + 1
  input.placeholder = 'Choisir sa position (1 based)';
  input.style.cssText = `
    width: 100%;
    padding: 5px;
    margin-bottom: 6px;
  `;

  // Bouton
  const btn = document.createElement('button');
  btn.textContent = 'Appliquer';
  btn.dataset.playlistId = lastClickedPlayList
  btn.style.cssText = `
    width: 100%;
    padding: 6px;
    cursor: pointer;
  `;
  btn.disabled = true;

  input.addEventListener("input", function (e) {
    const value = e.target.value;
  
    // Si vide → désactive le bouton
    if (value === "") {
      btn.disabled = true;
      return;
    }
  
    // Empêche les caractères non numériques
    if (isNaN(value)) {
      e.target.value = value.slice(0, -1);
      btn.disabled = true;
      return;
    }
  
    const num = Number(value);
    const min = Number(e.target.min);
    const max = Number(e.target.max);
  
    // Clamp
    if (!isNaN(min) && num < min) {
      e.target.value = min;
    }
  
    if (!isNaN(max) && num > max) {
      e.target.value = max;
    }
  
    btn.disabled = false;
  });
  

  btn.addEventListener('click', async () => {
    let value = Number(input.value) - 1;
    if (Number.isNaN(value)) return;

    btn.style.background = "blue"

    const selectedVideos = playlistListInstance.getSelectedVideos()

    try {
      const result = await setIndexOfManyVideos(playlistId, selectedVideos,value)
      if (result.success) {
        if (result.success === "partial")
          btn.style.background = "gray"
        else
          btn.style.background = "green"
      }
      
    } catch (e) {
      console.error(e)
      btn.style.background = "yellow"
    }

    setTimeout(() => {
      overlay.remove();
      fetchVideos(playlistId)
    },3000)
  });

  overlay.appendChild(input);
  overlay.appendChild(btn);
  document.body.appendChild(overlay);
}

function clearMap() {
  videoArray.clear()
}

const checkCont = []


async function setOrderOfElementC(data) {
  try {
    // sécurité minimale : check si y’a un minimum d’info
    if (!data || !data.playlistItemId || !data.playlistId || !data.videoId || !data.position) {
      throw new Error("Paramètres invalides");
    }

    const object = {
      playlistItemId: data.playlistItemId,
      playlistId: data.playlistId,
      videoId: data.videoId,
      position: Number(data.position),
      newPosition: Number(data.newPosition ?? null),
      ...(data.note && {note:data.note})
    }

    const response = await fetch(`/api/videos/move`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(object)
    });

    if (!response.ok) {
      throw new Error("Erreur HTTP " + response.status);
    }

    const resData = await response.json();
    return resData;
  } catch (err) {
    return null;
  }
}

async function setIndexOfManyVideos(playlistId, videoArray, index) {
  if (!videoArray || (!Number(index) && Number(index) !== 0)) return
  index = Number(index)
  const object = {
    playlistId,
    finalPosition:index,
    type:"v2",
    videos:videoArray
  }
  try {
      const response = await fetch(`/api/videos/move-batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials:"include",
      body: JSON.stringify(object)
    });

    if (!response.ok) {
      throw new Error("Erreur HTTP " + response.status);
    }

    const resData = await response.json();
    return resData;
  } catch (err) {
    return null;
  }
}

function simulateManyVideosUpdate(object) {
  const targeted = document.querySelector(`[data-id="${object.playlistId}"]`)
  if (!targeted) return
  for (const video of object.videos) {
    simulateVideoUpdate(object.playlistId,video)
  }
}

function simulateVideoUpdate(playlistId, video) {
  const playlistEl = document.querySelector(`[data-id="${playlistId}"]`);
  if (!playlistEl) return;

  const videoEl = document.getElementById(video.playlistItemId);
  if (!videoEl) return;

  const index = Number(video.newPosition)

  // On retire la vidéo de sa position actuelle
  playlistEl.removeChild(videoEl);

  // On récupère la liste des enfants
  const children = Array.from(playlistEl.children);

  // Si newPosition est plus grand que le nombre d'enfants, on append à la fin
  if (video.newPosition >= children.length) {
    video.newPosition = children.length
    playlistEl.appendChild(videoEl);
    videoEl.querySelector(".little-note").textContent = children.length
  } else {
    // Sinon, on insère avant l'enfant à l'index newPosition
    playlistEl.insertBefore(videoEl, children[video.newPosition]);
    videoEl.querySelector(".little-note").textContent = index + 1
  }
  updateAllPositionsFromReference(playlistId, index)
}

function updateAllPositionsFromReference(playlistId, referenceIndex) {
  const playlistEl = document.querySelector(`[data-id="${playlistId}"]`);
  if (!playlistEl) return;
  
  const children = Array.from(playlistEl.children);
  const referenceElement = children[referenceIndex];
  
  if (!referenceElement) return;
  
  // Récupère la position actuelle de l'élément référentiel
  const currentRefPosition = parseInt(referenceElement.querySelector('.little-note').textContent);
  const actualRefPosition = referenceIndex; // Position dans le DOM
  
  // Calcul du décalage
  const offset = currentRefPosition - actualRefPosition;
  
  // Met à jour tous les éléments
  children.forEach((child, index) => {
    const small = child.querySelector('.little-note');
    if (small) {
      small.textContent = index + offset;
    }
  });
}

function propagateIndex(videoArray, index) {
  const result = []
  let ourlist = [...lastClickedPlayListList]
  let previousItem
  let accuratePosition
  for (const video of videoArray) {
    if (!previousItem && video.position < index) index -=1
    const pre = predictYouTubeAPIAfterMove(ourlist,video.playlistItemId,previousItem, !previousItem ? index : false)
    ourlist = pre[0]
    accuratePosition = pre[1]
    video.newPosition = accuratePosition
    previousItem = video.playlistItemId
    delete video.position
    result.push(video)
  }
  return result
}

function predictYouTubeAPIAfterMove(list,toremove,afterThat = false,index = false) {
  const newList = [...list]
  const removableElIndex = newList.findIndex(e => e === toremove)
  if (removableElIndex !== -1) newList.splice(removableElIndex,1)

  let newPosition

  if (afterThat) {
    const indexOfTarget = newList.findIndex(e => e === afterThat)
    newPosition = indexOfTarget+1
  } else if (index || index === 0) {
    newPosition = index
  }

  newList.splice(newPosition, 0, toremove)

  return [newList, newPosition]
}