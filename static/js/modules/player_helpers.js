// Silence Artplayer's persistent console logs
(function() {
    const originalLog = console.log;
    console.log = function(...args) {
        if (args[0] && typeof args[0] === 'string' && (args[0].includes('Artplayer') || args[0].includes('artplayer.org'))) {
            return;
        }
        originalLog.apply(console, args);
    };
})();

import Alpine from 'alpinejs';
import collapse from '@alpinejs/collapse';

Alpine.plugin(collapse);
window.Alpine = Alpine;

// Asynchronous loader helper for Artplayer & Plyr
async function ensurePlayersLoaded() {
    if (window.Artplayer && window.Plyr) return;
    const [artModule, plyrModule, jassubModule, chapterModule] = await Promise.all([
        import('artplayer'),
        import('plyr'),
        import('artplayer-plugin-jassub').catch(() => null),
        import('artplayer-plugin-chapter').catch(() => null)
    ]);
    window.Artplayer = artModule.default;
    window.Plyr = plyrModule.default;
    if (jassubModule) window.artplayerPluginJassub = jassubModule.default;
    if (chapterModule) window.artplayerPluginChapter = chapterModule.default;
    window.Artplayer.option.logger = false;
}

// Asynchronous loader helper for PrismJS syntax highlighter
async function ensurePrismLoaded() {
    if (window.Prism) return;
    const prismMod = await import('prismjs');
    window.Prism = prismMod.default;
    // Load language files in parallel
    await Promise.all([
        import('prismjs/components/prism-json'),
        import('prismjs/components/prism-javascript'),
        import('prismjs/components/prism-python'),
        import('prismjs/components/prism-go'),
        import('prismjs/components/prism-bash'),
        import('prismjs/components/prism-yaml'),
        import('prismjs/components/prism-sql')
    ]);
}

// Asynchronous loader helper for PDF.js (lazy load)
async function ensurePdfLoaded() {
    if (window.pdfjsLib) return;
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `/static/js/pdf.min.js?v=${window.TELECLOUD_VERSION || 'dev'}`;
        script.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = `/static/js/pdf.worker.min.js?v=${window.TELECLOUD_VERSION || 'dev'}`;
            resolve();
        };
        script.onerror = () => reject(new Error('Failed to load PDF.js'));
        document.head.appendChild(script);
    });
}

// Popup-blocker / WebView-safe "open in a new tab".
// window.open() is silently dropped by popup blockers and by most in-app
// WebViews. Injecting and clicking a real <a target="_blank"> counts as a
// user-initiated navigation instead of a popup, so it is not intercepted.
// Used by the PDF print fallback when an inline print iframe is unavailable.
function openUrlInNewTab(url) {
    if (!url) return false;
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
}

const artplayerI18n = {
    'vi': {
        'Play': 'Phát',
        'Pause': 'Tạm dừng',
        'Play Speed': 'Tốc độ phát',
        'Playback Rate': 'Tốc độ phát',
        'Aspect Ratio': 'Tỉ lệ khung hình',
        'Normal': 'Bình thường',
        'Flip': 'Lật video',
        'Horizontal': 'Xoay ngang',
        'Vertical': 'Xoay dọc',
        'Fullscreen': 'Toàn màn hình',
        'Web Fullscreen': 'Toàn màn hình Web',
        'Mini Player': 'Trình phát thu nhỏ',
        'PIP': 'Ảnh trong ảnh',
        'PIP Mode': 'Ảnh trong ảnh',
        'Pip': 'Ảnh trong ảnh',
        'Pip Mode': 'Ảnh trong ảnh',
        'Enter PIP': 'Bật Ảnh trong ảnh',
        'Exit PIP': 'Tắt Ảnh trong ảnh',
        'Volume': 'Âm lượng',
        'Mute': 'Tắt tiếng',
        'Reconnect': 'Kết nối lại',
        'Screenshot': 'Chụp màn hình',
        'Subtitle': 'Phụ đề',
        'Video info': 'Thông tin video',
        'Close': 'Đóng',
        'Setting': 'Cài đặt',
        'Settings': 'Cài đặt',
        'Show setting': 'Cài đặt',
        'Show Setting': 'Cài đặt'
    }
};



function parseVttChapters(vttText) {
    if (!vttText) return [];
    const lines = vttText.split(/\r?\n/);
    const chapters = [];
    let currentCue = null;

    const timeToSeconds = (str) => {
        const parts = str.trim().split(':');
        if (parts.length === 3) {
            return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2].replace(',', '.'));
        } else if (parts.length === 2) {
            return parseFloat(parts[0]) * 60 + parseFloat(parts[1].replace(',', '.'));
        }
        return 0;
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.includes('-->')) {
            const times = line.split('-->');
            currentCue = {
                start: timeToSeconds(times[0]),
                end: timeToSeconds(times[1]),
                title: ''
            };
        } else if (currentCue && line && !line.startsWith('WEBVTT') && !line.startsWith('NOTE')) {
            if (!currentCue.title) {
                currentCue.title = line;
                chapters.push(currentCue);
                currentCue = null;
            }
        }
    }
    return chapters;
}

