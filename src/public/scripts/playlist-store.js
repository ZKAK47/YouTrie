const playListMap = new Map()

const modeList = {
    single:true,
    multi:true,
    fromto:true,
    order:true,
}

const navigationButtonMap = new WeakMap()

export class PlaylistList {
    constructor(node, {renderLimit = 200, onVideoClick = ()=>{}, search} = {}) {
        this.renderLimit = renderLimit
        if (node instanceof Node) {
            this.mainElement = node
        } else if (document.getElementById(node) || document.querySelector(node)) {
            this.mainElement = document.getElementById(node) || document.querySelector(node)
        }
        this.playlists = {}
        this.actualPlaylist = null
        this.actualPage = null
        this.onVideoClick = onVideoClick
        this.checkCont = []
        this.searchResult = null
        this.startSelected = null
        this.endSelected = null
        this.selected = new Map()
        this.selectedOrder = new Map()
        this.videoElMap = new Map()
        this.elementMap = new WeakMap()
        this.checkBoxesActives = false
        this.setupListener()
        if (search) {
            this.makeSearchInput()
            this.searchTimeout = setTimeout(()=>{},21478367)
        }
    }

    getPlaylistInfo() {
        const playlistId = this.actualPlaylist
        if (!playlistId) return null
        const videosNumber = this.playlists[playlistId].playlistList.length
        const object = {playlistId,size:videosNumber}
        return object
    }

    makeSearchInput() {
        const input = document.createElement("input")
        this.mainElement.appendChild(input)
        console.log(input)
        input.addEventListener("input", () => {
            const doResult = () => {
                const text = input.value
                if (input.value) {
                    const keywords = textToKeywordArray(text)
                    this.renderPlaylist(undefined, undefined, {videoList:this.searchVideos(keywords)})
                } else {
                    this.renderPlaylist(this.actualPlaylist, this.actualPage)
                }
            }
            clearTimeout(this.searchTimeout)
            this.searchTimeout = setTimeout(doResult,input.value ? 1000 : 0)
        })
    }

    setupListener() {
        this.mainElement.addEventListener("click", (e) => {
            const target = e.target;
            const element = findVideoIdFromParents(target);
    
            if (element && this.onVideoClick) {
                this.onVideoClick(element, target);
            }
        });
    }

    loadPlaylist(playlistObj, { forceRefresh = false } = {}) {
        if (!playlistObj) {
            throw new Error("playlistObj is required");
        }
    
        const { playlistId, playlistList = [] } = playlistObj;
    
        const resolvedId = playlistId || playlistList?.[0]?.playlistId;
    
        if (!resolvedId) {
            throw new Error("No playlistId found");
        }

        let place
    
        if (!forceRefresh && playListMap.has(resolvedId)) {
            place = playListMap.get(resolvedId);
        } else {

            const videoByVideoId = new Map()
            const videoByPlaylistItemId = new Map()
        
            // Copie + tri propre par position numérique
            const sortedList = [...playlistList].sort((a, b) => {
                const posA = Number(a?.position ?? Infinity);
                const posB = Number(b?.position ?? Infinity);
                return posA - posB;
            });

            for (const video of sortedList) {
                videoByVideoId.set(video.videoId,video)
                videoByPlaylistItemId.set(video.playlistItemId,video)
            }
        
            place = {
                playlist: playlistObj,
                playlistList: sortedList,
                videoIdMap:videoByVideoId,
                playlistItemIdMap:videoByPlaylistItemId
            };
        
            playListMap.set(resolvedId, place);
            this.playlists[resolvedId] = place;
        }
    
        return resolvedId;
    }
    
