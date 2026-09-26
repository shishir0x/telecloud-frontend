import {
    ensurePlayersLoaded,
    ensurePrismLoaded,
    ensurePdfLoaded,
    openUrlInNewTab,
    artplayerI18n,
    parseVttChapters,
    setupChapterDetection,
    findSubtitlesForVideo,
    buildArtplayerSubtitleSetting,
    applySubtitleStyles,
    buildSubtitleBackgroundSetting,
    buildSubtitleSizeSetting,
    buildSubtitleColorSetting
} from './player_helpers.js';

export function shareApp() {
    return {
        shareToken: '',
        showPrivacyModal: false,
        currentTheme: localStorage.getItem('theme') || 'system',
        currentTab: 'files',
        viewMode: localStorage.getItem('viewMode') || 'list',
        toggleViewMode() {
            this.viewMode = this.viewMode === 'list' ? 'grid' : 'list';
            localStorage.setItem('viewMode', this.viewMode);
        },
        sortBy: 'name',
        sortOrder: 'asc',
        isLoading: false, 
        isRefreshing: false,
        isPreparingDownload: false,
        batchDownload: {
            active: false,
            total: 0,
            current: 0,
            error: false
        },
        lang: TeleCloud.lang,
        toastModal: { show: false, message: '', type: 'success', persistent: false },
        showToast(msg, type = 'success', duration = 3500) {
            if (this.toastTimeout) clearTimeout(this.toastTimeout);
            this.toastModal = { show: true, message: msg, type: type, persistent: duration === 0 };
            if (duration > 0) {
                this.toastTimeout = setTimeout(() => { this.toastModal.show = false; }, duration);
            }
        },
        t(key, params) { return TeleCloud.t(key, params, this.lang); },
        formatBytes(b, d) { return TeleCloud.formatBytes(b, d); },
        formatDate(d) { return TeleCloud.formatDate(d, this.lang); },
        getFileTypeData(f) { return TeleCloud.getFileTypeData(f); },
        parseMarkdown(t) { return TeleCloud.parseMarkdown(t); },
        async toggleLang() { 
            this.lang = await TeleCloud.toggleLang();
        },
        async setLang(code) {
            this.lang = await TeleCloud.setLang(code);
        },
        
        startDownload(fileId) {
            this.isPreparingDownload = true;
            document.cookie = "dl_started=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = `/s/${this.shareToken}/file/${fileId}/dl`;
            document.body.appendChild(iframe);
            let checkCookie = setInterval(() => {
                if (document.cookie.includes('dl_started=1')) {
                    clearInterval(checkCookie);
                    this.isPreparingDownload = false;
                    document.cookie = "dl_started=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                    setTimeout(() => iframe.remove(), 2000); 
                }
            }, 500);
            setTimeout(() => {
                if (this.isPreparingDownload) {
                    clearInterval(checkCookie);
                    this.isPreparingDownload = false;
                    iframe.remove();
                }
            }, 15000);
        },


        async downloadSelectedBatch() {
            const fileIdsToDownload = this.selectedIds.map(Number).filter(id => {
                const f = this.files.find(file => file.id === id);
                return f && !f.is_folder;
            });
            if (fileIdsToDownload.length === 0) {
                this.showToast(this.t('toast_only_files'), 'error');
                return;
            }
            if (this.selectedIds.length !== fileIdsToDownload.length) {
                this.showToast(this.t('toast_skipped_folders'));
            }

            // Start Batch Download UX
            this.batchDownload.active = true;
            this.batchDownload.total = fileIdsToDownload.length;
            this.batchDownload.current = 0;

            for (let i = 0; i < fileIdsToDownload.length; i++) {
                this.batchDownload.current = i + 1;
                const fileId = fileIdsToDownload[i];
                
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                iframe.src = `/s/${this.shareToken}/file/${fileId}/dl`;
                document.body.appendChild(iframe);
                
                // Cleanup iframe after some time
                setTimeout(() => iframe.remove(), 30000);

                if (i < fileIdsToDownload.length - 1) {
                    // Small delay to allow browser to handle multiple downloads
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            // End Batch Download UX
            setTimeout(() => {
                this.batchDownload.active = false;
                this.showToast(this.t('toast_dl_started'), 'success');
            }, 2000);

            this.selectedIds = [];
        },

        files: [], 
        totalSize: 0,
        searchQuery: '',
        currentPage: 1,
        itemsPerPage: 30,
        get imageFiles() {
            const imgExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'heic', 'heif'];
            return this.filteredFiles.filter(f => !f.is_folder && imgExts.includes(f.filename.split('.').pop().toLowerCase()));
        },
        get filteredFiles() {
            let results = [...this.files];
            if (this.searchQuery.trim() !== '') {
                const query = this.searchQuery.toLowerCase();
                results = results.filter(f => f.filename.toLowerCase().includes(query));
            }

            return results.sort((a, b) => {
                if (a.is_folder && !b.is_folder) return -1;
                if (!a.is_folder && b.is_folder) return 1;

                if (this.sortBy === 'name') {
                    const order = this.sortOrder === 'asc' ? 1 : -1;
                    return a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: 'base' }) * order;
                }

                let valA, valB;
                if (this.sortBy === 'date') {
                    valA = new Date(a.created_at).getTime() || 0;
                    valB = new Date(b.created_at).getTime() || 0;
                } else if (this.sortBy === 'size') {
                    valA = a.size || 0;
                    valB = b.size || 0;
                }

                if (valA < valB) return this.sortOrder === 'asc' ? -1 : 1;
                if (valA > valB) return this.sortOrder === 'asc' ? 1 : -1;
                return 0;
            });
        },
        toggleSort(field) {
            if (this.sortBy === field) {
                this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                this.sortBy = field;
                this.sortOrder = 'asc';
            }
        },
        get totalPages() {
            return 1;
        },
        get displayedFiles() {
            return this.filteredFiles;
        },
        get isOnlyFoldersSelected() {
            if (this.selectedIds.length === 0) return false;
            return this.selectedIds.every(id => {
                const f = this.files.find(file => file.id === Number(id));
                return f && f.is_folder;
            });
        },
        currentPath: '/', 
        openMenuId: null,
        selectedIds: [], 

        plyrInstance: null,
        imageViewer: { 
            show: false, 
            src: '', 
            filename: '', 
            currentFile: null, 
            isSlideshow: false, 
            slideshowInterval: null, 
            slideshowSpeed: 5000, 
            slideshowFiles: [], 
            slideshowIndex: 0,
            transitionDirection: 'next'
        },
        lightboxLoading: false,
        lightboxZoomed: false,
        lightboxControlsVisible: true,
        lightboxControlsTimeout: null,
        resetLightboxControlsTimeout() {
            this.lightboxControlsVisible = true;
            if (this.lightboxControlsTimeout) {
                clearTimeout(this.lightboxControlsTimeout);
            }
            this.lightboxControlsTimeout = setTimeout(() => {
                if (this.imageViewer.show) {
                    this.lightboxControlsVisible = false;
                }
            }, 3000);
        },
        comicViewer: { show: false, file: null, pages: [], pageUrls: [], currentPageIndex: 0, loading: false, fitMode: 'height', pageLoading: false, scrollMode: 'page', autoScrollActive: false, autoScrollSpeed: 2, settingsOpen: false, direction: 'ltr', viewMode: 'single', filter: 'none', zoomActive: false, touchStartX: 0, touchStartY: 0 },
        epubViewer: { show: false, file: null, loading: false, sidebarOpen: false, toc: [], fontSize: 100, pageProgress: 0, scrollMode: 'scrolled', autoScrollActive: false, autoScrollSpeed: 2, settingsOpen: false, spine: [], resourceBaseUrl: '', currentChapter: 0, title: '', theme: 'system', fontFamily: 'sans-serif' },
        fileInfoModal: { show: false, file: null, typeName: '', ext: '', svgIcon: '', bgColor: '', isMedia: false, mediaHtml: '', isLarge: false, isPreviewLoading: false, needsLoad: false, tooLarge: false, bypassWarning: false, unsupportedMedia: false },
        mediaPlayerModal: { show: false, file: null, isAudio: false, isPlaying: false, minimized: false, x: null, y: null, playlist: [], playlistIndex: -1, playlistOpen: false, bubbleMode: false, isDragging: false },
        contextMenu: { show: false, x: 0, y: 0, file: null },
        
        init() { 
            this.$watch('imageViewer.show', value => {
                if (!value) {
                    this.stopSlideshow();
                    this.imageViewer.isSlideshow = false;
                    this.imageViewer.slideshowFiles = [];
                    this.imageViewer.currentFile = null;
                    this.lightboxZoomed = false;
                    if (this.lightboxControlsTimeout) {
                        clearTimeout(this.lightboxControlsTimeout);
                        this.lightboxControlsTimeout = null;
                    }
                    this.lightboxControlsVisible = true;
                } else {
                    this.resetLightboxControlsTimeout();
                }
            });

            this.$watch('imageViewer.src', () => {
                this.lightboxZoomed = false;
            });

            this.$watch('mediaPlayerModal.minimized', value => {
                if (!value) {
                    this.mediaPlayerModal.x = null;
                    this.mediaPlayerModal.y = null;
                }
                if (this.playerInstance) {
                    setTimeout(() => {
                        try { this.playerInstance.resize(); } catch(e){}
                    }, 350);
                }
            });

            this.$watch('mediaPlayerModal.bubbleMode', value => {
                if (!value && this.mediaPlayerModal.minimized) {
                    if (this.mediaPlayerModal.x !== null && this.mediaPlayerModal.y !== null) {
                        const screenWidth = window.innerWidth;
                        const screenHeight = window.innerHeight;
                        const cardWidth = screenWidth >= 768 ? 380 : Math.min(screenWidth - 32, 340);
                        const cardHeight = this.mediaPlayerModal.playlistOpen ? 420 : 280;
                        
                        let newX = this.mediaPlayerModal.x;
                        let newY = this.mediaPlayerModal.y;
                        
                        if (newX + cardWidth > screenWidth - 10) {
                            newX = screenWidth - cardWidth - 10;
                        }
                        if (newX < 10) {
                            newX = 10;
                        }
                        
                        if (newY + cardHeight > screenHeight - 10) {
                            newY = screenHeight - cardHeight - 10;
                        }
                        if (newY < 10) {
                            newY = 10;
                        }
                        
                        this.mediaPlayerModal.x = newX;
                        this.mediaPlayerModal.y = newY;
                    }
                }
            });

            this.shareToken = this.$refs.token ? this.$refs.token.textContent.trim() : '';

            window.addEventListener('tc-translations-loaded', (e) => {
                this.lang = '';
                this.$nextTick(() => { this.lang = e.detail.lang; });
            });

            window.addEventListener('online', () => this.showToast(this.t('you_are_online'), 'success'));
            window.addEventListener('offline', () => this.showToast(this.t('you_are_offline'), 'error', 0));

            // Anti-Lost Floating Boundary on screen resize/rotate
            window.addEventListener('resize', () => {
                if (this.mediaPlayerModal.show && this.mediaPlayerModal.minimized && this.mediaPlayerModal.x !== null) {
                    const screenWidth = window.innerWidth;
                    const screenHeight = window.innerHeight;
                    const playerWidth = 340; // minimum width
                    const playerHeight = 260; // approximate height
                    let newX = this.mediaPlayerModal.x;
                    let newY = this.mediaPlayerModal.y;
                    if (newX > screenWidth - playerWidth - 10) newX = screenWidth - playerWidth - 10;
                    if (newX < 10) newX = 10;
                    if (newY > screenHeight - playerHeight - 10) newY = screenHeight - playerHeight - 10;
                    if (newY < 10) newY = 10;
                    this.mediaPlayerModal.x = newX;
                    this.mediaPlayerModal.y = newY;
                }
            });

            // Keyboard Shortcuts for Media Player Modal
            window.addEventListener('keydown', (e) => {
                if (!this.mediaPlayerModal.show) return;
                const activeEl = document.activeElement;
                if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
                    return;
                }
                const key = e.key;
                if (key === 'n' || key === 'N') {
                    e.preventDefault();
                    this.playNextTrack();
                } else if (key === 'p' || key === 'P') {
                    e.preventDefault();
                    this.playPrevTrack();
                }
                if (this.mediaPlayerModal.isAudio && this.plyrInstance) {
                    if (key === ' ' || key === 'k') {
                        e.preventDefault();
                        this.plyrInstance.togglePlay();
                    } else if (key === 'ArrowLeft') {
                        e.preventDefault();
                        this.plyrInstance.rewind(5);
                    } else if (key === 'ArrowRight') {
                        e.preventDefault();
                        this.plyrInstance.forward(5);
                    } else if (key === 'ArrowUp') {
                        e.preventDefault();
                        this.plyrInstance.volume = Math.min(1, this.plyrInstance.volume + 0.05);
                    } else if (key === 'ArrowDown') {
                        e.preventDefault();
                        this.plyrInstance.volume = Math.max(0, this.plyrInstance.volume - 0.05);
                    }
                } else if (!this.mediaPlayerModal.isAudio && this.playerInstance) {
                    if (key === ' ' || key === 'k') {
                        e.preventDefault();
                        this.playerInstance.toggle();
                    } else if (key === 'ArrowLeft') {
                        e.preventDefault();
                        this.playerInstance.backward = 5;
                    } else if (key === 'ArrowRight') {
                        e.preventDefault();
                        this.playerInstance.forward = 5;
                    } else if (key === 'ArrowUp') {
                        e.preventDefault();
                        this.playerInstance.volume = Math.min(1, this.playerInstance.volume + 0.05);
                    } else if (key === 'ArrowDown') {
                        e.preventDefault();
                        this.playerInstance.volume = Math.max(0, this.playerInstance.volume - 0.05);
                    }
                }
            });

            TeleCloud.initTheme('system');

            this.fetchFiles(false);

            // Fade out preloader once Alpine has finished loading the initial view
            this.$nextTick(() => {
                setTimeout(() => {
                    const preloader = document.getElementById('app-preloader');
                    if (preloader) {
                        preloader.classList.add('preloader-hidden');
                        setTimeout(() => preloader.remove(), 400);
                    }
                    document.body.classList.remove('preloader-active');
                }, 150);
            });
        },
        openContextMenu(e, file) {
            if (!file || file.is_folder) return; 
            this.contextMenu.file = file;
            let x = e.clientX; let y = e.clientY;
            if (window.innerWidth - x < 210) x = window.innerWidth - 210;
            if (window.innerHeight - y < 250) y = window.innerHeight - 250;
            this.contextMenu.x = x;
            this.contextMenu.y = y;
            this.contextMenu.show = true;
        },
        closeContextMenu() { this.contextMenu.show = false; },
        getBreadcrumbs() { return this.currentPath === '/' ? [] : this.currentPath.split('/').filter(Boolean); },
        navigateToFolder(folderName) { if (this.isLoading || this.isRefreshing) return; this.currentPath = this.currentPath === '/' ? '/' + folderName : this.currentPath + '/' + folderName; this.fetchFiles(); },
        navigateToIndex(index) { if (this.isLoading || this.isRefreshing) return; this.currentPath = '/' + this.getBreadcrumbs().slice(0, index + 1).join('/'); this.fetchFiles(); },
        navigateTo(path) { if (this.isLoading || this.isRefreshing) return; this.currentPath = path; this.fetchFiles(); },
        async fetchFiles(silentLoad = false) {
            if (this.isLoading || this.isRefreshing) return;
            const startTime = Date.now();
            if (!silentLoad && (!this.files || this.files.length === 0)) { this.isLoading = true; } else { this.isRefreshing = true; }
            try {
                const res = await fetch(`/s/${this.shareToken}/api/files?path=${encodeURIComponent(this.currentPath)}`);
                const data = await res.json();
                this.files = data.files || [];
                this.totalSize = data.total_size || 0;
                this.selectedIds = this.selectedIds.filter(id => this.files.some(f => f.id === id));
                if (!silentLoad) { this.searchQuery = ''; this.currentPage = 1; } else { if (this.currentPage > this.totalPages) this.currentPage = Math.max(1, this.totalPages); }
            } catch (e) { console.error('Fetch error', e); } finally { 
                const elapsed = Date.now() - startTime;
                if (elapsed < 500 && this.isRefreshing) await new Promise(r => setTimeout(r, 500 - elapsed));
                this.isLoading = false; this.isRefreshing = false; 
            }
        },
        
        closeFileInfoModal() {
            this.fileInfoModal.show = false;
            if (this.playerInstance) {
                try {
                    this.playerInstance.destroy();
                } catch(e) {
                    console.error("Error destroying player:", e);
                }
                this.playerInstance = null;
            }
            if (this.plyrInstance) { this.plyrInstance.destroy(); this.plyrInstance = null; }
            setTimeout(() => { if (!this.fileInfoModal.show) { this.fileInfoModal.isMedia = false; this.fileInfoModal.mediaHtml = ''; this.fileInfoModal.isLarge = false; this.fileInfoModal.isPreviewLoading = false; this.fileInfoModal.needsLoad = false; this.fileInfoModal.tooLarge = false; this.fileInfoModal.bypassWarning = false; this.fileInfoModal.unsupportedMedia = false; } }, 300);
        },
        openMediaPlayer(file) {
            this.closeFileInfoModal();
            const ext = file.filename.split('.').pop().toLowerCase();
            const videoExts = ['mp4', 'webm', 'ogg', 'mov', 'mkv', 'ogv', '3gp', 'flv', 'wmv'];
            const audioExts = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'opus', 'oga', 'aac', 'm4b'];
            const isAudio = audioExts.includes(ext);
            const streamUrl = `/s/${this.shareToken}/file/${file.id}/stream`;
            const thumbUrl = `/s/${this.shareToken}/file/${file.id}/thumb`;
            
            this.mediaPlayerModal = {
                show: true,
                file: file,
                isAudio: isAudio,
                isPlaying: false,
                minimized: false,
                x: null,
                y: null,
                playlist: [],
                playlistIndex: -1,
                playlistOpen: false,
                bubbleMode: false,
                isDragging: false
            };
            this.initPlaylist(file);
            
            setTimeout(async () => {
                await ensurePlayersLoaded();
                if (this.playerInstance) { try { this.playerInstance.destroy(); } catch(e){} this.playerInstance = null; }
                if (this.plyrInstance) { try { this.plyrInstance.destroy(); } catch(e){} this.plyrInstance = null; }
                
                // Network connection cleanup for previous audio
                const oldAudioEl = document.getElementById('cinema-audio-player');
                if (oldAudioEl) {
                    try {
                        oldAudioEl.pause();
                        oldAudioEl.innerHTML = '';
                        oldAudioEl.load();
                    } catch(e){}
                }
                
                const accentColor = getComputedStyle(document.body).getPropertyValue('--accent-color').trim() || '#3b82f6';
                
                if (isAudio) {
                    const plyrOpts = { controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'settings'], settings: ['speed'], speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] } };
                    const audioEl = document.getElementById('cinema-audio-player');
                    if (audioEl) {
                        audioEl.innerHTML = `<source src="${streamUrl}" type="${audioExts.includes(ext) ? 'audio/' + (ext === 'mp3' ? 'mpeg' : ext) : 'audio/mpeg'}">`;
                        this.plyrInstance = new Plyr(audioEl, plyrOpts);
                        this.plyrInstance.on('play', () => { this.mediaPlayerModal.isPlaying = true; });
                        this.plyrInstance.on('pause', () => { this.mediaPlayerModal.isPlaying = false; });
                        this.plyrInstance.on('ended', () => { this.playNextTrack(); });
                        setTimeout(() => {
                            try {
                                const p = this.plyrInstance.play();
                                if (p && typeof p.catch === 'function') p.catch(() => {});
                            } catch(e) {
                                try {
                                    const p = audioEl.play();
                                    if (p && typeof p.catch === 'function') p.catch(() => {});
                                } catch(err){}
                            }
                        }, 100);
                    }
                } else {
                    const matchedSubs = findSubtitlesForVideo(file.filename, this.files || [], true, this.shareToken);
                    this.playerInstance = new Artplayer({
                        logger: false,
                        container: '#cinema-video-player',
                        lang: this.lang === 'vi' ? 'vi' : 'en',
                        i18n: artplayerI18n,
                        url: streamUrl,
                        poster: thumbUrl,
                        title: file.filename,
                        theme: accentColor,
                        fullscreen: true,
                        fullscreenWeb: true,
                        pip: true,
                        setting: true,
                        playbackRate: true,
                        aspectRatio: true,
                        autoSize: false,
                        autoMini: true,
                        playsInline: true,
                        lock: true,
                        fastForward: true,
                        autoplay: true,
                        airplay: true,
                        type: ext === 'mkv' ? 'mp4' : ext,
                        moreVideoAttr: {
                            'playsinline': true,
                            'webkit-playsinline': true,
                            'x5-video-player-type': 'h5-page',
                        },
                        subtitle: {
                            url: matchedSubs.length > 0 ? matchedSubs[0].url : '',
                            type: matchedSubs.length > 0 ? matchedSubs[0].type : 'vtt',
                            style: {
                                color: '#ffffff',
                                fontSize: '20px',
                                textShadow: '0 0 4px #000, 0 0 4px #000',
                            },
                            escape: false,
                        },
                        settings: [
                            buildArtplayerSubtitleSetting(file.filename, this.files || true, this.shareToken, (k) => this.t(k)),
                            buildSubtitleBackgroundSetting((k) => this.t(k)),
                            buildSubtitleSizeSetting((k) => this.t(k)),
                            buildSubtitleColorSetting((k) => this.t(k))
                        ],
                        plugins: (function() {
                            const plugins = [];
                            if (window.artplayerPluginJassub && matchedSubs.length > 0 && matchedSubs[0].type === 'ass') {
                                plugins.push(window.artplayerPluginJassub({ subUrl: matchedSubs[0].url }));
                            }
                            if (window.artplayerPluginChapter) {
                                plugins.push(window.artplayerPluginChapter({ chapters: [] }));
                            }
                            return plugins;
                        })(),
                        icons: {
                            loading: '<div class="premium-loader mx-auto"></div>',
                            state: '<svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor" style="transform: translateX(2px);"><path d="M8 5v14l11-7z"/></svg>',
                            play: '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
                            pause: '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
                        }
                    });
                    applySubtitleStyles(this.playerInstance);
                    setupChapterDetection(this.playerInstance, file.filename, this.files || [], true, this.shareToken);
                    this.playerInstance.on('ready', () => {
                        applySubtitleStyles(this.playerInstance);
                        try { this.playerInstance.play(); } catch(e){}
                    });
                    this.playerInstance.on('video:ended', () => { this.playNextTrack(); });
                    this.playerInstance.on('play', () => { this.mediaPlayerModal.isPlaying = true; });
                    this.playerInstance.on('pause', () => { this.mediaPlayerModal.isPlaying = false; });
                    this.playerInstance.on('error', (error, reconnectTime) => {
                        const ua = navigator.userAgent;
                        const isApple = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Safari") && !ua.includes("Chrome") && !ua.includes("Edg"));
                        if (isApple) {
                            this.showToast(this.t('err_video_unsupported_apple'), "error");
                        }
                    });
                    this.playerInstance.on('fullscreen', (state) => document.body.classList.toggle('art-fullscreen-active', state));
                    this.playerInstance.on('fullscreenWeb', (state) => document.body.classList.toggle('art-fullscreen-active', state));
                }
            }, 50);
        },
        closeMediaPlayerModal() {
            this.mediaPlayerModal.show = false;
            this.mediaPlayerModal.isPlaying = false;
            if (this.playerInstance) {
                try { this.playerInstance.destroy(); } catch(e){}
                this.playerInstance = null;
            }
            if (this.plyrInstance) {
                try { this.plyrInstance.destroy(); } catch(e){}
                this.plyrInstance = null;
            }
            const audioEl = document.getElementById('cinema-audio-player');
            if (audioEl) {
                try {
                    audioEl.pause();
                    audioEl.innerHTML = '';
                    audioEl.load();
                } catch(e){}
            }
            setTimeout(() => {
                if (!this.mediaPlayerModal.show) {
                    this.mediaPlayerModal.minimized = false;
                    this.mediaPlayerModal.x = null;
                    this.mediaPlayerModal.y = null;
                    this.mediaPlayerModal.file = null;
                }
            }, 300);
        },
        startDrag(e) {
            if (!this.mediaPlayerModal.minimized) return;
            if (e.target.closest('button') || e.target.closest('a') || e.target.closest('audio') || e.target.closest('video')) {
                return;
            }
            if (!e.type.startsWith('touch')) {
                e.preventDefault();
            }
            const modalEl = e.currentTarget.closest('.fixed');
            if (!modalEl) return;
            const rect = modalEl.getBoundingClientRect();
            if (this.mediaPlayerModal.x === null) {
                this.mediaPlayerModal.x = rect.left;
                this.mediaPlayerModal.y = rect.top;
            }
            const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
            const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
            const dragStartX = clientX;
            const dragStartY = clientY;
            const playerStartX = this.mediaPlayerModal.x;
            const playerStartY = this.mediaPlayerModal.y;
            this.mediaPlayerModal.isDragging = false;
            let moved = false;
            const onDrag = (moveEvent) => {
                if (moveEvent.cancelable) {
                    moveEvent.preventDefault();
                }
                const curX = moveEvent.type.startsWith('touch') ? moveEvent.touches[0].clientX : moveEvent.clientX;
                const curY = moveEvent.type.startsWith('touch') ? moveEvent.touches[0].clientY : moveEvent.clientY;
                const deltaX = curX - dragStartX;
                const deltaY = curY - dragStartY;
                if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
                    moved = true;
                    this.mediaPlayerModal.isDragging = true;
                }
                let newX = playerStartX + deltaX;
                let newY = playerStartY + deltaY;
                const screenWidth = window.innerWidth;
                const screenHeight = window.innerHeight;
                const playerWidth = rect.width;
                const playerHeight = rect.height;
                if (newX < 10) newX = 10;
                if (newX > screenWidth - playerWidth - 10) newX = screenWidth - playerWidth - 10;
                if (newY < 10) newY = 10;
                if (newY > screenHeight - playerHeight - 10) newY = screenHeight - playerHeight - 10;
                this.mediaPlayerModal.x = newX;
                this.mediaPlayerModal.y = newY;
            };
            const onDragEnd = () => {
                document.removeEventListener('mousemove', onDrag);
                document.removeEventListener('mouseup', onDragEnd);
                document.removeEventListener('touchmove', onDrag);
                document.removeEventListener('touchend', onDragEnd);
                if (moved) {
                    setTimeout(() => {
                        this.mediaPlayerModal.isDragging = false;
                    }, 50);
                }
            };
            document.addEventListener('mousemove', onDrag);
            document.addEventListener('mouseup', onDragEnd);
            document.addEventListener('touchmove', onDrag, { passive: false });
            document.addEventListener('touchend', onDragEnd);
        },
        initPlaylist(currentFile) {
            const ext = currentFile.filename.split('.').pop().toLowerCase();
            const videoExts = ['mp4', 'webm', 'ogg', 'mov', 'mkv', 'ogv', '3gp', 'flv', 'wmv'];
            const audioExts = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'opus', 'oga', 'aac', 'm4b'];
            const allFiles = this.filteredFiles || [];
            this.mediaPlayerModal.playlist = allFiles.filter(f => {
                const fExt = f.filename.split('.').pop().toLowerCase();
                return videoExts.includes(fExt) || audioExts.includes(fExt);
            });
            this.mediaPlayerModal.playlistIndex = this.mediaPlayerModal.playlist.findIndex(f => String(f.id) === String(currentFile.id));
        },
        playTrackByIndex(index) {
            if (index < 0 || index >= this.mediaPlayerModal.playlist.length) return;
            const file = this.mediaPlayerModal.playlist[index];
            const minimized = this.mediaPlayerModal.minimized;
            const playlist = this.mediaPlayerModal.playlist;
            const playlistOpen = this.mediaPlayerModal.playlistOpen;
            const x = this.mediaPlayerModal.x;
            const y = this.mediaPlayerModal.y;
            
            this.openMediaPlayer(file);
            
            this.mediaPlayerModal.minimized = minimized;
            this.mediaPlayerModal.playlist = playlist;
            this.mediaPlayerModal.playlistIndex = index;
            this.mediaPlayerModal.playlistOpen = playlistOpen;
            this.mediaPlayerModal.x = x;
            this.mediaPlayerModal.y = y;
            this.mediaPlayerModal.bubbleMode = false;
        },
        playNextTrack() {
            if (this.mediaPlayerModal.playlist.length === 0) return;
            let nextIndex = this.mediaPlayerModal.playlistIndex + 1;
            if (nextIndex >= this.mediaPlayerModal.playlist.length) {
                nextIndex = 0;
            }
            this.playTrackByIndex(nextIndex);
        },
        playPrevTrack() {
            if (this.mediaPlayerModal.playlist.length === 0) return;
            let prevIndex = this.mediaPlayerModal.playlistIndex - 1;
            if (prevIndex < 0) {
                prevIndex = this.mediaPlayerModal.playlist.length - 1;
            }
            this.playTrackByIndex(prevIndex);
        },
        togglePlayState() {
            if (this.mediaPlayerModal.isAudio) {
                if (this.plyrInstance) {
                    this.plyrInstance.togglePlay();
                }
            } else {
                if (this.playerInstance) {
                    this.playerInstance.toggle();
                }
            }
        },
        openImageViewer(src, filename, file = null) {
            if (this.imageViewer.src === src && this.imageViewer.filename === filename) {
                this.imageViewer.show = true;
                if (file) {
                    this.imageViewer.currentFile = file;
                }
                return;
            }
            this.lightboxLoading = true;
            this.imageViewer = { 
                show: true, 
                src, 
                filename, 
                currentFile: file,
                isSlideshow: this.imageViewer.isSlideshow,
                slideshowInterval: this.imageViewer.slideshowInterval,
                slideshowSpeed: this.imageViewer.slideshowSpeed || 5000,
                slideshowFiles: this.imageViewer.slideshowFiles || [],
                slideshowIndex: this.imageViewer.slideshowIndex || 0,
                transitionDirection: this.imageViewer.transitionDirection || 'next'
            };
        },
        onLightboxImageLoad() {
            this.lightboxLoading = false;
            if (this.imageViewer.isSlideshow && this.imageViewer.slideshowInterval) {
                if (this.imageViewer.slideshowInterval !== 'waiting') {
                    clearTimeout(this.imageViewer.slideshowInterval);
                }
                this.imageViewer.slideshowInterval = setTimeout(() => {
                    this.nextSlideshowImage();
                }, this.imageViewer.slideshowSpeed);
            }
        },
        prevImage() {
            this.imageViewer.transitionDirection = 'prev';
            if (this.imageViewer.isSlideshow && this.imageViewer.slideshowFiles.length > 0) {
                this.prevSlideshowImage();
                return;
            }
            const images = this.imageFiles;
            if (images.length <= 1 || !this.imageViewer.currentFile) return;
            const currentIndex = images.findIndex(f => String(f.id) === String(this.imageViewer.currentFile.id));
            if (currentIndex === -1) return;
            let prevIndex = currentIndex - 1;
            if (prevIndex < 0) prevIndex = images.length - 1;
            const prevFile = images[prevIndex];
            this.lightboxLoading = true;
            let src = '';
            if (this.shareToken) {
                src = `/s/${this.shareToken}/file/${prevFile.id}/stream`;
            } else {
                src = `/api/files/${prevFile.id}/stream`;
            }
            this.imageViewer.src = src;
            this.imageViewer.filename = prevFile.filename;
            this.imageViewer.currentFile = prevFile;
        },
        nextImage() {
            this.imageViewer.transitionDirection = 'next';
            if (this.imageViewer.isSlideshow && this.imageViewer.slideshowFiles.length > 0) {
                this.nextSlideshowImage();
                return;
            }
            const images = this.imageFiles;
            if (images.length <= 1 || !this.imageViewer.currentFile) return;
            const currentIndex = images.findIndex(f => String(f.id) === String(this.imageViewer.currentFile.id));
            if (currentIndex === -1) return;
            let nextIndex = currentIndex + 1;
            if (nextIndex >= images.length) nextIndex = 0;
            const nextFile = images[nextIndex];
            this.lightboxLoading = true;
            let src = '';
            if (this.shareToken) {
                src = `/s/${this.shareToken}/file/${nextFile.id}/stream`;
            } else {
                src = `/api/files/${nextFile.id}/stream`;
            }
            this.imageViewer.src = src;
            this.imageViewer.filename = nextFile.filename;
            this.imageViewer.currentFile = nextFile;
        },
        startSlideshow() {
            if (this.imageViewer.slideshowInterval && this.imageViewer.slideshowInterval !== 'waiting') {
                clearTimeout(this.imageViewer.slideshowInterval);
            }
            this.imageViewer.isSlideshow = true;
            if (!this.lightboxLoading) {
                this.imageViewer.slideshowInterval = setTimeout(() => {
                    this.nextSlideshowImage();
                }, this.imageViewer.slideshowSpeed);
            } else {
                this.imageViewer.slideshowInterval = 'waiting';
            }
        },
        stopSlideshow() {
            if (this.imageViewer.slideshowInterval && this.imageViewer.slideshowInterval !== 'waiting') {
                clearTimeout(this.imageViewer.slideshowInterval);
            }
            this.imageViewer.slideshowInterval = null;
            this.imageViewer.isSlideshow = false;
        },
        toggleSlideshow() {
            if (this.imageViewer.slideshowInterval) {
                this.stopSlideshow();
            } else {
                this.startSlideshow();
            }
        },
        nextSlideshowImage() {
            this.imageViewer.transitionDirection = 'next';
            const files = this.imageViewer.slideshowFiles;
            if (!files || files.length === 0) return;
            // Only 1 image: reschedule timer without reloading (src unchanged → @load won't fire)
            if (files.length === 1) {
                if (this.imageViewer.slideshowInterval && this.imageViewer.slideshowInterval !== 'waiting') {
                    clearTimeout(this.imageViewer.slideshowInterval);
                }
                if (this.imageViewer.slideshowInterval !== null) {
                    this.imageViewer.slideshowInterval = setTimeout(() => {
                        this.nextSlideshowImage();
                    }, this.imageViewer.slideshowSpeed);
                }
                return;
            }
            let nextIndex = this.imageViewer.slideshowIndex + 1;
            if (nextIndex >= files.length) nextIndex = 0;
            this.imageViewer.slideshowIndex = nextIndex;
            const nextFile = files[nextIndex];
            
            let wasPlaying = !!this.imageViewer.slideshowInterval;
            if (this.imageViewer.slideshowInterval && this.imageViewer.slideshowInterval !== 'waiting') {
                clearTimeout(this.imageViewer.slideshowInterval);
            }
            this.imageViewer.slideshowInterval = wasPlaying ? 'waiting' : null;

            this.lightboxLoading = true;
            let src = '';
            if (this.shareToken) {
                src = `/s/${this.shareToken}/file/${nextFile.id}/stream`;
            } else {
                src = `/api/files/${nextFile.id}/stream`;
            }
            this.imageViewer.src = src;
            this.imageViewer.filename = nextFile.filename;
            this.imageViewer.currentFile = nextFile;
        },
        prevSlideshowImage() {
            this.imageViewer.transitionDirection = 'prev';
            const files = this.imageViewer.slideshowFiles;
            if (!files || files.length === 0) return;
            // Only 1 image: reschedule timer without reloading
            if (files.length === 1) {
                if (this.imageViewer.slideshowInterval && this.imageViewer.slideshowInterval !== 'waiting') {
                    clearTimeout(this.imageViewer.slideshowInterval);
                }
                if (this.imageViewer.slideshowInterval !== null) {
                    this.imageViewer.slideshowInterval = setTimeout(() => {
                        this.nextSlideshowImage();
                    }, this.imageViewer.slideshowSpeed);
                }
                return;
            }
            let prevIndex = this.imageViewer.slideshowIndex - 1;
            if (prevIndex < 0) prevIndex = files.length - 1;
            this.imageViewer.slideshowIndex = prevIndex;
            const prevFile = files[prevIndex];
            
            let wasPlaying = !!this.imageViewer.slideshowInterval;
            if (this.imageViewer.slideshowInterval && this.imageViewer.slideshowInterval !== 'waiting') {
                clearTimeout(this.imageViewer.slideshowInterval);
            }
            this.imageViewer.slideshowInterval = wasPlaying ? 'waiting' : null;

            this.lightboxLoading = true;
            let src = '';
            if (this.shareToken) {
                src = `/s/${this.shareToken}/file/${prevFile.id}/stream`;
            } else {
                src = `/api/files/${prevFile.id}/stream`;
            }
            this.imageViewer.src = src;
            this.imageViewer.filename = prevFile.filename;
            this.imageViewer.currentFile = prevFile;
        },
        startSelectedSlideshow() {
            let slideshowFiles = [];
            const imgExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'heic', 'heif'];
            if (this.selectedIds && this.selectedIds.length > 0) {
                let selectedFiles = this.files.filter(f => this.selectedIds.includes(f.id));
                slideshowFiles = selectedFiles.filter(f => !f.is_folder && imgExts.includes(f.filename.split('.').pop().toLowerCase()));
                if (slideshowFiles.length === 0) {
                    this.showToast(this.t('slideshow_no_images_selected'), 'error');
                    return;
                }
            } else {
                slideshowFiles = this.imageFiles;
                if (slideshowFiles.length === 0) {
                    this.showToast(this.t('no_images_to_play'), 'error');
                    return;
                }
            }
            this.imageViewer.isSlideshow = true;
            this.imageViewer.slideshowFiles = slideshowFiles;
            this.imageViewer.slideshowIndex = 0;
            this.imageViewer.slideshowSpeed = 5000;
            const firstFile = slideshowFiles[0];
            let src = '';
            if (this.shareToken) {
                src = `/s/${this.shareToken}/file/${firstFile.id}/stream`;
            } else {
                src = `/api/files/${firstFile.id}/stream`;
            }
            this.openImageViewer(src, firstFile.filename, firstFile);
            this.startSlideshow();
        },
        saveComicProgress() {
            if (this.comicViewer.file && this.comicViewer.file.id) {
                try {
                    localStorage.setItem(`comic-page-${this.comicViewer.file.id}`, this.comicViewer.currentPageIndex);
                } catch(e) {}
            }
        },
        toggleComicScrollMode() {
            const nextMode = this.comicViewer.scrollMode === 'page' ? 'continuous' : 'page';
            this.comicViewer.scrollMode = nextMode;
            if (nextMode === 'continuous') {
                this.$nextTick(() => {
                    setTimeout(() => {
                        const container = document.getElementById('comic-continuous-container') || 
                                          document.getElementById('share-comic-continuous-container') || 
                                          document.getElementById('share-folder-comic-continuous-container');
                        if (container) {
                            const wrapper = container.querySelector(`.comic-page-wrapper[data-index="${this.comicViewer.currentPageIndex}"]`);
                            if (wrapper) {
                                wrapper.scrollIntoView({ behavior: 'auto', block: 'start' });
                            }
                        }
                    }, 100);
                });
            } else {
                this.loadComicPage();
            }
        },
        openComicViewer(file, isShare = false, shareToken = '') {
            this.comicViewer.show = true;
            this.comicViewer.file = file;
            this.comicViewer.pages = [];
            this.comicViewer.pageUrls = [];
            this.comicViewer.zoomActive = false;
            
            let savedPage = 0;
            if (file && file.id) {
                try {
                    const saved = localStorage.getItem(`comic-page-${file.id}`);
                    if (saved !== null) {
                        savedPage = parseInt(saved, 10) || 0;
                    }
                } catch(e) {}
            }
            this.comicViewer.currentPageIndex = savedPage;
            
            this.comicViewer.scrollMode = 'page';
            this.comicViewer.loading = true;
            this.comicViewer.settingsOpen = false;

            let savedDirection = 'ltr';
            try { savedDirection = localStorage.getItem('comic-reader-direction') || 'ltr'; } catch(e) {}
            this.comicViewer.direction = savedDirection;

            let savedViewMode = 'single';
            try { savedViewMode = localStorage.getItem('comic-reader-view-mode') || 'single'; } catch(e) {}
            this.comicViewer.viewMode = savedViewMode;

            let savedFilter = 'none';
            try { savedFilter = localStorage.getItem('comic-reader-filter') || 'none'; } catch(e) {}
            this.comicViewer.filter = savedFilter;
            
            const hasShareToken = !!(this.shareToken || this.token || shareToken);
            const token = this.shareToken || this.token || shareToken;
            
            const listUrl = hasShareToken 
                ? (file.id ? `/s/${token}/file/${file.id}/cbz/list` : `/s/${token}/cbz/list`)
                : `/api/files/${file.id}/cbz/list`;

            fetch(listUrl)
                .then(res => {
                    if (!res.ok) throw new Error("Failed to load comic structure");
                    return res.json();
                })
                .then(data => {
                    if (!this.comicViewer.show || !this.comicViewer.file || String(this.comicViewer.file.id) !== String(file.id) || this.comicViewer.file.filename !== file.filename) return;
                    this.comicViewer.pages = data.pages || [];
                    
                    if (file) {
                        this.comicViewer.pageUrls = this.comicViewer.pages.map(pagePath => {
                            return hasShareToken
                                ? (file.id ? `/s/${token}/file/${file.id}/cbz/page?path=${encodeURIComponent(pagePath)}` : `/s/${token}/cbz/page?path=${encodeURIComponent(pagePath)}`)
                                : `/api/files/${file.id}/cbz/page?path=${encodeURIComponent(pagePath)}`;
                        });
                    } else {
                        this.comicViewer.pageUrls = [];
                    }
                    
                    this.comicViewer.loading = false;
                    if (this.comicViewer.pages.length > 0) {
                        if (this.comicViewer.currentPageIndex >= this.comicViewer.pages.length) {
                            this.comicViewer.currentPageIndex = 0;
                        }
                        this.loadComicPage(token);
                        this.preloadNextComicPage();

                        this.$nextTick(() => {
                            const container = document.getElementById('comic-continuous-container') || 
                                              document.getElementById('share-comic-continuous-container') || 
                                              document.getElementById('share-folder-comic-continuous-container');
                            if (container) {
                                container.onscroll = () => {
                                    if (this.comicViewer.scrollMode !== 'continuous') return;
                                    const wrappers = container.querySelectorAll('.comic-page-wrapper');
                                    let activeIndex = 0;
                                    let minDiff = Infinity;
                                    wrappers.forEach((wrapper, idx) => {
                                        const rect = wrapper.getBoundingClientRect();
                                        const diff = Math.abs(rect.top);
                                        if (diff < minDiff) {
                                            minDiff = diff;
                                            activeIndex = idx;
                                        }
                                    });
                                    if (activeIndex !== this.comicViewer.currentPageIndex && activeIndex >= 0 && activeIndex < this.comicViewer.pages.length) {
                                        this.comicViewer.currentPageIndex = activeIndex;
                                        this.saveComicProgress();
                                    }
                                };
                            }

                            setTimeout(() => {
                                if (this.comicViewer.scrollMode === 'continuous') {
                                    if (container) {
                                        const wrapper = container.querySelector(`.comic-page-wrapper[data-index="${this.comicViewer.currentPageIndex}"]`);
                                        if (wrapper) {
                                            wrapper.scrollIntoView({ behavior: 'auto', block: 'start' });
                                        }
                                    }
                                }
                            }, 400);
                        });
                    }
                })
                .catch(err => {
                    console.error(err);
                    this.showToast(this.t('err_loading_comic'), 'error');
                    this.comicViewer.show = false;
                    this.comicViewer.loading = false;
                });
        },
        loadComicPage(tokenOpt) {
            if (this.comicViewer.currentPageIndex < 0 || this.comicViewer.currentPageIndex >= this.comicViewer.pages.length) return;
            const file = this.comicViewer.file;
            if (!file) return;
            
            const pageUrl = this.comicViewer.pageUrls[this.comicViewer.currentPageIndex];
            if (!pageUrl) return;
            
            this.comicViewer.pageLoading = true;
            
            const img = new Image();
            img.onload = () => {
                this.comicViewer.pageLoading = false;
            };
            img.onerror = () => {
                this.comicViewer.pageLoading = false;
            };
            img.src = pageUrl;
        },
        nextComicPage() {
            this.comicViewer.zoomActive = false;
            this.changeComicPageIndex(1);
        },
        prevComicPage() {
            this.comicViewer.zoomActive = false;
            this.changeComicPageIndex(-1);
        },
        handleComicTouchStart(e) {
            if (this.comicViewer.zoomActive || this.comicViewer.scrollMode !== 'page') return;
            this.comicViewer.touchStartX = e.changedTouches[0].screenX;
            this.comicViewer.touchStartY = e.changedTouches[0].screenY;
        },
        handleComicTouchEnd(e) {
            if (this.comicViewer.zoomActive || this.comicViewer.scrollMode !== 'page') return;
            const endX = e.changedTouches[0].screenX;
            const endY = e.changedTouches[0].screenY;
            const diffX = endX - this.comicViewer.touchStartX;
            const diffY = endY - this.comicViewer.touchStartY;
            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
                const isRTL = this.comicViewer.direction === 'rtl';
                if (diffX > 0) {
                    if (isRTL) this.nextComicPage();
                    else this.prevComicPage();
                } else {
                    if (isRTL) this.prevComicPage();
                    else this.nextComicPage();
                }
            }
        },
        changeComicPageIndex(logicalStep) {
            const pagesCount = this.comicViewer.pages.length;
            if (pagesCount <= 0) return;
            
            let cur = this.comicViewer.currentPageIndex;
            let target = cur;
            const viewMode = this.comicViewer.viewMode || 'single';
            
            if (viewMode === 'single') {
                target = cur + logicalStep;
            } else if (viewMode === 'double') {
                if (cur % 2 !== 0) {
                    cur = cur - 1;
                }
                target = cur + (logicalStep * 2);
                if (target < 0) target = 0;
            }
            
            if (target < 0) target = 0;
            if (target >= pagesCount) {
                if (viewMode === 'double') {
                    target = Math.floor((pagesCount - 1) / 2) * 2;
                } else {
                    target = pagesCount - 1;
                }
            }
            
            if (target !== this.comicViewer.currentPageIndex) {
                this.comicViewer.currentPageIndex = target;
                this.loadComicPage();
                if (logicalStep > 0) {
                    this.preloadNextComicPage();
                }
                this.saveComicProgress();
            }
        },
        getComicPagesToRender() {
            const pagesCount = this.comicViewer.pages.length;
            if (pagesCount <= 0) return [];
            
            const cur = this.comicViewer.currentPageIndex;
            const viewMode = this.comicViewer.viewMode || 'single';
            
            if (viewMode === 'single' || this.comicViewer.scrollMode === 'continuous') {
                return [cur];
            }
            
            if (viewMode === 'double') {
                let pairStart = cur;
                if (cur % 2 !== 0) {
                    pairStart = cur - 1;
                }
                const result = [pairStart];
                if (pairStart + 1 < pagesCount) {
                    result.push(pairStart + 1);
                }
                return result;
            }
            
            return [cur];
        },
        setComicDirection(dir) {
            this.comicViewer.direction = dir;
            try { localStorage.setItem('comic-reader-direction', dir); } catch(e) {}
        },
        setComicViewMode(mode) {
            this.comicViewer.viewMode = mode;
            try { localStorage.setItem('comic-reader-view-mode', mode); } catch(e) {}
            if (mode !== 'single') {
                let cur = this.comicViewer.currentPageIndex;
                if (mode === 'double') {
                    if (cur % 2 !== 0) {
                        this.comicViewer.currentPageIndex = Math.max(0, cur - 1);
                    }
                }
            }
        },
        setComicFilter(filter) {
            this.comicViewer.filter = filter;
            try { localStorage.setItem('comic-reader-filter', filter); } catch(e) {}
        },
        getComicFilterStyle() {
            const f = this.comicViewer.filter || 'none';
            if (f === 'eye-care') return 'sepia(0.35) saturate(1.2) hue-rotate(-10deg)';
            if (f === 'sepia') return 'sepia(0.85) contrast(0.95)';
            if (f === 'contrast') return 'contrast(1.4) brightness(1.05)';
            if (f === 'grayscale') return 'grayscale(1) contrast(1.1)';
            return 'none';
        },
        toggleComicZoom(event) {
            if (this.comicViewer.scrollMode !== 'page') return;
            this.comicViewer.zoomActive = !this.comicViewer.zoomActive;
            if (this.comicViewer.zoomActive) {
                this.$nextTick(() => {
                    const container = event.target.closest('.overflow-auto') || event.target.parentElement;
                    if (container) {
                        let isDown = false;
                        let startX, startY;
                        let scrollLeft, scrollTop;
                        
                        const onMouseDown = (e) => {
                            if (!this.comicViewer.zoomActive) return;
                            isDown = true;
                            container.classList.add('cursor-grabbing');
                            startX = e.pageX - container.offsetLeft;
                            startY = e.pageY - container.offsetTop;
                            scrollLeft = container.scrollLeft;
                            scrollTop = container.scrollTop;
                        };
                        
                        const onMouseLeaveOrUp = () => {
                            isDown = false;
                            container.classList.remove('cursor-grabbing');
                        };
                        
                        const onMouseMove = (e) => {
                            if (!isDown || !this.comicViewer.zoomActive) return;
                            e.preventDefault();
                            const x = e.pageX - container.offsetLeft;
                            const y = e.pageY - container.offsetTop;
                            const walkX = (x - startX) * 1.5;
                            const walkY = (y - startY) * 1.5;
                            container.scrollLeft = scrollLeft - walkX;
                            container.scrollTop = scrollTop - walkY;
                        };
                        
                        container.removeEventListener('mousedown', container._onMouseDown);
                        container.removeEventListener('mouseleave', container._onMouseLeave);
                        container.removeEventListener('mouseup', container._onMouseUp);
                        container.removeEventListener('mousemove', container._onMouseMove);
                        
                        container._onMouseDown = onMouseDown;
                        container._onMouseLeave = onMouseLeaveOrUp;
                        container._onMouseUp = onMouseLeaveOrUp;
                        container._onMouseMove = onMouseMove;
                        
                        container.addEventListener('mousedown', onMouseDown);
                        container.addEventListener('mouseleave', onMouseLeaveOrUp);
                        container.addEventListener('mouseup', onMouseLeaveOrUp);
                        container.addEventListener('mousemove', onMouseMove);
                    }
                });
            } else {
                const container = event.target.closest('.overflow-auto') || event.target.parentElement;
                if (container) {
                    container.classList.remove('cursor-grabbing');
                    container.scrollLeft = 0;
                    container.scrollTop = 0;
                }
            }
        },
        preloadNextComicPage() {
            const nextIndex = this.comicViewer.currentPageIndex + 1;
            if (nextIndex < this.comicViewer.pages.length) {
                const file = this.comicViewer.file;
                if (!file) return;
                
                const pageUrl = this.comicViewer.pageUrls[nextIndex];
                if (!pageUrl) return;
                
                const img = new Image();
                img.src = pageUrl;
            }
        },
        closeComicViewer() {
            if (window._comicAutoScrollRaf) {
                cancelAnimationFrame(window._comicAutoScrollRaf);
                window._comicAutoScrollRaf = null;
            }
            if (window._comicIntersectionObserver) {
                window._comicIntersectionObserver.disconnect();
                window._comicIntersectionObserver = null;
            }
            this.comicViewer.show = false;
            this.comicViewer.autoScrollActive = false;
            const urls = this.comicViewer.pageUrls ? [...this.comicViewer.pageUrls] : [];
            setTimeout(() => {
                if (this.comicViewer.show) return; // viewer was reopened — leave state alone
                const pageImg = document.getElementById('comic-viewer-img') || document.getElementById('comic-viewer-img-file') || document.getElementById('comic-viewer-img-folder');
                if (pageImg) pageImg.removeAttribute('src');
                this.comicViewer.file = null;
                this.comicViewer.pages = [];
                this.comicViewer.pageUrls = [];
                this.comicViewer.settingsOpen = false;
                urls.forEach(u => { if (u && u.startsWith('blob:')) try { URL.revokeObjectURL(u); } catch(e) {} });
            }, 400);
        },
        toggleComicAutoScroll() {
            this.comicViewer.autoScrollActive = !this.comicViewer.autoScrollActive;
            if (this.comicViewer.autoScrollActive) {
                this.startComicAutoScroll();
            } else {
                this.stopComicAutoScroll();
            }
        },
        startComicAutoScroll() {
            if (window._comicAutoScrollRaf) {
                cancelAnimationFrame(window._comicAutoScrollRaf);
            }
            const scrollLoop = () => {
                if (!this.comicViewer.show || !this.comicViewer.autoScrollActive) {
                    this.comicViewer.autoScrollActive = false;
                    if (window._comicAutoScrollRaf) {
                        cancelAnimationFrame(window._comicAutoScrollRaf);
                        window._comicAutoScrollRaf = null;
                    }
                    return;
                }
                try {
                    const container = document.getElementById('comic-continuous-container') || 
                                      document.getElementById('share-comic-continuous-container') || 
                                      document.getElementById('share-folder-comic-continuous-container');
                    if (container) {
                        container.scrollTop += Math.pow(this.comicViewer.autoScrollSpeed, 2) * 0.25;
                    } else {
                        this.stopComicAutoScroll();
                        return;
                    }
                } catch (e) {
                    console.error("Comic auto-scroll error:", e);
                    this.stopComicAutoScroll();
                    return;
                }
                window._comicAutoScrollRaf = requestAnimationFrame(scrollLoop);
            };
            window._comicAutoScrollRaf = requestAnimationFrame(scrollLoop);
        },
        stopComicAutoScroll() {
            this.comicViewer.autoScrollActive = false;
            if (window._comicAutoScrollRaf) {
                cancelAnimationFrame(window._comicAutoScrollRaf);
                window._comicAutoScrollRaf = null;
            }
        },
        changeComicAutoScrollSpeed(amount) {
            this.comicViewer.autoScrollSpeed = Math.max(1, Math.min(10, this.comicViewer.autoScrollSpeed + amount));
        },
        openEpubViewer(file, isShare = false, shareToken = '') {
            this._transitioningChapter = false;
            this.epubViewer.show = true;
            this.epubViewer.file = file;
            this.epubViewer.loading = true;
            this.epubViewer.toc = [];
            this.epubViewer.sidebarOpen = false;
            this.epubViewer.fontSize = 100;
            this.epubViewer.pageProgress = 0;
            this.epubViewer.spine = [];
            this.epubViewer.currentChapter = 0;
            this.epubViewer.title = '';
            this.epubViewer.settingsOpen = false;
            
            // Restore theme & fontFamily
            let savedTheme = 'system';
            try { savedTheme = localStorage.getItem('epub-reader-theme') || 'system'; } catch(e) {}
            this.epubViewer.theme = savedTheme;

            let savedFontFamily = 'sans-serif';
            try { savedFontFamily = localStorage.getItem('epub-reader-font-family') || 'sans-serif'; } catch(e) {}
            this.epubViewer.fontFamily = savedFontFamily;
            
            const token = this.shareToken || this.token || shareToken || '';
            const hasShareToken = !!token;
            
            const metaUrl = hasShareToken
                ? (file.id ? `/s/${token}/file/${file.id}/epub/meta` : `/s/${token}/epub/meta`)
                : `/api/files/${file.id}/epub/meta`;
            
            const resourceBaseUrl = hasShareToken
                ? (file.id ? `/s/${token}/file/${file.id}/epub/resource` : `/s/${token}/epub/resource`)
                : `/api/files/${file.id}/epub/resource`;
            
            this.epubViewer.resourceBaseUrl = resourceBaseUrl;

            // Clean up previous
            if (window._epubBook) {
                try { window._epubBook.destroy(); } catch(e) {}
                window._epubBook = null;
                window._epubRendition = null;
            }

            this.$nextTick(() => {
                const area = document.getElementById('epub-viewer-area');
                if (area) area.innerHTML = '<iframe id="epub-iframe" class="w-full h-full border-0" sandbox="allow-same-origin" style="background:#fff"></iframe>';
                
                (async () => {
                    try {
                        const res = await fetch(metaUrl, { credentials: 'same-origin' });
                        if (!res.ok) throw new Error('meta_fetch_failed');
                        const meta = await res.json();
                        
                        if (!this.epubViewer.show || !this.epubViewer.file || String(this.epubViewer.file.id) !== String(file.id) || this.epubViewer.file.filename !== file.filename) return;
                        
                        // Flatten TOC recursively and add indent levels + unique ids
                        const flattenToc = (items, level = 0) => {
                            let result = [];
                            items.forEach((item, idx) => {
                                result.push({
                                    id: `toc-${level}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
                                    label: item.label,
                                    href: item.href,
                                    level: level
                                });
                                if (item.children && item.children.length > 0) {
                                    result = result.concat(flattenToc(item.children, level + 1));
                                }
                            });
                            return result;
                        };
                        this.epubViewer.toc = flattenToc(meta.toc || []);
                        this.epubViewer.spine = meta.spine || [];
                        this.epubViewer.title = meta.title || file.filename;
                        
                        // Restore reading position
                        const savedChapter = file.id ? parseInt(localStorage.getItem(`epub-ch-${file.id}`) || '0') : 0;
                        this.epubViewer.currentChapter = Math.max(0, Math.min(savedChapter, this.epubViewer.spine.length - 1));
                        
                        this._loadEpubChapter(file, false, true);
                    } catch (err) {
                        console.error('EPUB meta failed:', err);
                        if (this.epubViewer.file && String(this.epubViewer.file.id) === String(file.id) && this.epubViewer.file.filename === file.filename) {
                            this.showToast(this.t('err_loading_epub'), 'error');
                            this.epubViewer.show = false;
                            this.epubViewer.loading = false;
                        }
                    }
                })();
            });
        },
        _normalizePath(p) {
            if (!p) return '';
            try { p = decodeURIComponent(p); } catch(e) {}
            p = p.replace(/\\/g, '/'); // normalize backslashes
            if (p.startsWith('./')) p = p.substring(2);
            p = p.replace(/\/+/g, '/');
            return p.trim();
        },
        _resolveRelativePath(base, relative) {
            if (relative.startsWith('/')) return relative.substring(1);
            if (relative.includes('://')) return relative;
            
            const baseParts = base.split('/');
            baseParts.pop(); // remove filename
            
            const relParts = relative.split('/');
            for (const part of relParts) {
                if (part === '.' || part === '') {
                    continue;
                } else if (part === '..') {
                    if (baseParts.length > 0) baseParts.pop();
                } else {
                    baseParts.push(part);
                }
            }
            return baseParts.join('/');
        },
        _loadEpubChapter(file, startAtBottom = false, restoreScroll = false) {
            const chapter = this.epubViewer.spine[this.epubViewer.currentChapter];
            if (!chapter) return;
            
            this.epubViewer.loading = true;
            const iframe = document.getElementById('epub-iframe');
            if (!iframe) return;
            
            iframe.onload = () => {
                if (!this.epubViewer.show || !this.epubViewer.file || String(this.epubViewer.file.id) !== String(file.id) || this.epubViewer.file.filename !== file.filename) return;
                this.epubViewer.loading = false;
                this._transitioningChapter = false;
                this.applyEpubTheme();
                
                const win = iframe.contentWindow;
                const doc = iframe.contentDocument;
                
                // Intercept links inside the iframe
                doc.querySelectorAll('a').forEach(a => {
                    a.addEventListener('click', (e) => {
                        const href = a.getAttribute('href');
                        if (!href) return;
                        
                        if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:') || href.startsWith('tel:')) {
                            e.preventDefault();
                            window.open(href, '_blank');
                            return;
                        }
                        
                        e.preventDefault();
                        const currentChapter = this.epubViewer.spine[this.epubViewer.currentChapter];
                        if (currentChapter) {
                            const resolvedHref = this._resolveRelativePath(currentChapter.href, href);
                            this.navigateToCfi(resolvedHref);
                        }
                    });
                });

                // Restore/set scroll position
                if (startAtBottom) {
                    try { win.scrollTo(0, doc.documentElement.scrollHeight || doc.body.scrollHeight || 999999); } catch(e) {}
                } else {
                    const savedScroll = (restoreScroll && file.id) ? localStorage.getItem(`epub-scroll-${file.id}`) : null;
                    if (savedScroll) {
                        try { win.scrollTo(0, parseInt(savedScroll)); } catch(e) {}
                        localStorage.removeItem(`epub-scroll-${file.id}`);
                    } else {
                        win.scrollTo(0, 0);
                    }
                }
                
                // Add scroll listener inside the iframe to save progress and auto-navigate chapters
                let lastScrollTime = 0;
                let lastScrollTop = win.scrollY || doc.documentElement.scrollTop || 0;
                
                win.addEventListener('scroll', () => {
                    const scrollTop = win.scrollY || doc.documentElement.scrollTop || 0;
                    const scrollHeight = doc.documentElement.scrollHeight || doc.body.scrollHeight || 0;
                    const clientHeight = doc.documentElement.clientHeight || win.innerHeight || 0;
                    
                    const isScrollingUp = scrollTop < lastScrollTop;
                    lastScrollTop = scrollTop;
                    
                    // Throttle progress saving
                    const now = Date.now();
                    if (now - lastScrollTime > 1000) {
                        this._saveEpubScroll();
                        lastScrollTime = now;
                    }
                });


            };
            
            iframe.src = `${this.epubViewer.resourceBaseUrl}/${chapter.href}`;
            
            // Save reading position
            if (file.id) {
                try { localStorage.setItem(`epub-ch-${file.id}`, this.epubViewer.currentChapter); } catch(e) {}
            }
            
            // Update progress
            if (this.epubViewer.spine.length > 0) {
                this.epubViewer.pageProgress = Math.round(((this.epubViewer.currentChapter + 1) / this.epubViewer.spine.length) * 100);
            }
        },
        nextEpubChapter() {
            if (this.epubViewer.currentChapter < this.epubViewer.spine.length - 1) {
                this.epubViewer.currentChapter++;
                if (this.epubViewer.file && this.epubViewer.file.id) {
                    try {
                        localStorage.setItem(`epub-ch-${this.epubViewer.file.id}`, this.epubViewer.currentChapter);
                        localStorage.removeItem(`epub-scroll-${this.epubViewer.file.id}`);
                    } catch(e) {}
                }
                this._loadEpubChapter(this.epubViewer.file, false, false);
            }
        },
        prevEpubChapter(startAtBottom = false) {
            if (this.epubViewer.currentChapter > 0) {
                this.epubViewer.currentChapter--;
                if (this.epubViewer.file && this.epubViewer.file.id) {
                    try {
                        localStorage.setItem(`epub-ch-${this.epubViewer.file.id}`, this.epubViewer.currentChapter);
                        localStorage.removeItem(`epub-scroll-${this.epubViewer.file.id}`);
                    } catch(e) {}
                }
                this._loadEpubChapter(this.epubViewer.file, startAtBottom, false);
            }
        },
        _saveEpubScroll() {
            const iframe = document.getElementById('epub-iframe');
            if (iframe && iframe.contentWindow && this.epubViewer.file && this.epubViewer.file.id) {
                try { localStorage.setItem(`epub-scroll-${this.epubViewer.file.id}`, iframe.contentWindow.scrollY || iframe.contentDocument.documentElement.scrollTop || 0); } catch(e) {}
            }
        },
        navigateToCfi(href) {
            const fullHref = typeof href === 'string' ? href : (href && href.href ? href.href : '');
            const parts = fullHref.split('#');
            const rawBaseHref = parts[0];
            const fragment = parts[1] || '';
            
            const baseHref = this._normalizePath(rawBaseHref);
            
            const idx = this.epubViewer.spine.findIndex(s => {
                const spineHref = this._normalizePath(s.href);
                return spineHref === baseHref || spineHref.endsWith('/' + baseHref) || baseHref.endsWith('/' + spineHref);
            });
            
            if (idx >= 0) {
                this.epubViewer.currentChapter = idx;
                if (this.epubViewer.file && this.epubViewer.file.id) {
                    try {
                        localStorage.setItem(`epub-ch-${this.epubViewer.file.id}`, this.epubViewer.currentChapter);
                        localStorage.removeItem(`epub-scroll-${this.epubViewer.file.id}`);
                    } catch(e) {}
                }
                this._loadEpubChapter(this.epubViewer.file, false, false);
                if (fragment) {
                    setTimeout(() => {
                        const iframe = document.getElementById('epub-iframe');
                        if (iframe && iframe.contentDocument) {
                            let el = iframe.contentDocument.getElementById(fragment);
                            if (!el) {
                                const els = iframe.contentDocument.getElementsByName(fragment);
                                if (els && els.length > 0) el = els[0];
                            }
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }
                    }, 500);
                }
            }
            this.epubViewer.sidebarOpen = false;
        },
        applyEpubTheme() {
            const iframe = document.getElementById('epub-iframe');
            if (!iframe || !iframe.contentDocument) return;
            
            const doc = iframe.contentDocument;
            const win = iframe.contentWindow;
            const isDark = document.documentElement.classList.contains('dark');
            
            let themeKey = this.epubViewer.theme || 'system';
            if (themeKey === 'system') {
                themeKey = isDark ? 'dark' : 'light';
            }
            
            const EPUB_THEMES = {
                light: { bg: '#ffffff', fg: '#0f172a', scrollbarThumb: '#cbd5e1', scrollbarThumbHover: '#94a3b8' },
                dark: { bg: '#0f172a', fg: '#f1f5f9', scrollbarThumb: '#475569', scrollbarThumbHover: '#64748b' },
                sepia: { bg: '#f4ecd8', fg: '#433422', scrollbarThumb: '#cbbb97', scrollbarThumbHover: '#ab9c78' },
                cream: { bg: '#faf6ee', fg: '#2c2c2c', scrollbarThumb: '#d5c4b1', scrollbarThumbHover: '#c5b19b' },
                olive: { bg: '#e8f5e9', fg: '#1b4332', scrollbarThumb: '#a3cfad', scrollbarThumbHover: '#82ba8f' }
            };
            
            const theme = EPUB_THEMES[themeKey] || EPUB_THEMES.light;
            const bg = theme.bg;
            const fg = theme.fg;
            
            const FONT_FAMILIES = {
                'sans-serif': 'Inter, system-ui, -apple-system, sans-serif',
                'serif': 'Georgia, Cambria, "Times New Roman", serif',
                'monospace': 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                'dyslexic': '"Comic Sans MS", "Chalkboard SE", sans-serif'
            };
            const font = FONT_FAMILIES[this.epubViewer.fontFamily || 'sans-serif'] || FONT_FAMILIES['sans-serif'];
            
            let style = doc.getElementById('tc-epub-theme');
            if (!style) {
                style = doc.createElement('style');
                style.id = 'tc-epub-theme';
                doc.head.appendChild(style);
            }
            style.textContent = `
                body { background: ${bg} !important; color: ${fg} !important; font-size: ${this.epubViewer.fontSize}% !important; line-height: 1.6 !important; padding: 20px !important; max-width: 800px !important; margin: 0 auto !important; font-family: ${font} !important; }
                p, span, div, li, td, th, h1, h2, h3, h4, h5, h6 { color: ${fg} !important; font-family: ${font} !important; }
                a { color: #3b82f6 !important; }
                img, svg { max-width: 100% !important; height: auto !important; }
                
                /* Custom slim scrollbar inside iframe */
                ::-webkit-scrollbar {
                    width: 8px;
                    height: 8px;
                }
                ::-webkit-scrollbar-track {
                    background: transparent;
                }
                ::-webkit-scrollbar-thumb {
                    background: ${theme.scrollbarThumb};
                    border-radius: 4px;
                }
                ::-webkit-scrollbar-thumb:hover {
                    background: ${theme.scrollbarThumbHover};
                }
            `;
        },
        setEpubTheme(theme) {
            this.epubViewer.theme = theme;
            try { localStorage.setItem('epub-reader-theme', theme); } catch(e) {}
            this.applyEpubTheme();
        },
        setEpubFontFamily(fontFamily) {
            this.epubViewer.fontFamily = fontFamily;
            try { localStorage.setItem('epub-reader-font-family', fontFamily); } catch(e) {}
            this.applyEpubTheme();
        },
        getEpubThemeStyles() {
            const isDark = document.documentElement.classList.contains('dark');
            let themeKey = this.epubViewer.theme || 'system';
            if (themeKey === 'system') {
                themeKey = isDark ? 'dark' : 'light';
            }
            
            const EPUB_THEMES = {
                light: {
                    bg: '#ffffff',
                    fg: '#0f172a',
                    headerBg: '#f8fafc',
                    sidebarBg: '#f8fafc',
                    footerBg: '#f8fafc',
                    border: '#e2e8f0',
                    hoverBg: 'rgba(15, 23, 42, 0.05)'
                },
                dark: {
                    bg: '#0f172a',
                    fg: '#f1f5f9',
                    headerBg: '#1e293b',
                    sidebarBg: '#1e293b',
                    footerBg: '#1e293b',
                    border: '#334155',
                    hoverBg: 'rgba(241, 245, 249, 0.1)'
                },
                sepia: {
                    bg: '#f4ecd8',
                    fg: '#433422',
                    headerBg: '#ebdcb9',
                    sidebarBg: '#ebdcb9',
                    footerBg: '#ebdcb9',
                    border: '#decfa6',
                    hoverBg: 'rgba(67, 52, 34, 0.08)'
                },
                cream: {
                    bg: '#faf6ee',
                    fg: '#2c2c2c',
                    headerBg: '#f2eae0',
                    sidebarBg: '#f2eae0',
                    footerBg: '#f2eae0',
                    border: '#e4d5c3',
                    hoverBg: 'rgba(44, 44, 44, 0.06)'
                },
                olive: {
                    bg: '#e8f5e9',
                    fg: '#1b4332',
                    headerBg: '#d4edda',
                    sidebarBg: '#d4edda',
                    footerBg: '#d4edda',
                    border: '#c3e6cb',
                    hoverBg: 'rgba(27, 67, 50, 0.08)'
                }
            };
            
            const theme = EPUB_THEMES[themeKey] || EPUB_THEMES.light;
            
            return `
                background-color: ${theme.bg};
                color: ${theme.fg};
                --epub-bg: ${theme.bg};
                --epub-fg: ${theme.fg};
                --epub-header-bg: ${theme.headerBg};
                --epub-sidebar-bg: ${theme.sidebarBg};
                --epub-footer-bg: ${theme.footerBg};
                --epub-border: ${theme.border};
                --epub-hover-bg: ${theme.hoverBg};
            `;
        },
        changeEpubFontSize(delta) {
            this.epubViewer.fontSize = Math.max(50, Math.min(250, this.epubViewer.fontSize + delta));
            this.applyEpubTheme();
        },
        nextEpubPage() { this.nextEpubChapter(); },
        prevEpubPage() { this.prevEpubChapter(); },
        closeEpubViewer() {
            if (window._epubAutoScrollRaf) {
                cancelAnimationFrame(window._epubAutoScrollRaf);
                window._epubAutoScrollRaf = null;
            }
            this._transitioningChapter = false;
            try { this._saveEpubScroll(); } catch(e) {}
            this.epubViewer.show = false;
            this.epubViewer.autoScrollActive = false;
            setTimeout(() => {
                const iframe = document.getElementById('epub-iframe');
                if (iframe) { iframe.onload = null; iframe.src = 'about:blank'; }
                if (window._epubBook) {
                    try { window._epubBook.destroy(); } catch(e) {}
                    window._epubBook = null;
                    window._epubRendition = null;
                }
                const area = document.getElementById('epub-viewer-area');
                if (area) area.innerHTML = '';
                this.epubViewer.file = null;
                this.epubViewer.toc = [];
                this.epubViewer.spine = [];
                this.epubViewer.settingsOpen = false;
            }, 400);
        },
        toggleEpubAutoScroll() {
            this.epubViewer.autoScrollActive = !this.epubViewer.autoScrollActive;
            if (this.epubViewer.autoScrollActive) {
                this.startEpubAutoScroll();
            } else {
                this.stopEpubAutoScroll();
            }
        },
        startEpubAutoScroll() {
            if (window._epubAutoScrollRaf) cancelAnimationFrame(window._epubAutoScrollRaf);
            const scrollLoop = () => {
                if (!this.epubViewer.show || !this.epubViewer.autoScrollActive) {
                    this.epubViewer.autoScrollActive = false;
                    if (window._epubAutoScrollRaf) {
                        cancelAnimationFrame(window._epubAutoScrollRaf);
                        window._epubAutoScrollRaf = null;
                    }
                    return;
                }
                // Skip scrolling while chapter is transitioning to avoid accessing a reloading iframe
                if (this._transitioningChapter) {
                    window._epubAutoScrollRaf = requestAnimationFrame(scrollLoop);
                    return;
                }
                try {
                    const iframe = document.getElementById('epub-iframe');
                    if (iframe && iframe.contentWindow && iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
                        iframe.contentWindow.scrollBy(0, Math.pow(this.epubViewer.autoScrollSpeed, 2) * 0.25);
                    } else if (!iframe) {
                        this.stopEpubAutoScroll();
                        return;
                    }
                    // If iframe exists but not ready, just skip this frame
                } catch (e) {
                    // Silently skip - iframe may be reloading during chapter transition
                    if (!this.epubViewer.show) {
                        this.stopEpubAutoScroll();
                        return;
                    }
                }
                window._epubAutoScrollRaf = requestAnimationFrame(scrollLoop);
            };
            window._epubAutoScrollRaf = requestAnimationFrame(scrollLoop);
        },
        stopEpubAutoScroll() {
            this.epubViewer.autoScrollActive = false;
            if (window._epubAutoScrollRaf) {
                cancelAnimationFrame(window._epubAutoScrollRaf);
                window._epubAutoScrollRaf = null;
            }
        },
        changeEpubAutoScrollSpeed(amount) {
            this.epubViewer.autoScrollSpeed = Math.max(1, Math.min(10, this.epubViewer.autoScrollSpeed + amount));
        },
        openPdfViewer(file, isShare = false, shareToken = '') {
            const token = this.shareToken || this.token || shareToken || '';
            const filename = encodeURIComponent((file && file.filename) || this.filename || 'document.pdf');
            let streamUrl = '';
            if (this.shareToken) {
                const fileId = file && file.id ? file.id : '';
                streamUrl = fileId ? `/s/${this.shareToken}/file/${fileId}/stream/${filename}` : `/s/${this.shareToken}/stream/${filename}`;
            } else if (this.token || (token && (!file || !file.id))) {
                const t = this.token || token;
                streamUrl = `/s/${t}/stream/${filename}`;
            } else if (token && file && file.id) {
                streamUrl = `/s/${token}/file/${file.id}/stream/${filename}`;
            } else if (file && file.id) {
                streamUrl = `/api/files/${file.id}/stream/${filename}`;
            }
            if (streamUrl) {
                openUrlInNewTab(streamUrl);
            }
        },
        async showFileInfo(file) {
            if (file.is_folder) return;
            const ext = file.filename.split('.').pop().toLowerCase();
            if (ext === 'pdf') {
                this.openPdfViewer(file);
                return;
            }
            const typeData = this.getFileTypeData(file.filename);
            const imgExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'heic', 'heif'];
            const videoExts = ['mp4', 'webm', 'ogg', 'mov', 'mkv', 'ogv', '3gp', 'flv', 'wmv'];
            const audioExts = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'opus', 'oga', 'aac', 'm4b'];
            const textExts = ['txt', 'md', 'log', 'json', 'js', 'py', 'go', 'html', 'css', 'yml', 'yaml', 'sql', 'sh', 'conf', 'ini', 'c', 'cpp', 'h', 'hpp', 'cs', 'java', 'rb', 'rs', 'swift'];
            const isComicOrEpubOrPdf = (typeData.n === 'type_comic' || typeData.n === 'type_epub' || typeData.n === 'type_pdf');
            const isTooLarge = (imgExts.includes(ext) && file.size > 50 * 1024 * 1024) || 
                               (isComicOrEpubOrPdf && file.size > 150 * 1024 * 1024) || 
                               (textExts.includes(ext) && file.size > 10 * 1024 * 1024);
            
            const mimeTypes = { 
                'mp4': 'video/mp4', 'webm': 'video/webm', 'ogg': 'video/ogg', 'ogv': 'video/ogg',
                'mov': 'video/mp4', 'mkv': 'video/webm', 'mp3': 'audio/mpeg', 'wav': 'audio/wav', 
                'flac': 'audio/flac', 'm4a': 'audio/mp4', 'opus': 'audio/ogg', 'oga': 'audio/ogg',
                'aac': 'audio/aac', 'm4b': 'audio/mp4'
            };
            let isMedia = false;
            let mediaHtml = '';
            let isLarge = false;
            mediaHtml = TeleCloud.getMediaHtml(file, { isShare: true, shareToken: this.shareToken });
            if (mediaHtml) {
                isMedia = true;
                isLarge = true; // Make media modals larger by default
            } else if (textExts.includes(ext)) {
                this.fileInfoModal = { show: true, file: file, typeName: typeData.n, ext: typeData.ext || '', svgIcon: typeData.i, bgColor: typeData.c, isMedia: false, mediaHtml: '', isLarge: true, isPreviewLoading: false, needsLoad: false, tooLarge: isTooLarge, bypassWarning: false, unsupportedMedia: false };
                
                if (isTooLarge) {
                    // Handled by tooLarge property
                } else {
                    this.fileInfoModal.needsLoad = true;
                }
                return;
            }
            
            const isUnsupportedMkv = (TeleCloud.isAppleDevice() && ext === 'mkv');
            this.fileInfoModal = { show: true, file: file, typeName: typeData.n, ext: typeData.ext || '', svgIcon: typeData.i, bgColor: typeData.c, isMedia: isMedia, mediaHtml: mediaHtml, isLarge: isLarge, isPreviewLoading: false, tooLarge: isTooLarge, bypassWarning: false, unsupportedMedia: isUnsupportedMkv };
        },
        async loadFilePreview() {
            this.fileInfoModal.needsLoad = false;
            const file = this.fileInfoModal.file;
            const ext = file.filename.split('.').pop().toLowerCase();
            const streamUrl = `/s/${this.shareToken}/file/${file.id}/stream`;
            const langMap = { 'js': 'javascript', 'json': 'json', 'py': 'python', 'go': 'go', 'html': 'markup', 'css': 'css', 'yml': 'yaml', 'yaml': 'yaml', 'sql': 'sql', 'sh': 'bash', 'md': 'markdown' };

            this.fileInfoModal.isPreviewLoading = true;
            this.fileInfoModal.isMedia = false;

            try {
                const response = await fetch(streamUrl, { headers: { 'Range': 'bytes=0-262144' } });
                if (!response.ok && response.status !== 206) throw new Error("Failed to fetch");
                const content = await response.text();
                
                let mediaHtml = '';
                if (ext === 'md') {
                    mediaHtml = `<div class="text-preview-container markdown-preview !max-h-[70vh] overflow-auto shadow-inner">${this.parseMarkdown(content)}</div>`;
                } else {
                    const lang = langMap[ext] || 'none';
                    mediaHtml = `<div class="text-preview-container !max-h-[70vh] overflow-auto bg-slate-900 shadow-inner relative"><pre class="!m-0 !p-4 !bg-transparent !overflow-visible"><code class="language-${lang} !whitespace-pre !word-break-normal">${content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre></div>`;
                }
                this.fileInfoModal.mediaHtml = mediaHtml;
                this.fileInfoModal.isMedia = true;
                
                if (ext !== 'md') {
                    ensurePrismLoaded().then(() => {
                        setTimeout(() => window.Prism.highlightAllUnder(document.querySelector('#media-preview-container')), 50);
                    });
                }
            } catch (e) {
                console.error("Preview failed", e);
                this.fileInfoModal.mediaHtml = `<div class="p-4 text-center text-red-500 text-sm">${this.t('preview_error')}</div>`;
                this.fileInfoModal.isMedia = true;
            } finally {
                this.fileInfoModal.isPreviewLoading = false;
            }
        }
    }
}