function setupChapterDetection(player, videoFilename, filesList, isShare, shareToken) {
    if (!player) return;
    
    player.on('video:loadedmetadata', () => {
        const nativeTextTracks = player.video ? player.video.textTracks : null;
        if (nativeTextTracks && nativeTextTracks.length > 0) {
            for (let i = 0; i < nativeTextTracks.length; i++) {
                const track = nativeTextTracks[i];
                if (track.kind === 'chapters') {
                    track.mode = 'hidden';
                    if (track.cues && track.cues.length > 0) {
                        const chapterList = [];
                        for (let j = 0; j < track.cues.length; j++) {
                            const cue = track.cues[j];
                            chapterList.push({
                                start: cue.startTime,
                                end: cue.endTime,
                                title: cue.text || `Chapter ${j + 1}`
                            });
                        }
                        if (chapterList.length > 0 && player.plugins.artplayerPluginChapter) {
                            player.plugins.artplayerPluginChapter.update({ chapters: chapterList });
                            return;
                        }
                    }
                }
            }
        }

        if (videoFilename && filesList && Array.isArray(filesList) && filesList.length > 0) {
            const lastDot = videoFilename.lastIndexOf('.');
            const videoBase = (lastDot !== -1 ? videoFilename.substring(0, lastDot) : videoFilename).toLowerCase();
            const chapterFile = filesList.find(f => {
                if (f.is_folder) return false;
                const fname = f.filename.toLowerCase();
                return fname.endsWith('.chapters.vtt') || fname.endsWith('.chapters.srt') || (fname.startsWith(videoBase) && fname.includes('chapter') && (fname.endsWith('.vtt') || fname.endsWith('.srt')));
            });

            if (chapterFile) {
                const url = isShare ? `/s/${shareToken}/file/${chapterFile.id}/stream` : `/api/files/${chapterFile.id}/stream`;
                fetch(url).then(res => res.text()).then(text => {
                    const parsedChapters = parseVttChapters(text);
                    if (parsedChapters.length > 0 && player.plugins.artplayerPluginChapter) {
                        player.plugins.artplayerPluginChapter.update({ chapters: parsedChapters });
                    }
                }).catch(() => {});
            }
        }
    });
}

function findSubtitlesForVideo(videoFilename, filesList, isShare, shareToken) {
    if (!videoFilename || !filesList || filesList.length === 0) return [];
    
    const lastDot = videoFilename.lastIndexOf('.');
    const videoBase = lastDot !== -1 ? videoFilename.substring(0, lastDot) : videoFilename;
    const videoBaseLower = videoBase.toLowerCase();

    return filesList
        .filter(f => {
            if (f.is_folder) return false;
            const ext = f.filename.split('.').pop().toLowerCase();
            if (!['srt', 'vtt', 'ass'].includes(ext)) return false;
            
            const subLastDot = f.filename.lastIndexOf('.');
            const subBase = subLastDot !== -1 ? f.filename.substring(0, subLastDot) : f.filename;
            const subBaseLower = subBase.toLowerCase();

            return subBaseLower === videoBaseLower || subBaseLower.startsWith(videoBaseLower + '.');
        })
        .map(f => {
            const ext = f.filename.split('.').pop().toLowerCase();
            return {
                html: f.filename,
                url: isShare ? `/s/${shareToken}/file/${f.id}/stream` : `/api/files/${f.id}/stream`,
                type: ext
            };
        });
}

function buildArtplayerSubtitleSetting(videoFilename, filesList, isShare, shareToken, tFunc) {
    const matchedSubs = findSubtitlesForVideo(videoFilename, filesList, isShare, shareToken);
    
    const selector = [
        {
            html: tFunc ? tFunc('subtitles_off') : 'Off',
            default: matchedSubs.length === 0,
        }
    ];

    matchedSubs.forEach((sub, index) => {
        selector.push({
            html: sub.html,
            url: sub.url,
            type: sub.type,
            default: index === 0,
        });
    });

    selector.push({
        html: tFunc ? tFunc('subtitles_local') : 'Load from local...',
        isLocal: true,
    });

    return {
        name: 'subtitle',
        width: 250,
        html: tFunc ? tFunc('subtitles') : 'Subtitles',
        tooltip: matchedSubs.length > 0 ? matchedSubs[0].html : (tFunc ? tFunc('subtitles_off') : 'Off'),
        selector: selector,
        onSelect: function (item) {
            if (item.isLocal) {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.vtt,.srt,.ass';
                input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const url = URL.createObjectURL(file);
                        const ext = file.name.split('.').pop().toLowerCase();
                        this.subtitle.url = url;
                        this.subtitle.type = ext;
                        this.subtitle.show = true;
                        
                        this.setting.update({
                            name: 'subtitle',
                            html: tFunc ? tFunc('subtitles') : 'Subtitles',
                            tooltip: file.name,
                        });
                    }
                };
                input.click();
                return 'Loading...';
            } else if (item.url) {
                this.subtitle.url = item.url;
                this.subtitle.type = item.type || 'vtt';
                this.subtitle.show = true;
                return item.html;
            } else {
                this.subtitle.show = false;
                return tFunc ? tFunc('subtitles_off') : 'Off';
            }
        }
    };
}