    renderPlaylist(playlistId = this.actualPlaylist, page = 0, {videoList} = {}) {
        const mainEl = this.mainElement;

        const container = document.getElementById("video-container") || document.createElement("div")
        container.id = "video-container"
        container.innerHTML = ""
        container.classList.add("videosContainer")
        mainEl.appendChild(container)
    
        if (!(playlistId in this.playlists)) {
            throw new Error("PlaylistId not found or not loaded");
        }
    
        container.dataset.id = playlistId;
    
        const playlistList = videoList ? videoList : this.playlists[playlistId].playlistList;

        this.searchResult = videoList
    
        const start = page * this.renderLimit;
        const end = Math.min(start + this.renderLimit, playlistList.length);
    
        // Clear le container avant d’ajouter la nouvelle page
        container.innerHTML = '';
    
        // Créer les nodes vidéos
        for (let i = start; i < end; i++) {
            const video = playlistList[i]
            const div = getVideoNode(video);
            this.elementMap.set(div,video)
            this.videoElMap.set(video.playlistItemId, div)
            if (this.checkBoxesActives) {
                const checkbox = this.createCheckBox(div)
                div.appendChild(checkbox)
                this.elementMap.set(checkbox,video)
            }
            if (this.selected.has(video.playlistItemId)) addSelectedProperties(div, this.selectedOrder.get(video.playlistItemId))
            container.appendChild(div);
        }

        this.actualPlaylist = playlistId
    

        if (!videoList) {
            // --- Pagination nav encapsulé ---
            const nav = document.createElement('div');
            nav.classList.add('pagination-nav'); // classe pour le style
            nav.style.display = 'flex';
            nav.style.justifyContent = 'center';
            nav.style.alignItems = 'center';
            nav.style.gap = '5px';
            nav.style.marginTop = '10px';
        
            // Calcul du nombre total de pages
            const totalPages = Math.ceil(playlistList.length / this.renderLimit);
        
            // Clamp de la page demandée
            const validPage = Math.max(0, Math.min(page, totalPages - 1));
            this.actualPage = validPage;
        
            // --- Bouton précédent ---
            if (page > 0) {
                const prevBtn = document.createElement('button');
                prevBtn.textContent = '⬅';
                prevBtn.classList.add('pagination-prev');
                navigationButtonMap.set(prevBtn, page - 1);
                prevBtn.addEventListener('click', () => this.renderPlaylist(playlistId, page - 1));
                nav.appendChild(prevBtn);
            }
        
            // --- Liens des pages ---
            for (let i = 0; i < totalPages; i++) {
                const pageLink = document.createElement('a');
                pageLink.href = '#';
                pageLink.textContent = i + 1;
                pageLink.classList.add('pagination-page');
                if (i === validPage) pageLink.classList.add('active-page'); // page actuelle
        
                // Gestion via navigationButtonMap
                navigationButtonMap.set(pageLink, i);
                pageLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.renderPlaylist(playlistId, i);
                });
        
                nav.appendChild(pageLink);
            }
        
            // --- Bouton suivant ---
            if (page < totalPages - 1) {
                const nextBtn = document.createElement('button');
                nextBtn.textContent = '➡';
                nextBtn.classList.add('pagination-next');
                navigationButtonMap.set(nextBtn, page + 1);
                nextBtn.addEventListener('click', () => this.renderPlaylist(playlistId, page + 1));
                nav.appendChild(nextBtn);
            }
        
