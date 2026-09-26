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

export function shareFileApp() {
    return {
        lang: TeleCloud.lang,
        showPrivacyModal: false,
        currentTheme: localStorage.getItem('theme') || 'system',
        token: '',
        id: '',
        filename: '',
        typeKey: '',
        typeExt: '',
        isMedia: false,
        showTextPreviewPrompt: false,
        tooLarge: false,
        bypassWarning: false,
        isPreviewLoading: false,
        unsupportedMedia: false,
        textPreviewHtml: '',
        imageViewer: { show: false, src: '', filename: '' },
        lightboxLoading: false,
        comicViewer: { show: false, file: null, pages: [], pageUrls: [], currentPageIndex: 0, loading: false, fitMode: 'height', pageLoading: false, scrollMode: 'page', autoScrollActive: false, autoScrollSpeed: 2, settingsOpen: false, direction: 'ltr', viewMode: 'single', filter: 'none', zoomActive: false, touchStartX: 0, touchStartY: 0 },
        epubViewer: { show: false, file: null, loading: false, sidebarOpen: false, toc: [], fontSize: 100, pageProgress: 0, scrollMode: 'scrolled', autoScrollActive: false, autoScrollSpeed: 2, settingsOpen: false, spine: [], resourceBaseUrl: '', currentChapter: 0, title: '', theme: 'system', fontFamily: 'sans-serif' },
        pdfViewer: { show: false, file: null, loading: false, sidebarOpen: false, toc: [], zoom: 100, pageProgress: 0, loadProgress: 0, settingsOpen: false, currentPage: 1, numPages: 0, pageLoading: false, autoScrollActive: false, autoScrollSpeed: 2, scrollMode: 'continuous' },
        toastModal: { show: false, message: '', type: 'success', persistent: false },
        toastTimeout: null,
        
        t(key) { return TeleCloud.t(key, {}, this.lang); },
        async toggleLang() { this.lang = await TeleCloud.toggleLang(); },
        async setLang(code) { this.lang = await TeleCloud.setLang(code); },
        
        showToast(msg, type = 'success', duration = 3500) {
            if (this.toastTimeout) clearTimeout(this.toastTimeout);
            this.toastModal = { show: true, message: msg, type: type, persistent: duration === 0 };
            if (duration > 0) {
                this.toastTimeout = setTimeout(() => { this.toastModal.show = false; }, duration);
            }
        },

        openImageViewer(src, filename) { 
            if (this.imageViewer.src === src) {
                this.imageViewer.show = true;
                return;
            }
            this.lightboxLoading = true;
            this.imageViewer = { show: true, src, filename }; 
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
                ? `/s/${token}/cbz/list`
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
                                ? `/s/${token}/cbz/page?path=${encodeURIComponent(pagePath)}`
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
                ? `/s/${token}/epub/meta`
                : `/api/files/${file.id}/epub/meta`;
            
            const resourceBaseUrl = hasShareToken
                ? `/s/${token}/epub/resource`
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
            const token = this.token || this.shareToken || shareToken || '';
            const filename = encodeURIComponent((file && file.filename) || this.filename || 'document.pdf');
            let streamUrl = '';
            if (token) {
                streamUrl = `/s/${token}/stream/${filename}`;
            } else if (file && file.id) {
                streamUrl = `/api/files/${file.id}/stream/${filename}`;
            }
            if (streamUrl) {
                window.open(streamUrl, '_blank', 'noopener,noreferrer');
            }
        },
        renderPdfPage(pageNumber) {
            if (!window._pdfDoc) return;
            if (pageNumber < 1 || pageNumber > this.pdfViewer.numPages) return;
            
            this.pdfViewer.pageLoading = true;
            this.pdfViewer.currentPage = pageNumber;
            
            if (this.pdfViewer.file && this.pdfViewer.file.id) {
                try { localStorage.setItem(`pdf-page-${this.pdfViewer.file.id}`, pageNumber); } catch(e) {}
            }
            
            this.pdfViewer.pageProgress = Math.round((pageNumber / this.pdfViewer.numPages) * 100);
            
            if (window._pdfRenderTask) {
                try { window._pdfRenderTask.cancel(); } catch(e) {}
                window._pdfRenderTask = null;
            }
            
            window._pdfDoc.getPage(pageNumber).then(page => {
                const canvas = document.getElementById('pdf-canvas');
                if (!canvas) {
                    this.pdfViewer.pageLoading = false;
                    return;
                }
                
                const context = canvas.getContext('2d');
                const container = document.getElementById('pdf-viewer-area');
                if (!container) {
                    this.pdfViewer.pageLoading = false;
                    return;
                }
                
                let scale = 1.0;
                const unscaledViewport = page.getViewport({ scale: 1.0 });
                
                if (this.pdfViewer.zoom === 'width') {
                    scale = (container.clientWidth - 32) / unscaledViewport.width;
                } else if (this.pdfViewer.zoom === 'height') {
                    scale = (container.clientHeight - 32) / unscaledViewport.height;
                } else {
                    scale = (parseInt(this.pdfViewer.zoom) || 100) / 100;
                }
                
                const outputScale = window.devicePixelRatio || 1;
                const viewport = page.getViewport({ scale: scale });
                
                canvas.width = Math.floor(viewport.width * outputScale);
                canvas.height = Math.floor(viewport.height * outputScale);
                canvas.style.width = Math.floor(viewport.width) + "px";
                canvas.style.height = Math.floor(viewport.height) + "px";
                
                const transform = outputScale !== 1
                    ? [outputScale, 0, 0, outputScale, 0, 0]
                    : null;
                
                const renderContext = {
                    canvasContext: context,
                    viewport: viewport,
                    transform: transform
                };
                
                const renderTask = page.render(renderContext);
                window._pdfRenderTask = renderTask;
                
                renderTask.promise.then(() => {
                    this.pdfViewer.pageLoading = false;
                    window._pdfRenderTask = null;
                }).catch(err => {
                    if (err.name === 'RenderingCancelledException') return;
                    console.error("PDF page rendering error:", err);
                    this.pdfViewer.pageLoading = false;
                });
            }).catch(err => {
                console.error("Failed to render PDF page:", err);
                this.pdfViewer.pageLoading = false;
            });
        },
        pdfZoomIn() {
            if (this.pdfViewer.zoom === 'width' || this.pdfViewer.zoom === 'height') {
                this.pdfViewer.zoom = 100;
            } else {
                this.pdfViewer.zoom = Math.min(300, this.pdfViewer.zoom + 25);
            }
            if (this.pdfViewer.scrollMode === 'continuous') {
                const container = document.getElementById('pdf-continuous-container') || 
                                  document.getElementById('share-pdf-continuous-container') || 
                                  document.getElementById('share-folder-pdf-continuous-container');
                if (container) {
                    const wrappers = container.querySelectorAll('.pdf-page-wrapper');
                    const containerRect = container.getBoundingClientRect();
                    wrappers.forEach(wrapper => {
                        const canvas = wrapper.querySelector('canvas');
                        if (canvas) canvas.removeAttribute('data-rendered');
                        const rect = wrapper.getBoundingClientRect();
                        if (rect.bottom >= containerRect.top && rect.top <= containerRect.bottom) {
                            const pageNum = parseInt(wrapper.getAttribute('data-page'), 10);
                            this.renderPdfContinuousPage(pageNum);
                        }
                    });
                }
            } else {
                this.renderPdfPage(this.pdfViewer.currentPage);
            }
        },
        pdfZoomOut() {
            if (this.pdfViewer.zoom === 'width' || this.pdfViewer.zoom === 'height') {
                this.pdfViewer.zoom = 100;
            } else {
                this.pdfViewer.zoom = Math.max(50, this.pdfViewer.zoom - 25);
            }
            if (this.pdfViewer.scrollMode === 'continuous') {
                const container = document.getElementById('pdf-continuous-container') || 
                                  document.getElementById('share-pdf-continuous-container') || 
                                  document.getElementById('share-folder-pdf-continuous-container');
                if (container) {
                    const wrappers = container.querySelectorAll('.pdf-page-wrapper');
                    const containerRect = container.getBoundingClientRect();
                    wrappers.forEach(wrapper => {
                        const canvas = wrapper.querySelector('canvas');
                        if (canvas) canvas.removeAttribute('data-rendered');
                        const rect = wrapper.getBoundingClientRect();
                        if (rect.bottom >= containerRect.top && rect.top <= containerRect.bottom) {
                            const pageNum = parseInt(wrapper.getAttribute('data-page'), 10);
                            this.renderPdfContinuousPage(pageNum);
                        }
                    });
                }
            } else {
                this.renderPdfPage(this.pdfViewer.currentPage);
            }
        },
        pdfSetZoom(val) {
            this.pdfViewer.zoom = val;
            if (this.pdfViewer.scrollMode === 'continuous') {
                const container = document.getElementById('pdf-continuous-container') || 
                                  document.getElementById('share-pdf-continuous-container') || 
                                  document.getElementById('share-folder-pdf-continuous-container');
                if (container) {
                    const wrappers = container.querySelectorAll('.pdf-page-wrapper');
                    const containerRect = container.getBoundingClientRect();
                    wrappers.forEach(wrapper => {
                        const canvas = wrapper.querySelector('canvas');
                        if (canvas) canvas.removeAttribute('data-rendered');
                        const rect = wrapper.getBoundingClientRect();
                        if (rect.bottom >= containerRect.top && rect.top <= containerRect.bottom) {
                            const pageNum = parseInt(wrapper.getAttribute('data-page'), 10);
                            this.renderPdfContinuousPage(pageNum);
                        }
                    });
                }
            } else {
                this.renderPdfPage(this.pdfViewer.currentPage);
            }
        },
        togglePdfZoom(event) {
            if (this.pdfViewer.scrollMode !== 'page') return;
            const currentZoom = this.pdfViewer.zoom;
            let nextZoom = 200;
            if (currentZoom === 200 || currentZoom === '200') {
                nextZoom = 'height';
            }
            this.pdfSetZoom(nextZoom);
            
            this.$nextTick(() => {
                const container = document.getElementById('pdf-viewer-area');
                if (!container) return;
                this._setupPdfDragPan(container, nextZoom);
            });
        },
        _setupPdfDragPan(container, zoomVal) {
            container.removeEventListener('mousedown', container._pdfMouseDown);
            container.removeEventListener('mouseleave', container._pdfMouseLeave);
            container.removeEventListener('mouseup', container._pdfMouseUp);
            container.removeEventListener('mousemove', container._pdfMouseMove);
            
            if (zoomVal !== 200 && zoomVal !== '200') {
                container.classList.remove('cursor-grabbing');
                container.scrollLeft = 0;
                container.scrollTop = 0;
                return;
            }
            
            let isDown = false;
            let startX, startY, scrollLeft, scrollTop;
            
            container._pdfMouseDown = (e) => {
                isDown = true;
                container.classList.add('cursor-grabbing');
                startX = e.pageX - container.offsetLeft;
                startY = e.pageY - container.offsetTop;
                scrollLeft = container.scrollLeft;
                scrollTop = container.scrollTop;
            };
            container._pdfMouseLeave = () => { isDown = false; container.classList.remove('cursor-grabbing'); };
            container._pdfMouseUp = () => { isDown = false; container.classList.remove('cursor-grabbing'); };
            container._pdfMouseMove = (e) => {
                if (!isDown) return;
                e.preventDefault();
                const x = e.pageX - container.offsetLeft;
                const y = e.pageY - container.offsetTop;
                container.scrollLeft = scrollLeft - (x - startX) * 1.5;
                container.scrollTop = scrollTop - (y - startY) * 1.5;
            };
            
            container.addEventListener('mousedown', container._pdfMouseDown);
            container.addEventListener('mouseleave', container._pdfMouseLeave);
            container.addEventListener('mouseup', container._pdfMouseUp);
            container.addEventListener('mousemove', container._pdfMouseMove);
        },
        _setupPdfPinchZoom(container) {
            if (container._pdfPinchStart) container.removeEventListener('touchstart', container._pdfPinchStart);
            if (container._pdfPinchMove) container.removeEventListener('touchmove', container._pdfPinchMove);
            if (container._pdfPinchEnd) container.removeEventListener('touchend', container._pdfPinchEnd);
            
            let initialDist = 0;
            let initialZoom = 100;
            let isPinching = false;
            let touchScrollStartX = 0;
            let touchScrollStartY = 0;
            let scrollLeftStart = 0;
            let scrollTopStart = 0;
            
            const getTouchDist = (t) => {
                const dx = t[0].clientX - t[1].clientX;
                const dy = t[0].clientY - t[1].clientY;
                return Math.sqrt(dx * dx + dy * dy);
            };
            
            container._pdfPinchStart = (e) => {
                // Pinch-to-zoom works in both page and continuous modes
                if (e.touches.length === 2) {
                    isPinching = true;
                    initialDist = getTouchDist(e.touches);
                    const z = this.pdfViewer.zoom;
                    initialZoom = (z === 'width' || z === 'height') ? 100 : (parseInt(z) || 100);
                    e.preventDefault();
                } else if (e.touches.length === 1) {
                    isPinching = false;
                    touchScrollStartX = e.touches[0].clientX;
                    touchScrollStartY = e.touches[0].clientY;
                    scrollLeftStart = container.scrollLeft;
                    scrollTopStart = container.scrollTop;
                }
            };
            
            container._pdfPinchMove = (e) => {
                if (e.touches.length === 2 && isPinching) {
                    e.preventDefault();
                    const dist = getTouchDist(e.touches);
                    const ratio = dist / initialDist;
                    const newZoom = Math.min(300, Math.max(50, Math.round(initialZoom * ratio / 25) * 25));
                    if (newZoom !== this.pdfViewer.zoom) {
                        this.pdfSetZoom(newZoom);
                        if (this.pdfViewer.scrollMode === 'page') {
                            this.$nextTick(() => {
                                this._setupPdfDragPan(container, newZoom);
                            });
                        }
                    }
                } else if (this.pdfViewer.scrollMode === 'page' && e.touches.length === 1 && !isPinching) {
                    const z = this.pdfViewer.zoom;
                    const curZoom = (z === 'width' || z === 'height') ? 100 : (parseInt(z) || 100);
                    if (curZoom > 100) {
                        e.preventDefault();
                        const dx = touchScrollStartX - e.touches[0].clientX;
                        const dy = touchScrollStartY - e.touches[0].clientY;
                        container.scrollLeft = scrollLeftStart + dx;
                        container.scrollTop = scrollTopStart + dy;
                    }
                }
            };
            
            container._pdfPinchEnd = (e) => {
                isPinching = false;
                const t = (e && e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
                if (!t) { container._pdfLastTap = 0; return; }
                const movedX = Math.abs(t.clientX - touchScrollStartX);
                const movedY = Math.abs(t.clientY - touchScrollStartY);
                if (movedX > 12 || movedY > 12) { container._pdfLastTap = 0; return; }
                const now = Date.now();
                // Double-tap toggles between fit-width and 200% zoom
                if (container._pdfLastTap && (now - container._pdfLastTap) < 300) {
                    container._pdfLastTap = 0;
                    const z = this.pdfViewer.zoom;
                    const cur = (z === 'width' || z === 'height') ? 100 : (parseInt(z) || 100);
                    this.pdfSetZoom(cur >= 200 ? 'width' : 200);
                    if (this.pdfViewer.scrollMode === 'page') {
                        this.$nextTick(() => this._setupPdfDragPan(container, this.pdfViewer.zoom));
                    }
                } else {
                    container._pdfLastTap = now;
                }
            };
            
            container.addEventListener('touchstart', container._pdfPinchStart, { passive: false });
            container.addEventListener('touchmove', container._pdfPinchMove, { passive: false });
            container.addEventListener('touchend', container._pdfPinchEnd);
        },
        pdfNextPage() {
            if (this.pdfViewer.currentPage < this.pdfViewer.numPages) {
                if (this.pdfViewer.scrollMode === 'continuous') {
                    this.pdfJumpToPage(this.pdfViewer.currentPage + 1);
                } else {
                    this.renderPdfPage(this.pdfViewer.currentPage + 1);
                    this.$nextTick(() => {
                        const area = document.getElementById('pdf-viewer-area');
                        if (area) area.scrollTop = 0;
                    });
                }
            }
        },
        pdfPrevPage() {
            if (this.pdfViewer.currentPage > 1) {
                if (this.pdfViewer.scrollMode === 'continuous') {
                    this.pdfJumpToPage(this.pdfViewer.currentPage - 1);
                } else {
                    this.renderPdfPage(this.pdfViewer.currentPage - 1);
                    this.$nextTick(() => {
                        const area = document.getElementById('pdf-viewer-area');
                        if (area) area.scrollTop = 0;
                    });
                }
            }
        },
        pdfJumpToPage(page) {
            const p = parseInt(page);
            if (p >= 1 && p <= this.pdfViewer.numPages) {
                if (this.pdfViewer.scrollMode === 'continuous') {
                    this.pdfViewer.currentPage = p;
                    this.$nextTick(() => {
                        const container = document.getElementById('pdf-continuous-container') || 
                                          document.getElementById('share-pdf-continuous-container') || 
                                          document.getElementById('share-folder-pdf-continuous-container');
                        if (container) {
                            const wrapper = container.querySelector(`.pdf-page-wrapper[data-page="${p}"]`);
                            if (wrapper) {
                                wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                        }
                    });
                } else {
                    this.renderPdfPage(p);
                    this.$nextTick(() => {
                        const area = document.getElementById('pdf-viewer-area');
                        if (area) area.scrollTop = 0;
                    });
                }
            }
        },
        seekPdfProgress(event) {
            if (!this.pdfViewer.numPages) return;
            // Ignore keyboard-activated clicks (detail === 0): they carry no position
            if (!event.detail) return;
            const el = event.currentTarget || event.target;
            const rect = el.getBoundingClientRect();
            if (!rect.width) return;
            const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
            const page = Math.max(1, Math.min(this.pdfViewer.numPages, Math.ceil(ratio * this.pdfViewer.numPages)));
            this.pdfJumpToPage(page);
        },
        closePdfViewer() {
            if (window._pdfIntersectionObserver) {
                window._pdfIntersectionObserver.disconnect();
                window._pdfIntersectionObserver = null;
            }
            if (window._pdfAutoScrollRaf) {
                cancelAnimationFrame(window._pdfAutoScrollRaf);
                window._pdfAutoScrollRaf = null;
            }
            this.pdfViewer.show = false;
            this.pdfViewer.autoScrollActive = false;
            
            if (window._pdfResizeHandler) {
                window.removeEventListener('resize', window._pdfResizeHandler);
                window._pdfResizeHandler = null;
            }
            setTimeout(() => {
                if (window._pdfLoadingTask) {
                    try { window._pdfLoadingTask.destroy(); } catch(e) {}
                    window._pdfLoadingTask = null;
                }
                if (window._pdfRenderTask) {
                    try { window._pdfRenderTask.cancel(); } catch(e) {}
                    window._pdfRenderTask = null;
                }
                window._pdfDoc = null;
                const canvas = document.getElementById('pdf-canvas');
                if (canvas) {
                    const context = canvas.getContext('2d');
                    context.clearRect(0, 0, canvas.width, canvas.height);
                }
                this.pdfViewer.file = null;
                this.pdfViewer.toc = [];
                this.pdfViewer.settingsOpen = false;
                this.pdfViewer.scrollMode = 'continuous';
            }, 400);
        },
        togglePdfAutoScroll() {
            this.pdfViewer.autoScrollActive = !this.pdfViewer.autoScrollActive;
            if (this.pdfViewer.autoScrollActive) {
                this.startPdfAutoScroll();
            } else {
                this.stopPdfAutoScroll();
            }
        },
        startPdfAutoScroll() {
            if (window._pdfAutoScrollRaf) cancelAnimationFrame(window._pdfAutoScrollRaf);
            const scrollLoop = () => {
                if (!this.pdfViewer.show || !this.pdfViewer.autoScrollActive) {
                    this.pdfViewer.autoScrollActive = false;
                    if (window._pdfAutoScrollRaf) {
                        cancelAnimationFrame(window._pdfAutoScrollRaf);
                        window._pdfAutoScrollRaf = null;
                    }
                    return;
                }
                try {
                    const container = document.getElementById('pdf-viewer-area');
                    if (container) {
                        container.scrollBy(0, Math.pow(this.pdfViewer.autoScrollSpeed, 2) * 0.25);
                        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 1) {
                            if (this.pdfViewer.currentPage < this.pdfViewer.numPages) {
                                this.pdfNextPage();
                                container.scrollTop = 0;
                            } else {
                                this.stopPdfAutoScroll();
                                return;
                            }
                        }
                    } else {
                        this.stopPdfAutoScroll();
                        return;
                    }
                } catch (e) {
                    if (!this.pdfViewer.show) {
                        this.stopPdfAutoScroll();
                        return;
                    }
                }
                window._pdfAutoScrollRaf = requestAnimationFrame(scrollLoop);
            };
            window._pdfAutoScrollRaf = requestAnimationFrame(scrollLoop);
        },
        stopPdfAutoScroll() {
            this.pdfViewer.autoScrollActive = false;
            if (window._pdfAutoScrollRaf) {
                cancelAnimationFrame(window._pdfAutoScrollRaf);
                window._pdfAutoScrollRaf = null;
            }
        },
        changePdfAutoScrollSpeed(amount) {
            this.pdfViewer.autoScrollSpeed = Math.max(1, Math.min(10, this.pdfViewer.autoScrollSpeed + amount));
        },
        renderPdfContinuousPage(pageNum) {
            if (!window._pdfDoc) return;
            const canvas = document.getElementById(`pdf-canvas-${pageNum}`);
            if (!canvas || canvas.getAttribute('data-rendered') === 'true') return;
            
            window._pdfDoc.getPage(pageNum).then(page => {
                const context = canvas.getContext('2d');
                const container = document.getElementById('pdf-continuous-container') || 
                                  document.getElementById('share-pdf-continuous-container') || 
                                  document.getElementById('share-folder-pdf-continuous-container');
                if (!container) return;
                
                let scale = 1.0;
                const unscaledViewport = page.getViewport({ scale: 1.0 });
                
                if (this.pdfViewer.zoom === 'width') {
                    scale = (container.clientWidth - 32) / unscaledViewport.width;
                } else if (this.pdfViewer.zoom === 'height') {
                    scale = (container.clientHeight - 32) / unscaledViewport.height;
                } else {
                    scale = (parseInt(this.pdfViewer.zoom) || 100) / 100;
                }
                
                const outputScale = window.devicePixelRatio || 1;
                const viewport = page.getViewport({ scale: scale });
                
                canvas.width = Math.floor(viewport.width * outputScale);
                canvas.height = Math.floor(viewport.height * outputScale);
                canvas.style.width = Math.floor(viewport.width) + "px";
                canvas.style.height = Math.floor(viewport.height) + "px";
                
                // Keep the page placeholder in sync with the rendered canvas (e.g. after zoom)
                const wrapper = canvas.parentElement;
                if (wrapper) {
                    wrapper.style.width = Math.floor(viewport.width) + "px";
                    wrapper.style.height = Math.floor(viewport.height) + "px";
                }
                
                const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;
                const renderContext = {
                    canvasContext: context,
                    viewport: viewport,
                    transform: transform
                };
                
                page.render(renderContext).promise.then(() => {
                    canvas.setAttribute('data-rendered', 'true');
                });
            });
        },
        trackPdfContinuousScroll(container) {
            if (this.pdfViewer.scrollMode !== 'continuous') return;
            const wrappers = container.querySelectorAll('.pdf-page-wrapper');
            let activePage = 1;
            let minDiff = Infinity;
            const containerTop = container.getBoundingClientRect().top;
            wrappers.forEach((wrapper) => {
                const rect = wrapper.getBoundingClientRect();
                const diff = Math.abs(rect.top - containerTop);
                if (diff < minDiff) {
                    minDiff = diff;
                    activePage = parseInt(wrapper.getAttribute('data-page'), 10);
                }
            });
            if (activePage !== this.pdfViewer.currentPage) {
                this.pdfViewer.currentPage = activePage;
                this.pdfViewer.pageProgress = Math.round((activePage / this.pdfViewer.numPages) * 100);
                if (this.pdfViewer.file && this.pdfViewer.file.id) {
                    try { localStorage.setItem(`pdf-page-${this.pdfViewer.file.id}`, activePage); } catch(e) {}
                }
            }
        },
        togglePdfScrollMode() {
            const nextMode = this.pdfViewer.scrollMode === 'page' ? 'continuous' : 'page';
            this.pdfViewer.scrollMode = nextMode;
            if (this.pdfViewer.file && this.pdfViewer.file.id) {
                try { localStorage.setItem(`pdf-scroll-mode-${this.pdfViewer.file.id}`, nextMode); } catch(e) {}
            }
            if (nextMode === 'continuous') {
                this.$nextTick(() => {
                    setTimeout(() => {
                        const container = document.getElementById('pdf-continuous-container') || 
                                          document.getElementById('share-pdf-continuous-container') || 
                                          document.getElementById('share-folder-pdf-continuous-container');
                        if (container) {
                            const wrapper = container.querySelector(`.pdf-page-wrapper[data-page="${this.pdfViewer.currentPage}"]`);
                            if (wrapper) {
                                wrapper.scrollIntoView({ behavior: 'auto', block: 'start' });
                            }
                        }
                    }, 100);
                });
            } else {
                this.renderPdfPage(this.pdfViewer.currentPage);
            }
        },
        getPdfStreamUrl(file) {
            const filename = (file && file.filename) ? file.filename : (this.filename || 'document.pdf');
            return `/s/${this.token}/stream/${encodeURIComponent(filename)}`;
        },
        getPdfDownloadUrl(file) {
            return `/s/${this.token}/dl`;
        },
        printPdf() {
            const url = this.getPdfStreamUrl(this.pdfViewer.file);
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            iframe.src = url;
            iframe.onload = () => {
                try {
                    iframe.contentWindow.focus();
                    iframe.contentWindow.print();
                } catch(e) {
                    openUrlInNewTab(url);
                }
            };
            document.body.appendChild(iframe);
            setTimeout(() => { try { document.body.removeChild(iframe); } catch(e){} }, 60000);
        },

        init() {
            window.addEventListener('tc-render-pdf-page', (e) => {
                if (this.pdfViewer && this.pdfViewer.show && this.pdfViewer.scrollMode === 'continuous') {
                    this.renderPdfContinuousPage(e.detail.pageNum);
                }
            });

            window.addEventListener('tc-translations-loaded', (e) => {
                this.lang = '';
                this.$nextTick(() => { this.lang = e.detail.lang; });
            });
            window.addEventListener('online', () => this.showToast(this.t('you_are_online'), 'success'));
            window.addEventListener('offline', () => this.showToast(this.t('you_are_offline'), 'error', 0));
            TeleCloud.initTheme('system');

            this.$nextTick(() => {
                const tokenEl = this.$refs.token;
                const sizeEl = this.$refs.size;
                const thumbEl = this.$refs.hasThumb;
                const nameEl = document.getElementById('raw-filename');
                
                if (!tokenEl || !nameEl) return;

                this.token = tokenEl.textContent.trim();
                const rawSize = parseInt(sizeEl ? sizeEl.textContent : '0') || 0;
                const hasThumb = (thumbEl ? thumbEl.textContent.trim() : '') === 'true' || (thumbEl ? thumbEl.textContent.trim() : '') === '1';
                this.filename = nameEl.textContent.trim();
                
                const ext = this.filename.split('.').pop().toLowerCase();
                this.unsupportedMedia = (TeleCloud.isAppleDevice() && ext === 'mkv');
                const streamUrl = `/s/${this.token}/stream`;
                
                const result = TeleCloud.getFileTypeData(this.filename);
                const container = document.getElementById('file-icon-container');
                if (container) {
                    container.className = 'w-24 h-24 rounded-[2rem] flex items-center justify-center shadow-inner mb-6 transition-all duration-300 ' + result.c;
                    container.innerHTML = result.i.replace('text-2xl', 'text-5xl');
                }
                this.typeKey = result.n;
                // Warm up PDF.js while the share page settles
                if (this.typeKey === 'type_pdf') { ensurePdfLoaded().catch(() => {}); }
                this.typeExt = result.ext || '';

                const imgExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'heic', 'heif'];
                const videoExts = ['mp4', 'webm', 'ogg', 'mov', 'mkv', 'ogv', '3gp', 'flv', 'wmv'];
                const audioExts = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'opus', 'oga', 'aac', 'm4b'];
                const textExts = ['txt', 'md', 'log', 'json', 'js', 'py', 'go', 'html', 'css', 'yml', 'yaml', 'sql', 'sh', 'conf', 'ini', 'c', 'cpp', 'h', 'hpp', 'cs', 'java', 'rb', 'rs', 'swift'];
                const isComicOrEpubOrPdf = (result.n === 'type_comic' || result.n === 'type_epub' || result.n === 'type_pdf');
                this.tooLarge = (imgExts.includes(ext) && rawSize > 50 * 1024 * 1024) || 
                                (isComicOrEpubOrPdf && rawSize > 150 * 1024 * 1024) || 
                                (textExts.includes(ext) && rawSize > 10 * 1024 * 1024);

                const mediaInjectedContent = document.getElementById('media-injected-content');
                const idEl = this.$refs.id;
                const rawId = idEl ? idEl.textContent.trim() : '';
                this.id = rawId;

                let injectedHtml = TeleCloud.getShareMediaHtml({ id: rawId, filename: this.filename, size: rawSize, has_thumb: hasThumb }, this.token);

                if (injectedHtml) {
                    this.isMedia = true;
                    if (mediaInjectedContent) mediaInjectedContent.innerHTML = injectedHtml;
                } else if (textExts.includes(ext)) {
                    this.isMedia = true;
                    this.showTextPreviewPrompt = true;
                    this.loadTextPreview = () => {
                        if (this.isPreviewLoading) return;
                        this.isPreviewLoading = true;
                        fetch(streamUrl, { headers: { 'Range': 'bytes=0-262144' } })
                            .then(r => r.text())
                            .then(content => {
                                const langMap = {
                                    'js': 'javascript', 'json': 'json', 'py': 'python', 'go': 'go', 
                                    'html': 'markup', 'css': 'css', 'yml': 'yaml', 'yaml': 'yaml',
                                    'sql': 'sql', 'sh': 'bash', 'md': 'markdown', 'c': 'clike', 'cpp': 'clike',
                                    'h': 'clike', 'hpp': 'clike', 'cs': 'clike', 'java': 'java', 'rb': 'ruby',
                                    'rs': 'rust', 'swift': 'swift'
                                };
                                const langClass = 'language-' + (langMap[ext] || 'none');
                                const escaped = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                                this.textPreviewHtml = `<div class='w-full max-h-[70vh] overflow-auto rounded-2xl bg-slate-900 text-left relative shadow-inner border border-white/5'><pre class='!m-0 !p-5 !bg-transparent !overflow-visible'><code class='${langClass} !whitespace-pre !word-break-normal'>${escaped}</code></pre></div>`;
                                this.showTextPreviewPrompt = false;
                                this.$nextTick(() => {
                                    ensurePrismLoaded().then(() => {
                                        window.Prism.highlightAllUnder(document.querySelector('#media-preview-container'));
                                    });
                                });
                            })
                            .catch(err => {
                                this.textPreviewHtml = `<div class='p-6 text-center text-red-500'><i class='fa-solid fa-circle-exclamation text-4xl mb-3'></i><p class='text-sm'>${TeleCloud.t('preview_error')}</p></div>`;
                                this.showTextPreviewPrompt = false;
                            })
                            .finally(() => { this.isPreviewLoading = false; });
                    };
                }

                if (this.isMedia) {
                    const mainCard = document.getElementById('main-card');
                    const contentGrid = document.getElementById('main-content-grid');
                    const iconContainer = document.getElementById('file-icon-container');
                    if (iconContainer) {
                        iconContainer.classList.remove('w-24', 'h-24', 'mb-6', 'rounded-[2rem]');
                        iconContainer.classList.add('w-16', 'h-16', 'mb-4', 'rounded-[1.2rem]');
                        const icon = iconContainer.querySelector('i');
                        if (icon) { icon.classList.remove('text-5xl'); icon.classList.add('text-3xl'); }
                    }
                    
                    if (nameEl) {
                        nameEl.classList.remove('text-2xl', 'sm:text-3xl', 'mb-2');
                        nameEl.classList.add('text-xl', 'mb-1');
                    }
                    
                    const typeEl = document.getElementById('file-type-name');
                    if (typeEl) {
                        typeEl.classList.remove('mb-6', 'text-sm');
                        typeEl.classList.add('mb-4', 'text-xs');
                        const detailsBox = typeEl.nextElementSibling;
                        if (detailsBox && detailsBox.tagName === 'DIV') { 
                            detailsBox.classList.remove('p-4', 'space-y-3'); 
                            detailsBox.classList.add('p-3', 'space-y-2'); 
                        }
                    }
                    
                    if (mainCard && contentGrid) {
                        if (audioExts.includes(ext)) { 
                            mainCard.classList.remove('max-w-lg', 'sm:max-w-xl', 'lg:max-w-2xl', 'xl:max-w-3xl'); 
                            mainCard.classList.add('max-w-lg', 'sm:max-w-xl'); 
                            contentGrid.className = 'flex flex-col gap-6 w-full'; 
                        } else { 
                            mainCard.classList.remove('max-w-lg', 'sm:max-w-xl', 'lg:max-w-2xl', 'xl:max-w-3xl'); 
                            mainCard.classList.add('max-w-4xl', 'lg:max-w-6xl', '2xl:max-w-7xl'); 
                            contentGrid.className = 'grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-8 w-full items-center'; 
                        }
                    }

                    if ((videoExts.includes(ext) || audioExts.includes(ext)) && !(TeleCloud.isAppleDevice() && ext === 'mkv')) { 
                        setTimeout(async () => { 
                            await ensurePlayersLoaded();
                            if (this.playerInstance) this.playerInstance.destroy();
                            const accentColor = getComputedStyle(document.body).getPropertyValue('--accent-color').trim() || '#3b82f6';
                            const isAudio = audioExts.includes(ext);
                            const idEl = this.$refs.id;
                            const rawId = idEl ? idEl.textContent.trim() : '';
                            const thumbUrl = `/s/${this.token}/thumb`;

                            if (isAudio) {
                                const plyrOpts = { controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'settings'], settings: ['speed'], speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] } };
                                this.playerInstance = new Plyr('#tele-player', plyrOpts);
                            } else {
                                const matchedSubs = [];
                                this.playerInstance = new Artplayer({
                                    logger: false,
                                    container: '#tele-player',
                                    lang: this.lang === 'vi' ? 'vi' : 'en',
                                    i18n: artplayerI18n,
                                    url: streamUrl,
                                    poster: thumbUrl,
                                    title: this.filename,
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
                                    autoPlayback: true,
                                    airplay: true,
                                    type: this.filename.split('.').pop().toLowerCase() === 'mkv' ? 'mp4' : this.filename.split('.').pop().toLowerCase(),
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
                                        buildArtplayerSubtitleSetting(this.filename, [], true, this.token, (k) => this.t(k)),
                                        buildSubtitleBackgroundSetting((k) => this.t(k)),
                                        buildSubtitleSizeSetting((k) => this.t(k)),
                                        buildSubtitleColorSetting((k) => this.t(k))
                                    ],
                                    plugins: (function() {
                                        const plugins = [];
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
                                setupChapterDetection(this.playerInstance, this.filename, [], true, this.token);
                                this.playerInstance.on('ready', () => {
                                    applySubtitleStyles(this.playerInstance);
                                });
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
                    }
                }

                // Restore download form logic
                const form = document.getElementById('download-form');
                const overlay = document.getElementById('download-overlay');
                if (form && overlay) {
                    form.addEventListener('submit', () => {
                        overlay.classList.remove('hidden'); 
                        overlay.classList.add('flex');
                        setTimeout(() => overlay.classList.remove('opacity-0'), 10);
                        
                        document.cookie = 'dl_started=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                        
                        let checkCookie = setInterval(() => {
                            if (document.cookie.includes('dl_started=1')) {
                                clearInterval(checkCookie); 
                                overlay.classList.add('opacity-0');
                                setTimeout(() => { 
                                    overlay.classList.add('hidden'); 
                                    overlay.classList.remove('flex'); 
                                }, 300); 
                                document.cookie = 'dl_started=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                            }
                        }, 500);
                        
                        setTimeout(() => { 
                            clearInterval(checkCookie); 
                            overlay.classList.add('opacity-0'); 
                            setTimeout(() => { 
                                overlay.classList.add('hidden'); 
                                overlay.classList.remove('flex'); 
                            }, 300); 
                        }, 15000);
                    });
                }

                // Fade out preloader once initial calculation and layout changes are complete
                setTimeout(() => {
                    const preloader = document.getElementById('app-preloader');
                    if (preloader) {
                        preloader.classList.add('preloader-hidden');
                        setTimeout(() => preloader.remove(), 400);
                    }
                    document.body.classList.remove('preloader-active');
                }, 150);
            });
        }
    }
}