function applySubtitleStyles(player) {
    if (!player) return;
    const container = player.template?.$player || 
                      (typeof player.container === 'string' ? document.querySelector(player.container) : player.container);
    if (!container || !container.style) return;

    let bgStyle = localStorage.getItem('art-subtitle-bg-style') || 'default';
    if (bgStyle === 'netflix') bgStyle = 'default';
    const textColor = localStorage.getItem('art-subtitle-color') || '#ffffff';
    const fontSize = localStorage.getItem('art-subtitle-font-size') || '1.25rem';

    // Background Style
    if (bgStyle === 'default') {
        container.style.setProperty('--art-subtitle-bg', 'rgba(15, 23, 42, 0.7)');
        container.style.setProperty('--art-subtitle-backdrop-filter', 'blur(8px)');
        container.style.setProperty('--art-subtitle-border', '1px solid rgba(255, 255, 255, 0.15)');
        container.style.setProperty('--art-subtitle-box-shadow', '0 4px 15px rgba(0, 0, 0, 0.3)');
        container.style.setProperty('--art-subtitle-text-shadow', 'none');
    } else if (bgStyle === 'semi-transparent') {
        container.style.setProperty('--art-subtitle-bg', 'rgba(0, 0, 0, 0.5)');
        container.style.setProperty('--art-subtitle-backdrop-filter', 'none');
        container.style.setProperty('--art-subtitle-border', 'none');
        container.style.setProperty('--art-subtitle-box-shadow', 'none');
        container.style.setProperty('--art-subtitle-text-shadow', 'none');
    } else if (bgStyle === 'solid') {
        container.style.setProperty('--art-subtitle-bg', 'rgba(0, 0, 0, 1)');
        container.style.setProperty('--art-subtitle-backdrop-filter', 'none');
        container.style.setProperty('--art-subtitle-border', 'none');
        container.style.setProperty('--art-subtitle-box-shadow', 'none');
        container.style.setProperty('--art-subtitle-text-shadow', 'none');
    } else if (bgStyle === 'transparent') {
        container.style.setProperty('--art-subtitle-bg', 'transparent');
        container.style.setProperty('--art-subtitle-backdrop-filter', 'none');
        container.style.setProperty('--art-subtitle-border', 'none');
        container.style.setProperty('--art-subtitle-box-shadow', 'none');
        container.style.setProperty('--art-subtitle-text-shadow', '0 0 4px #000, 0 0 4px #000, 0 0 4px #000');
    }

    // Text Color
    container.style.setProperty('--art-subtitle-color', textColor);

    // Font Size
    container.style.setProperty('--art-subtitle-font-size', fontSize);
}

function buildSubtitleBackgroundSetting(tFunc) {
    let current = localStorage.getItem('art-subtitle-bg-style') || 'default';
    if (current === 'netflix') current = 'default';
    const options = [
        { html: tFunc ? tFunc('subtitle_bg_default') : 'Default', value: 'default', default: current === 'default' },
        { html: tFunc ? tFunc('subtitle_bg_semi') : 'Semi-Transparent', value: 'semi-transparent', default: current === 'semi-transparent' },
        { html: tFunc ? tFunc('subtitle_bg_solid') : 'Solid Black', value: 'solid', default: current === 'solid' },
        { html: tFunc ? tFunc('subtitle_bg_transparent') : 'No Background', value: 'transparent', default: current === 'transparent' }
    ];
    return {
        width: 220,
        html: tFunc ? tFunc('subtitle_background') : 'Subtitle Background',
        tooltip: options.find(o => o.value === current)?.html || 'Default',
        selector: options,
        onSelect: function (item) {
            localStorage.setItem('art-subtitle-bg-style', item.value);
            applySubtitleStyles(this);
            return item.html;
        }
    };
}