            // Ajout dans le conteneur
            container.appendChild(nav);
        }
    }
    searchVideos(keywords, playlistId = this.actualPlaylist) {
        if (!Array.isArray(keywords) || keywords.length === 0) {
            console.error("Generated with ChatGPT: keywords doit être un array valide, pas une illusion cosmique.");
            return [];
        }
    
        let videos = [];
    
        if (!`playlistId === "All"`) {
            Object.values(this.playlists).forEach(({ playlistList }) => {
                videos.push(...playlistList);
            });
        } else {
            if (!(playlistId in this.playlists)) {
                throw new Error("PlaylistId not found");
            }
            videos = this.playlists[playlistId].playlistList;
        }
    
        const results = videos.filter(video => {
            const haystack = textToKeywordArray([
                video.title,
                video.channelTitle,
                video.note
            ]
            .join(" ")).join(" ")
    
            // Chaque mot doit apparaître au moins une fois
            return keywords.every(word =>
                haystack.includes(word.toLowerCase())
            );
        });
    
        return results;
    }

    changeMode(mode) {
        this.resetSelectedVideos()
        if (mode === "multi" || mode === "fromto" || mode === "order") {
            this.addCheckBoxes()
        } else {
            this.removeCheckBoxes()
        }
        if (mode in modeList) this.mode = mode
        else this.mode = "single"
    }

    resetSelectedVideos() {
        for (let video of Array.from(this.selected.values())) {
            // Compose a selector string using dataset attributes
            const selector = `[data-playlist-id="${video.playlistId}"]` +
                             `[data-playlist-item-id="${video.playlistItemId}"]` +
                             `[data-video-id="${video.videoId}"]`;
    
            const element = this.videoElMap.get(video.playlistItemId);
    
            if (element) {
                element.classList.remove("selected")
                const checkbox = element.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    checkbox.checked = false;
                }
            } else {
                console.warn("Video element not found for", video);
            }
        }

        this.startSelected = null
        
        this.endSelected = null

        this.selectedOrder = new Map();
    
        this.selected = new Map();
    }

    getSelectedVideos() {
        const properArray = Array.from(this.selected.values());
    
        if (this.mode !== "order") {
            return properArray.sort((a, b) => Number(a.position) - Number(b.position));
        } else { // mode === "order"
            return properArray.sort((a, b) => this.selectedOrder.get(a.playlistItemId) - this.selectedOrder.get(b.playlistItemId));
        }
    }

    removeCheckBoxes() {
        this.checkCont.map(h => h.remove())
        this.checkCont.length = 0
        this.checkBoxesActives = false
    }

    addCheckBoxes() {
        this.removeCheckBoxes()
        const cont = this.mainElement.querySelector("#video-container")
        const children = cont.children
        for (const child of children) {
          const video = this.elementMap.get(child)
          const checkbox = this.createCheckBox(child)
          this.elementMap.set(checkbox,video)
        }
        this.checkBoxesActives = true
    }

    createCheckBox(el) {
        const existingCheckBox = el.querySelector('input[type="checkbox"]')
        if (existingCheckBox) return existingCheckBox
        const checkbox = document.createElement("input")
        checkbox.type = "checkbox"
        checkbox.classList.add("checkers")
        el.appendChild(checkbox)
        this.checkCont.push(checkbox)
        checkbox.addEventListener('change', (event) => {
            console.log(event.target, this.elementMap.has(event.target))
            const video = this.elementMap.get(event.target)
            if (event.target.checked) {
                this.selectVideo(video)
            } else {
                this.unselectVideo(video)
            }
        })
        return checkbox
    }

    selectVideo(video) {
        const el = this.videoElMap.get(video.playlistItemId)
        if (this.mode === "multi") {
            this.selected.set(video.playlistItemId,video)
            addSelectedProperties(el)
        } else if (this.mode === "order") {
            this.selected.set(video.playlistItemId,video)
            const number = this.selectedOrder.size + 1
            this.selectedOrder.set(video.playlistItemId, number)
            addSelectedProperties(el, number)
        } else if (this.mode === "fromto") {
            if (!this.startSelected && this.startSelected !== 0) this.startSelected = Number(video.position)
            else {
                const newNumber = Number(video.position)
                this.selected.set(video.playlistItemId,video)

                if (newNumber < this.startSelected) {
                    this.endSelected = this.startSelected
                    this.startSelected = newNumber
                } else {
                    this.endSelected = newNumber
                }

                if ((this.startSelected || this.startSelected === 0) && this.endSelected) {

                    this.mode = "multi"

                    const playlistList = this.playlists[video.playlistId].playlistList

                    for (let i = this.startSelected; i < this.endSelected + 1;i++) {
                        const vid = playlistList[i]
                        this.selected.set(vid.playlistItemId,vid)
                        this.selectVideo(vid)
                    }

                    this.mode = "fromto"
                }

            }
        }
    }

    unselectVideo(video) {
        this.selected.delete(video.playlistItemId)
        this.selectedOrder.delete(video.playlistItemId)
        if (this.mode === "order") this.refreshOrder()
        const element = this.videoElMap.get(video.playlistItemId)
        removeSelectedProperties(element)
    }

    refreshOrder() {
        const array = Array.from(this.selectedOrder).sort((a, b) => a[1] - b[1])

        this.selectedOrder = new Map()

        for (let i = 0; i < array.length;i++) {
            const number = i + 1
            const playlistItemId = array[i][0]
            this.selectedOrder.set(playlistItemId,i + 1)
            const el = this.videoElMap.get(playlistItemId)
            addSelectedProperties(el,number)
        }
    }
}