function buildSubtitleSizeSetting(tFunc) {
    const current = localStorage.getItem('art-subtitle-font-size') || '1.25rem';
    const options = [
        { html: '16px', value: '1rem', default: current === '1rem' || current === '16px' },
        { html: '20px', value: '1.25rem', default: current === '1.25rem' || current === '20px' },
        { html: '24px', value: '1.5rem', default: current === '1.5rem' || current === '24px' },
        { html: '28px', value: '1.75rem', default: current === '1.75rem' || current === '28px' },
        { html: '32px', value: '2rem', default: current === '2rem' || current === '32px' }
    ];
    return {
        width: 220,
        html: tFunc ? tFunc('subtitle_size') : 'Subtitle Size',
        tooltip: options.find(o => o.value === current)?.html || '20px',
        selector: options,
        onSelect: function (item) {
            localStorage.setItem('art-subtitle-font-size', item.value);
            applySubtitleStyles(this);
            return item.html;
        }
    };
}

function buildSubtitleColorSetting(tFunc) {
    const current = localStorage.getItem('art-subtitle-color') || '#ffffff';
    const options = [
        { html: tFunc ? tFunc('color_white') : 'White', value: '#ffffff', default: current === '#ffffff' },
        { html: tFunc ? tFunc('color_yellow') : 'Yellow', value: '#ffff00', default: current === '#ffff00' },
        { html: tFunc ? tFunc('color_green') : 'Green', value: '#00ff00', default: current === '#00ff00' },
        { html: tFunc ? tFunc('color_cyan') : 'Cyan', value: '#00ffff', default: current === '#00ffff' }
    ];
    return {
        width: 200,
        html: tFunc ? tFunc('subtitle_color') : 'Subtitle Color',
        tooltip: options.find(o => o.value === current)?.html || 'White',
        selector: options,
        onSelect: function (item) {
            localStorage.setItem('art-subtitle-color', item.value);
            applySubtitleStyles(this);
            return item.html;
        }
    };
}

window.registerComicLazyImage = function(el) {
    // Mark wrapper as loading immediately so shimmer shows
    const wrapper = el.parentElement;
    if (wrapper) wrapper.classList.add('comic-img-loading');

    if (!window._comicIntersectionObserver) {
        window._comicIntersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const dataSrc = img.getAttribute('data-src');
                    if (dataSrc && img.getAttribute('src') !== dataSrc) {
                        // Attach listeners BEFORE changing src so they fire for the real image
                        img.addEventListener('load', () => {
                            img.classList.add('comic-img-ready');
                            const w = img.parentElement;
                            if (w) w.classList.remove('comic-img-loading');
                        }, { once: true });
                        img.addEventListener('error', () => {
                            const w = img.parentElement;
                            if (w) w.classList.remove('comic-img-loading');
                        }, { once: true });
                        img.setAttribute('src', dataSrc);
                    }
                }
            });
        }, {
            rootMargin: '120% 0px 120% 0px'
        });
    }
    window._comicIntersectionObserver.observe(el);
};

window.registerPdfLazyPage = function(el, pageNum) {
    // Reserve each page's real footprint before it renders so vertical scrolling
    // and the scrollbar stay accurate instead of showing tall empty blocks.
    if (el && !el.getAttribute('data-sized')) {
        try {
            if (window._pdfPlaceholderWidth == null) {
                const container = document.getElementById('pdf-continuous-container') ||
                                  document.getElementById('share-pdf-continuous-container') ||
                                  document.getElementById('share-folder-pdf-continuous-container');
                // The scroller keeps a px-4 gutter (32px total) on every breakpoint, so the
                // fit-width scale matches this exactly. Read once per document (no per-page reflow).
                window._pdfPlaceholderWidth = Math.max(200, (container ? container.clientWidth : window.innerWidth) - 32);
            }
            const ratio = window._pdfPageRatio || 1.294;
            el.style.width = Math.floor(window._pdfPlaceholderWidth) + 'px';
            el.style.height = Math.floor(window._pdfPlaceholderWidth * ratio) + 'px';
            el.setAttribute('data-sized', '1');
        } catch (e) {}
    }
    if (!window._pdfIntersectionObserver) {
        window._pdfIntersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const wrapper = entry.target;
                const pageNo = parseInt(wrapper.getAttribute('data-page'), 10);
                if (entry.isIntersecting) {
                    window.dispatchEvent(new CustomEvent('tc-render-pdf-page', { detail: { pageNum: pageNo } }));
                } else {
                    const canvas = wrapper.querySelector('canvas');
                    if (canvas && canvas.getAttribute('data-rendered') === 'true') {
                        const context = canvas.getContext('2d');
                        if (context) {
                            context.clearRect(0, 0, canvas.width, canvas.height);
                        }
                        canvas.removeAttribute('data-rendered');
                    }
                }
            });
        }, {
            rootMargin: '100% 0px 100% 0px'
        });
    }
    window._pdfIntersectionObserver.observe(el);
};


export {
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
};