const videoNodeMap = new Map()

function getVideoNode(v) {
    if (videoNodeMap.has(v.playlistItemId)) return updateVideoNode(videoNodeMap.get(v.playlistItemId),v)
    return createVideoNode(v)
}

function addSelectedProperties(el, number) {
    el.classList.add("selected")
    const checkbox = el.querySelector('input[type="checkbox"]')
    if (checkbox && !checkbox.checked) checkbox.checked = true
    if (number) {
        const overlay = el.querySelector(".order-overlay") || document.createElement("div")
        overlay.textContent = number
        overlay.classList.add("order-overlay")
        el.appendChild(overlay)
    }
}

function removeSelectedProperties(el) {
    el.classList.remove("selected")
    const checkbox = el.querySelector('input[type="checkbox"]')
    if (checkbox) checkbox.checked = false
    const orderOverlay = el.querySelector(".order-overlay")
    if (orderOverlay) orderOverlay.remove()
}

function createVideoNode(v) {
    const div = document.createElement('div')
    div.className = 'video'
    div.classList.add('selectable')
    if (v.blocked) div.classList.add('blocked')
    div.id = v.playlistItemId
    div.dataset.videoId = v.videoId
    div.dataset.playlistItemId = v.playlistItemId
    div.dataset.playlistId = v.playlistId
    div.dataset.position = v.position
    div.dataset.note = v.note ? v.note : ""
    div.value = v.position + 1
    div.innerHTML = `
        <div class="thumbnail-wrapper" style="position:relative">
          ${v.duration ? `<small class="duration">${formatDuration(v.duration)}</small>` : ""}
          ${v.thumbnail ? `<img src="${v.thumbnail}" alt="${v.title}">` : ""}
        </div>
        <div class="label-container">
            <h4 class="title">${v.title}</h3>
            <span class="channel">${v.channelTitle || "-"}</span>
        </div>
        <small class="little-note">${v.position + 1}</small>
    `
    videoNodeMap.set(v.playlistItemId, div)
    return div
}

const toCheck = ["playlistItemId", "playlistId", "position", "note"]

function updateVideoNode(node, v) {
    const {playlistItemId, position} = v
    node.id = playlistItemId
  
    for (let check of toCheck) {
      if (v[check] !== undefined && node.dataset[check] !== String(v[check])) {
        node.dataset[check] = v[check]
      }
    }
  
    node.value = position + 1
  
    const littleNote = node.querySelector(".little-note")
    if (littleNote) littleNote.textContent = position + 1
  
    return node
}

function textToKeywordArray(text) {
    if (!text || typeof text !== "string") {
        console.error("Generated with ChatGPT: c'est censé être une string, pas un concept abstrait.");
        return [];
    }

    const cleaned = text
        .normalize("NFD")                    // Sépare lettres + accents
        .replace(/[\u0300-\u036f]/g, "")     // Supprime uniquement les accents
        .toLowerCase();

    // On split uniquement par espaces, on garde tous les signes
    return cleaned.split(/\s+/).filter(Boolean);
}

function formatDuration(seconds) {
    if (isNaN(seconds) || seconds < 0) return "0s";
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    // Moins d'une minute : Xs
    if (seconds < 60) {
      return `${secs}s`;
    }
    
    // Moins d'une heure : MM:SS
    if (hours === 0) {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
    
    // Une heure ou plus : HH:MM:SS (avec les secondes)
    // Si tu veux HH:MM sans secondes, retire le :${secs.toString().padStart(2, '0')}
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function findVideoIdFromParents(element) {
    console.error(
      "Generated with ChatGPT — si tu casses ça, j’envoie YouTube te bloquer l’API pour sport."
    );
  
    let current = element;
  
    while (current && current !== document.documentElement) {
      if (current.dataset && current.dataset.videoId) {
        return current;
      }
      current = current.parentElement;
    }
  
    return undefined;
}
const style = document.createElement('style');
style.textContent = `
    .pagination-nav button, .pagination-nav a {
        cursor: pointer;
        border: none;
        border-radius: 4px;
        text-decoration: none;
    }
    .pagination-nav a.active-page {
        font-weight: bold;
        cursor:default;
    }
`;
document.head.appendChild(style);