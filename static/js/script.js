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
import Plyr from 'plyr';
import Artplayer from 'artplayer';
import Prism from 'prismjs';


// Import Prism languages
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-sql';

Alpine.plugin(collapse);
window.Alpine = Alpine;
window.Plyr = Plyr;
window.Artplayer = Artplayer;
Artplayer.option.logger = false;
window.Prism = Prism;

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
        'Volume': 'Âm lượng',
        'Mute': 'Tắt tiếng',
        'Reconnect': 'Kết nối lại',
        'Screenshot': 'Chụp màn hình',
        'Subtitle': 'Phụ đề',
        'Video info': 'Thông tin video',
        'Close': 'Đóng',
    }
};

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
                            html: tFunc ? tFunc('subtitles') : 'Subtitles',
                            tooltip: file.name,
                        });
                    }
                };
                input.click();
                return 'Loading...';
            } else if (item.url) {
                this.subtitle.url = item.url;
                this.subtitle.type = item.type;
                this.subtitle.show = true;
                return item.html;
            } else {
                this.subtitle.show = false;
                return tFunc ? tFunc('subtitles_off') : 'Off';
            }
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

// Expose main app functions to window for Alpine.js x-data
window.cloudApp = cloudApp;
window.shareApp = shareApp;
window.shareFileApp = shareFileApp;

function cloudApp(initialIsLoggedIn, isAdmin = true, storageUsed = 0, webdavEnabled = false, webdavUser = '', webdavPassword = '', uploadAPIEnabled = false, uploadAPIKey = '', globalWebdavEnabled = true, globalAPIEnabled = true, webauthnRPID = '', webauthnOrigins = '', initialTheme = 'system', s3Enabled = false, s3AccessKey = '', s3SecretKey = '', globalS3Enabled = true, forceChange = false, logGroupId = '', initialBotTokens = '', initialBotStatuses = '{}') {
    return {
        isLoggedIn: initialIsLoggedIn,
        isAdmin: isAdmin,
        forceChange: forceChange,
        storageUsed: storageUsed,
        webdavEnabled: webdavEnabled,
        webdavUser: webdavUser,
        webdavPassword: webdavPassword,
        uploadAPIEnabled: uploadAPIEnabled,
        uploadAPIKey: uploadAPIKey,
        globalWebdavEnabled: globalWebdavEnabled,
        globalAPIEnabled: globalAPIEnabled,
        globalS3Enabled: globalS3Enabled,
        showAPIKey: false,
        childAPIKey: '',
        showChildAPIKey: false,
        s3Enabled: s3Enabled,
        s3AccessKey: s3AccessKey,
        s3SecretKey: s3SecretKey,
        ytdlpEnabled: false,
        ytdlpUrl: '',
        ytdlpLoading: false,
        ytdlpInfo: null,
        ytdlpSelectedFormat: '',
        ytdlpDownloadType: 'video',
        ytdlpHasCookie: false,
        torrentEnabled: false,
        torrentInput: '',
        torrentLoading: false,
        storageTotal: 0,
        storageFree: 0,
        currentTheme: initialTheme || 'system',
        batchDownload: {
            active: false,
            total: 0,
            current: 0,
            error: false
        },
        uploadQueue: [],
        tasks: {},
        backupInfo: { last_time: '', status: '', is_running: false, sqlite_only: false },
        restoreLoading: false,
        logGroupId: logGroupId,
        botTokens: initialBotTokens ? initialBotTokens.split(',').filter(t => t.trim() !== '').map(t => ({ value: t, isSaved: true })) : [],
        botStatuses: initialBotStatuses ? JSON.parse(initialBotStatuses) : {},
        botLoading: false,
        restartingApp: false,
        addBotToken() {
            this.botTokens.push({ value: '', isSaved: false });
        },
        removeBotToken(index) {
            this.botTokens.splice(index, 1);
        },
        maskToken(token) {
            if (!token) return '';
            const colonIdx = token.indexOf(':');
            if (colonIdx !== -1) {
                return token.substring(0, colonIdx) + '***';
            }
            if (token.length > 7) {
                return token.substring(0, 7) + '***';
            }
            return token + '***';
        },
        formatBotError(err) {
            if (!err) return '';
            let errStr = err.toLowerCase();
            if (errStr === 'offline') {
                return this.t('err_bot_offline') || 'Bot is offline/disabled.';
            }
            if (errStr === 'failed') {
                return this.t('err_bot_failed') || 'Bot failed to initialize at startup.';
            }
            if (errStr.includes('invalid') || errStr.includes('400') || errStr.includes('unauthorized')) {
                if (errStr.includes('peer') || errStr.includes('channel') || errStr.includes('chat') || errStr.includes('resolve')) {
                    return this.t('err_bot_peer_invalid') || 'Bot is not added to the Log Group or lacks permission to send messages.';
                }
                return this.t('err_bot_token_invalid') || 'Invalid or expired bot token. Please check again.';
            }
            if (errStr.includes('write_forbidden') || errStr.includes('forbidden') || errStr.includes('write')) {
                return this.t('err_bot_write_forbidden') || 'Bot lacks Admin permission in the Log Group to send messages.';
            }
            if (errStr.includes('timeout') || errStr.includes('deadline')) {
                return this.t('err_bot_timeout') || 'Telegram connection timed out. Please try again.';
            }
            return err;
        },
        async saveBotPool() {
            let filteredTokens = this.botTokens.map(t => t.value.trim()).filter(t => t !== '');
            this.botLoading = true;
            try {
                let r = await fetch('/api/settings/bot-pool', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': TeleCloud.getCsrfToken()
                    },
                    body: JSON.stringify({ tokens: filteredTokens })
                });
                let res = await r.json();
                if (!r.ok) throw new Error(res.error || 'Failed to save bot pool');

                this.botStatuses = {};
                let hasError = false;
                if (res.results) {
                    res.results.forEach(item => {
                        this.botStatuses[item.token] = item.status === 'success' ? 'success' : 'error:' + item.error;
                        if (item.status !== 'success') {
                            hasError = true;
                        }
                    });
                }

                // Update isSaved state for successfully verified tokens
                this.botTokens.forEach(t => {
                    const status = this.botStatuses[t.value];
                    if (status === 'success') {
                        t.isSaved = true;
                    }
                });

                if (hasError) {
                    this.showToast(this.t('bot_save_some_failed') || 'Some bot tokens failed verification', 'warning');
                } else {
                    this.showToast(this.t('toast_settings_saved'), 'success');
                }
            } catch (e) {
                this.showToast(e.message, 'error');
            } finally {
                this.botLoading = false;
            }
        },
        async restartApp() {
            const confirmed = await this.customConfirm(
                this.t('system_restart') || 'Restart Application',
                this.t('confirm_restart_app') || 'Are you sure you want to restart the application? This will temporarily interrupt active operations.',
                true // isDanger
            );
            if (!confirmed) {
                return;
            }
            this.restartingApp = true;
            try {
                let r = await fetch('/api/settings/restart', {
                    method: 'POST',
                    headers: {
                        'X-CSRF-Token': TeleCloud.getCsrfToken()
                    }
                });
                let res = await r.json();
                if (!r.ok) throw new Error(res.error || 'Failed to restart application');
                
                this.showToast(this.t('toast_restarting') || 'Server is restarting, please wait...', 'info');
                
                // Poll server status until it comes back up
                setTimeout(() => {
                    let checkInterval = setInterval(async () => {
                        try {
                            let ping = await fetch('/api/system/status');
                            if (ping.ok) {
                                clearInterval(checkInterval);
                                this.showToast(this.t('toast_restart_success') || 'Server restarted successfully!', 'success');
                                setTimeout(() => window.location.reload(), 1000);
                            }
                        } catch (e) {
                            // Server is still down, keep polling
                        }
                    }, 2000);
                }, 3000);
            } catch (e) {
                this.showToast(e.message, 'error');
                this.restartingApp = false;
            }
        },
        setTheme(theme) {
            this.currentTheme = theme;
            TeleCloud.applyTheme(theme);
            // Save to database
            let fd = new FormData();
            fd.append('theme', theme);
            fetch('/api/settings/user/theme', { method: 'POST', body: fd, headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } }).catch(e => console.error("Theme save failed:", e));
        },
        applyTheme() {
            TeleCloud.applyTheme(this.currentTheme);
        },
        get filteredYTDLPFormats() {
            if (!this.ytdlpInfo || !this.ytdlpInfo.formats) return [];
            return this.ytdlpInfo.formats.filter(f => {
                const vcodec = String(f.vcodec || '').toLowerCase();
                const acodec = String(f.acodec || '').toLowerCase();
                const res = String(f.resolution || '').toLowerCase();
                const note = String(f.format_note || f.format || '').toLowerCase();
                const ext = String(f.ext || '').toLowerCase();

                // Filter out non-media formats (thumbnails, storyboards)
                if (ext === 'mhtml' || ext === 'jpg' || ext === 'jpeg' || ext === 'png' ||
                    note.includes('storyboard') || note.includes('images')) return false;

                // isAudioOnly: vcodec is "none" OR resolution is "audio only"
                const isAudioOnly = vcodec === 'none' || res === 'audio only';

                if (this.ytdlpDownloadType === 'video') {
                    // For video: include formats that have video (not audio-only)
                    return !isAudioOnly;
                } else {
                    // For audio: include audio-only formats, prefer non-webm for better MP3 conversion
                    return isAudioOnly && acodec !== 'none' && acodec !== '';
                }
            }).sort((a, b) => {
                // Sort video by height desc, then filesize desc
                if (this.ytdlpDownloadType === 'video') {
                    return (b.height || 0) - (a.height || 0) ||
                        (b.filesize || b.filesize_approx || 0) - (a.filesize || a.filesize_approx || 0);
                }
                // Sort audio by filesize desc (higher bitrate usually = larger)
                return (b.filesize || b.filesize_approx || 0) - (a.filesize || a.filesize_approx || 0);
            });
        },
        formatQualityLabel(f) {
            if (!f) return '';
            let label = '';
            if (f.height && f.height > 0) {
                label = f.height + 'p';
            } else if (f.resolution && f.resolution !== 'audio only') {
                label = f.resolution;
            } else if (f.format_note) {
                const note = f.format_note.toLowerCase();
                if (note === 'medium') label = this.t('quality_medium');
                else if (note === 'low') label = this.t('quality_low');
                else if (note === 'tiny') label = this.t('quality_tiny');
                else if (note === 'ultralow') label = this.t('quality_ultralow');
                else label = f.format_note.charAt(0).toUpperCase() + f.format_note.slice(1);
            } else if (f.ext) {
                label = f.ext.toUpperCase();
            } else {
                label = 'Unknown';
            }
            
            // Standardize format display
            let ext = (f.ext || '').toUpperCase();
            if (this.ytdlpDownloadType === 'video') {
                // We force MP4 merger in backend for best compatibility
                ext = 'MP4';
            } else if (this.ytdlpDownloadType === 'audio') {
                // We force MP3 conversion in backend
                ext = 'MP3';
            }

            let size = '';
            const totalSize = f.filesize || f.filesize_approx;
            if (totalSize) size = ' - ' + this.formatBytes(totalSize);
            return `${label}${ext ? ' (' + ext + ')' : ''}${size}`;
        },
        webauthnRPID: webauthnRPID,
        webauthnOrigins: webauthnOrigins,
        currentTab: 'files',
        viewMode: localStorage.getItem('viewMode') || 'list',
        toggleViewMode() {
            this.viewMode = this.viewMode === 'list' ? 'grid' : 'list';
            localStorage.setItem('viewMode', this.viewMode);
        },
        updateAvailable: false,
        changelog: [],
        latestReleaseUrl: '',
        sortBy: 'name',
        sortOrder: 'asc',
        username: '',
        password: '', 
        confirmPassword: '',
        settingsForm: { oldPassword: '', newPassword: '', confirmPassword: '' },
        users: [],
        userForm: { username: '', password: '' },
        isCreatingUser: false,
        isLoggingIn: false,
        isPasskeyLoading: false,
        isLoading: false, 
        isRefreshing: false,
        isTrashLoading: false,
        isPreparingDownload: false,
        trashFiles: [],
        trashSearchQuery: '',
        trashCurrentPage: 1,
        trashItemsPerPage: 10,
        ws: null,
        lang: TeleCloud.lang,
        t(key, params) { return TeleCloud.t(key, params, this.lang); },
        handleCommonError(errorStr, defaultKey) {
            if (!errorStr) return this.t(defaultKey);
            const errorKey = 'err_' + errorStr.toLowerCase().replace(/ /g, '_');
            const translated = this.t(errorKey);
            return (translated !== errorKey) ? translated : (this.t(defaultKey) + ' (' + errorStr + ')');
        },
        async resetAdmin() {
            if (this.password !== this.confirmPassword) {
                this.showToast(this.t('toast_pass_mismatch'), 'error');
                return;
            }
            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get('token');
            if (!token) {
                this.showToast(this.t('invalid_token'), 'error');
                return;
            }
            let fd = new FormData();
            fd.append('token', token);
            fd.append('password', this.password);
            try {
                let res = await fetch('/reset-admin' + window.location.search, { method: 'POST', body: fd, headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } });
                if (res.ok) window.location.href = '/login';
                else {
                    let d = await res.json();
                    this.showToast(this.handleCommonError(d.error, 'reset_failed'), 'error');
                }
            } catch (e) {
                this.showToast(this.t('reset_error'), 'error');
            }
        },
        async setupAdmin() {
            if (this.password !== this.confirmPassword) {
                this.showToast(this.t('toast_pass_mismatch'), 'error');
                return;
            }
            let fd = new FormData();
            fd.append('username', this.username);
            fd.append('password', this.password);
            try {
                let res = await fetch('/setup', { method: 'POST', body: fd, headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } });
                if (res.ok) window.location.href = '/';
                else {
                    let d = await res.json();
                    this.showToast(this.handleCommonError(d.error, 'setup_failed'), 'error');
                }
            } catch (e) {
                this.showToast(this.t('setup_error'), 'error');
            }
        },
        async changePassword() {
            if (this.settingsForm.newPassword !== this.settingsForm.confirmPassword) {
                this.showToast(this.t('toast_pass_mismatch'), 'error');
                return;
            }
            let fd = new FormData();
            // When force-changing, old_password is unknown (temp password generated by server),
            // so we omit it. The backend skips verification for force_password_change users.
            if (!this.forceChange) {
                fd.append('old_password', this.settingsForm.oldPassword);
            }
            fd.append('new_password', this.settingsForm.newPassword);
            try {
                let res = await fetch('/api/settings/password', { method: 'POST', body: fd, headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } });
                if (res.ok) {
                    this.showToast(this.t('toast_pass_changed'), 'success');
                    this.settingsForm = { oldPassword: '', newPassword: '', confirmPassword: '' };
                    this.forceChange = false;
                } else {
                    let d = await res.json();
                    this.showToast(this.handleCommonError(d.error, 'status_error'), 'error');
                }
            } catch (e) {
                this.showToast(this.t('conn_error'), 'error');
            }
        },
        async toggleWebDAV() {
            let newState = !this.webdavEnabled;
            let fd = new FormData();
            fd.append('enabled', newState);
            let url = this.isAdmin ? '/api/settings/webdav' : '/api/settings/child-webdav';
            try {
                let res = await fetch(url, { method: 'POST', body: fd, headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } });
                if (res.ok) {
                    this.webdavEnabled = newState;
                } else {
                    let d = await res.json();
                    if (d.error === 'ADMIN_DISABLED') {
                        this.showToast(this.t('err_admin_disabled'), 'error');
                    } else {
                        this.showToast(this.t('webdav_toggle_error'), 'error');
                    }
                }
            } catch(e) {
                this.showToast(this.t('status_error'), 'error');
            }
        },
        async toggleUploadAPI() {
            let newState = !this.uploadAPIEnabled;
            let fd = new FormData();
            fd.append('enabled', newState);
            let url = this.isAdmin ? '/api/settings/upload-api' : '/api/settings/child-api';
            try {
                let res = await fetch(url, { method: 'POST', body: fd, headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } });
                if (res.ok) {
                    this.uploadAPIEnabled = newState;
                    // Auto-generate a key if enabling and no key exists
                    if (newState && (this.isAdmin ? !this.uploadAPIKey : !this.childAPIKey)) {
                        this.isAdmin ? await this.regenerateAPIKey() : await this.regenerateChildAPIKey();
                    }
                } else {
                    let d = await res.json();
                    if (d.error === 'ADMIN_DISABLED') {
                        this.showToast(this.t('err_admin_disabled'), 'error');
                    } else {
                        this.showToast(this.t('api_toggle_error'), 'error');
                    }
                }
            } catch(e) {
                this.showToast(this.t('status_error'), 'error');
            }
        },
        async toggleS3() {
            let newState = !this.s3Enabled;
            let endpoint = this.isAdmin ? '/api/settings/s3' : '/api/settings/child-s3';
            let fd = new FormData();
            fd.append('enabled', newState);
            try {
                let res = await fetch(endpoint, { method: 'POST', body: fd, headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } });
                if (res.ok) {
                    this.s3Enabled = newState;
                    this.showToast(this.t('toast_settings_saved'), 'success');
                } else {
                    let d = await res.json();
                    if (d.error === 'ADMIN_DISABLED') {
                        this.showToast(this.t('err_admin_disabled'), 'error');
                    } else {
                        this.showToast(this.t('status_error'), 'error');
                    }
                }
            } catch(e) {
                this.showToast(this.t('status_error'), 'error');
            }
        },
        async saveS3Credentials() {
            let fd = new FormData();
            fd.append('access_key', this.s3AccessKey);
            fd.append('secret_key', this.s3SecretKey);
            try {
                let res = await fetch('/api/settings/s3/credentials', { method: 'POST', body: fd, headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } });
                if (res.ok) {
                    this.showToast(this.t('toast_settings_saved'), 'success');
                } else {
                    this.showToast(this.t('status_error'), 'error');
                }
            } catch(e) {
                this.showToast(this.t('status_error'), 'error');
            }
        },
        async generateS3Keys() {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let ak = '';
            for (let i = 0; i < 20; i++) ak += chars.charAt(Math.floor(Math.random() * chars.length));
            
            const secretChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            let sk = '';
            for (let i = 0; i < 40; i++) sk += secretChars.charAt(Math.floor(Math.random() * secretChars.length));
            
            let fd = new FormData();
            fd.append('access_key', ak);
            fd.append('secret_key', sk);
            try {
                let res = await fetch('/api/settings/s3/credentials', { method: 'POST', body: fd, headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } });
                if (res.ok) {
                    this.s3AccessKey = ak;
                    this.s3SecretKey = sk;
                    this.showToast(this.t('toast_settings_saved'), 'success');
                } else {
                    this.showToast(this.t('status_error'), 'error');
                }
            } catch(e) {
                this.showToast(this.t('status_error'), 'error');
            }
        },
        async regenerateAPIKey() {
            try {
                let res = await fetch('/api/settings/upload-api/regenerate-key', { method: 'POST', headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } });
                if (res.ok) {
                    let d = await res.json();
                    this.uploadAPIKey = d.api_key;
                    this.showAPIKey = true;
                    this.showToast(this.t('api_key_regenerated'), 'success');
                } else {
                    this.showToast(this.t('api_toggle_error'), 'error');
                }
            } catch(e) {
                this.showToast(this.t('status_error'), 'error');
            }
        },
        async deleteAPIKey() {
            const confirmed = await this.customConfirm(this.t('api_key_delete_title'), this.t('api_key_delete_msg'), true);
            if (!confirmed) return;
            try {
                let res = await fetch('/api/settings/upload-api/key', { method: 'DELETE', headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } });
                if (res.ok) {
                    this.uploadAPIKey = '';
                    this.showAPIKey = false;
                    this.showToast(this.t('api_key_deleted'), 'success');
                }
            } catch(e) {
                this.showToast(this.t('status_error'), 'error');
            }
        },
        async fetchUsers() {
            try {
                const res = await fetch('/api/users');
                const data = await res.json();
                if (res.ok) {
                    this.users = data.users || [];
                }
            } catch (e) {
                console.error("Fetch users error", e);
            }
        },
        async fetchActiveTasks() {
            try {
                const res = await fetch('/api/tasks');
                const data = await res.json();
                if (res.ok && data.tasks) {
                    for (const [id, task] of Object.entries(data.tasks)) {
                        if (!this.uploadQueue.some(t => t.id === id)) {
                            // Don't restore finished tasks to keep UI clean
                            if (task.status === 'done' || task.status === 'error' || task.status === 'cancelled') continue;
                            
                            const isSinglePhase = id.startsWith('torrent_') || id.startsWith('torrent_file_') || id.startsWith('remote_');
                            let displayProgress = task.percent;
                            if (!isSinglePhase) {
                                if (task.status === 'telegram') {
                                    displayProgress = 50 + Math.round(task.percent / 2);
                                } else if (task.status === 'downloading' || task.status === 'uploading_to_server') {
                                    displayProgress = Math.round(task.percent / 2);
                                }
                            }

                            // Translate status message properly
                            let statusText = this.t(task.status) || task.status;
                            if (task.message) {
                                if (task.message.startsWith('uploading_part_')) {
                                    const matchOf = task.message.match(/uploading_part_(\d+)_of_(\d+)/);
                                    if (matchOf) statusText = this.t('uploading_part_x_of_y', {x: matchOf[1], y: matchOf[2]});
                                    else {
                                        const m = task.message.match(/uploading_part_(\d+)/);
                                        if (m) statusText = this.t('uploading_part', {n: m[1]});
                                    }
                                } else if (task.message && task.message.includes('|')) {
                                    const parts = task.message.split('|');
                                    const key = parts[0];
                                    const params = {};
                                    parts[1].split(',').forEach(p => {
                                        const [k, v] = p.split('=');
                                        params[k] = v;
                                    });
                                    statusText = this.t(key, params);
                                } else if (task.message.startsWith('retrying_part_')) {
                                    const m = task.message.match(/retrying_part_(\d+)_attempt_(\d+)/);
                                    if (m) statusText = this.t('retrying_part_attempt', {x: m[1], y: m[2]});
                                } else if (task.message === 'waiting_slot') {
                                    statusText = this.t('waiting_slot');
                                } else {
                                    const t = this.t(task.message);
                                    if (t !== task.message) statusText = t;
                                }
                            }

                            this.uploadQueue.push({
                                id: id,
                                name: task.filename || 'File',
                                progress: displayProgress,
                                statusText: statusText,
                                hasError: task.status === 'error',
                                isCancelled: task.status === 'cancelled',
                                size: task.size || 0,
                                singlePhase: isSinglePhase
                            });
                        }
                    }
                }
            } catch (e) {
                console.error("Fetch tasks error", e);
            }
        },
        async fetchSystemStatus() {
            try {
                const res = await fetch('/api/system/status');
                if (res.ok) {
                    const data = await res.json();
                    this.storageTotal = data.storage_total || 0;
                    this.storageFree = data.storage_free || 0;
                }
            } catch (e) {
                console.error("Fetch system status error", e);
            }
        },
        async fetchBackupInfo() {
            if (!this.isAdmin) return;
            try {
                const res = await fetch('/api/settings/backup');
                if (res.ok) {
                    this.backupInfo = await res.json();
                }
            } catch (e) {
                console.error("Fetch backup info error", e);
            }
        },
        async triggerBackup() {
            if (!this.isAdmin) return;
            try {
                const res = await fetch('/api/settings/backup', { method: 'POST', headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } });
                if (res.ok) {
                    this.backupInfo.is_running = true;
                    this.showToast(this.t('backup_started'), 'success');
                } else {
                    this.showToast(this.t('status_error'), 'error');
                }
            } catch (e) {
                this.showToast(this.t('conn_error'), 'error');
            }
        },
        async toggleBackupEnabled(e) {
            const enabled = e.target.checked;
            try {
                const formData = new FormData();
                formData.append('enabled', enabled);
                const res = await fetch('/api/settings/backup/toggle', {
                    method: 'POST',
                    headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() },
                    body: formData
                });
                if (res.ok) {
                    this.showToast(this.t('toast_settings_saved'), 'success');
                    this.backupInfo.enabled = enabled;
                } else {
                    e.target.checked = !enabled;
                    this.showToast(this.t('status_error'), 'error');
                }
            } catch (error) {
                e.target.checked = !enabled;
                this.showToast(this.t('conn_error'), 'error');
            }
        },
        async triggerRestore(e) {
            if (!this.isAdmin) return;
            const fileInput = e.target;
            const file = fileInput.files[0];
            if (!file) return;

            // Reset the file input value so same file can be selected again
            fileInput.value = '';

            // Use the promise-based customConfirm modal
            const confirmed = await this.customConfirm(
                this.t('restore_confirm_title'),
                this.t('restore_confirm_msg'),
                true
            );
            if (!confirmed) return;

            this.restoreLoading = true;
            try {
                const formData = new FormData();
                formData.append('backup_file', file);

                const res = await fetch('/api/settings/restore', {
                    method: 'POST',
                    headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() },
                    body: formData
                });

                if (res.ok) {
                    this.showToast(this.t('toast_restore_success'), 'success');
                    // Delay a bit so toast is readable, then reload/refresh system after app restarts
                    setTimeout(() => {
                        window.location.reload();
                    }, 5000);
                } else {
                    const data = await res.json();
                    const errMsg = data.error || 'Unknown error';
                    this.showToast(this.t('toast_restore_failed', {err: errMsg}), 'error');
                }
            } catch (err) {
                this.showToast(this.t('toast_restore_failed', {err: err.message}), 'error');
            } finally {
                this.restoreLoading = false;
            }
        },
        async fetchChildAPIKey() {
            try {
                const res = await fetch('/api/settings/child-api-key');
                if (res.ok) {
                    const data = await res.json();
                    this.childAPIKey = data.api_key || '';
                }
            } catch (e) {
                console.error("Fetch child API key error", e);
            }
        },
        async regenerateChildAPIKey() {
            try {
                const res = await fetch('/api/settings/child-api-key', { method: 'POST', headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } });
                if (res.ok) {
                    const data = await res.json();
                    this.childAPIKey = data.api_key;
                    this.showChildAPIKey = true;
                    this.showToast(this.t('api_key_regenerated'), 'success');
                } else {
                    this.showToast(this.t('api_toggle_error'), 'error');
                }
            } catch(e) {
                this.showToast(this.t('status_error'), 'error');
            }
        },
        async deleteChildAPIKey() {
            const confirmed = await this.customConfirm(this.t('api_key_delete_title'), this.t('api_key_delete_msg'), true);
            if (!confirmed) return;
            try {
                const res = await fetch('/api/settings/child-api-key', { method: 'DELETE', headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } });
                if (res.ok) {
                    this.childAPIKey = '';
                    this.showChildAPIKey = false;
                    this.showToast(this.t('api_key_deleted'), 'success');
                }
            } catch(e) {
                this.showToast(this.t('status_error'), 'error');
            }
        },
        async createUser() {
            this.isCreatingUser = true;
            try {
                let fd = new FormData();
                fd.append('username', this.userForm.username);
                const res = await fetch('/api/users', { method: 'POST', body: fd, headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } });
                if (res.ok) {
                    const data = await res.json();
                    this.userForm = { username: '' };
                    this.fetchUsers();
                    // Show temp password in a modal so admin can copy it
                    await this.customAlert(
                        this.t('toast_user_created_title'),
                        this.t('toast_user_created_msg', { p: data.temp_password || '' })
                    );
                } else {
                    const data = await res.json();
                    this.showToast(this.handleCommonError(data.error, 'status_error'), 'error');
                }
            } catch (e) {
                this.showToast(this.t('conn_error'), 'error');
            } finally {
                this.isCreatingUser = false;
            }
        },
        async deleteUser(username) {
            const confirmed = await this.customConfirm(this.t('delete_user_confirm_title'), this.t('delete_user_confirm_msg', {u: username}), true);
            if (!confirmed) return;
            try {
                const res = await fetch(`/api/users/${username}`, { method: 'DELETE', headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } });
                if (res.ok) {
                    this.showToast(this.t('toast_user_deleted'), 'success');
                    this.fetchUsers();
                } else {
                    this.showToast(this.t('status_error'), 'error');
                }
            } catch (e) {
                this.showToast(this.t('conn_error'), 'error');
            }
        },
        async resetUserPassword(username) {
            const confirmed = await this.customConfirm(this.t('reset_password_confirm_title'), this.t('reset_password_confirm_msg', {u: username}), false);
            if (!confirmed) return;
            try {
                const res = await fetch(`/api/users/${username}/reset-pass`, { method: 'POST', headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } });
                if (res.ok) {
                    const data = await res.json();
                    // Show temp password in a modal so admin can copy it
                    await this.customAlert(
                        this.t('reset_password_confirm_title'),
                        this.t('toast_password_reset_msg', { u: username, p: data.temp_password || '' })
                    );
                } else {
                    this.showToast(this.t('status_error'), 'error');
                }
            } catch (e) {
                this.showToast(this.t('conn_error'), 'error');
            }
        },
        async saveWebAuthnSettings() {
            let fd = new FormData();
            fd.append('rpid', this.webauthnRPID);
            fd.append('origins', this.webauthnOrigins);
            try {
                let res = await fetch('/api/settings/webauthn', { method: 'POST', body: fd, headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } });
                if (res.ok) {
                    this.showToast(this.t('toast_passkey_settings_saved'), 'success');
                } else {
                    this.showToast(this.t('status_error'), 'error');
                }
            } catch (e) {
                this.showToast(this.t('conn_error'), 'error');
            }
        },
        autoDetectWebAuthn() {
            this.webauthnRPID = window.location.hostname;
            this.webauthnOrigins = window.location.origin;
        },
        async autoDetectAndSaveWebAuthn() {
            this.autoDetectWebAuthn();
            await this.saveWebAuthnSettings();
        },

        async toggleLang() { 
            this.lang = await TeleCloud.toggleLang();
        },
        async setLang(code) {
            this.lang = await TeleCloud.setLang(code);
        },
        formatBytes(b, d) { return TeleCloud.formatBytes(b, d); },
        getSpeedColor(speed) {
            if (speed >= 5242880) return 'text-emerald-500'; // > 5MB/s
            if (speed >= 1048576) return 'text-amber-500';   // > 1MB/s
            return 'text-rose-500';                         // < 1MB/s
        },
        formatDate(d) { return TeleCloud.formatDate(d, this.lang); },
        getFileTypeData(f) { return TeleCloud.getFileTypeData(f); },
        parseMarkdown(t) { return TeleCloud.parseMarkdown(t); },

        startDownload(fileId) {
            this.isPreparingDownload = true;
            document.cookie = "dl_started=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = `/download/${fileId}`;
            document.body.appendChild(iframe);
            let checkCookie = setInterval(() => {
                if (document.cookie.includes('dl_started=1')) {
                    clearInterval(checkCookie);
                    this.isPreparingDownload = false;
                    this.showToast(this.t('toast_dl_started'), 'success');
                    document.cookie = "dl_started=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                    setTimeout(() => iframe.remove(), 2000); 
                }
            }, 500);
            setTimeout(() => {
                if (this.isPreparingDownload) {
                    clearInterval(checkCookie);
                    this.isPreparingDownload = false;
                    iframe.remove();
                    this.showToast(this.t('toast_tg_timeout'), 'error');
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
                iframe.src = `/download/${fileId}`;
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
        searchQuery: '',
        currentPage: 1,
        itemsPerPage: 30,
        get filteredFiles() {
            let results = [...this.files];
            if (this.searchQuery.trim() !== '') {
                const query = this.searchQuery.toLowerCase();
                results = results.filter(f => f.filename.toLowerCase().includes(query));
            }

            return results.sort((a, b) => {
                // Folders always first
                if (a.is_folder && !b.is_folder) return -1;
                if (!a.is_folder && b.is_folder) return 1;

                let valA, valB;
                if (this.sortBy === 'name') {
                    valA = a.filename.toLowerCase();
                    valB = b.filename.toLowerCase();
                } else if (this.sortBy === 'date') {
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
            return Math.ceil(this.filteredFiles.length / this.itemsPerPage) || 1;
        },
        get filteredTrashFiles() {
            if (!this.trashSearchQuery) return this.trashFiles;
            const q = this.trashSearchQuery.toLowerCase();
            return this.trashFiles.filter(f => f.filename.toLowerCase().includes(q));
        },
        get trashTotalPages() {
            return Math.ceil(this.filteredTrashFiles.length / this.trashItemsPerPage) || 1;
        },
        get displayedTrashFiles() {
            const start = (this.trashCurrentPage - 1) * this.trashItemsPerPage;
            return this.filteredTrashFiles.slice(start, start + this.trashItemsPerPage);
        },
        get displayedFiles() {
            const start = (this.currentPage - 1) * this.itemsPerPage;
            const end = start + this.itemsPerPage;
            return this.filteredFiles.slice(start, end);
        },
        currentPath: '/', 
        openMenuId: null,
        selectedIds: [], 
        clipboard: { action: null, ids: [] },
        dragOver: false, 
        uploadModal: false,
        uploadDragOver: false,
        uploadQueue: [], 
        isQueueMinimized: false,
        passkeys: [],
        get isAllUploadsDone() {
            if (this.uploadQueue.length === 0) return false;
            return this.uploadQueue.every(t => t.progress === 100 || t.isCancelled || t.hasError);
        },
        cancelUpload(taskId) {
            let task = this.uploadQueue.find(t => t.id === taskId);
            if (!task) return;

            // If task is already cancelled, errored, or done, clicking "X" removes it from UI
            if (task.isCancelled || task.hasError || task.status === 'done') {
                this.uploadQueue = this.uploadQueue.filter(t => t.id !== taskId);
                return;
            }

            // Otherwise, mark as cancelled and notify backend
            task.isCancelled = true;
            task.statusText = this.t('cancelled');
            
            // Abort active HTTP requests if any
            if (task._xhrs && Array.isArray(task._xhrs)) {
                task._xhrs.forEach(xhr => {
                    try { xhr.abort(); } catch(e) {}
                });
                task._xhrs = [];
            }
            
            let fd = new FormData();
            fd.append('task_id', taskId);
            fd.append('filename', task.name);
            fetch('/api/cancel_upload', { method: 'POST', body: fd, headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } }).catch(e => console.error("Cancel failed:", e));
        },
        toastModal: { show: false, message: '', type: 'success', persistent: false },
        toastTimeout: null,
        playerInstance: null,
        imageViewer: { show: false, src: '', filename: '' },
        lightboxLoading: false,
        comicViewer: { show: false, file: null, pages: [], pageUrls: [], currentPageIndex: 0, loading: false, fitMode: 'height', pageLoading: false, scrollMode: 'page', autoScrollActive: false, autoScrollSpeed: 2, settingsOpen: false },
        epubViewer: { show: false, file: null, loading: false, sidebarOpen: false, toc: [], fontSize: 100, pageProgress: 0, scrollMode: 'scrolled', autoScrollActive: false, autoScrollSpeed: 2, settingsOpen: false, spine: [], resourceBaseUrl: '', currentChapter: 0, title: '' },
        pdfViewer: { show: false, file: null, loading: false, sidebarOpen: false, toc: [], zoom: 100, pageProgress: 0, settingsOpen: false, currentPage: 1, numPages: 0, darkModeFilter: false, pageLoading: false, autoScrollActive: false, autoScrollSpeed: 2, scrollMode: 'page' },
        fileInfoModal: { show: false, file: null, typeName: '', ext: '', svgIcon: '', bgColor: '', isMedia: false, mediaHtml: '', isLarge: false, isPreviewLoading: false, needsLoad: false, tooLarge: false, bypassWarning: false, unsupportedMedia: false },
        modal: { show: false, type: 'alert', title: '', message: '', input: '', resolve: null, isDanger: false, inputType: 'text', applyToAll: false },
        contextMenu: { show: false, x: 0, y: 0, file: null },
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

            // Always apply theme (will be 'system' for non-logged-in users)
            TeleCloud.initTheme(this.currentTheme);

            if (this.isLoggedIn) {
                this.fetchFiles(false);
                this.checkUpdate();
                this.initWebSocket();
                this.fetchPasskeys();
                this.fetchActiveTasks();
                this.fetchYTDLPStatus();
                this.fetchTorrentStatus();
                this.checkYTDLPCookies();
                this.fetchSystemStatus();
                this.fetchBackupInfo();

                // Refresh system status every 30 seconds
                setInterval(() => {
                    this.fetchSystemStatus();
                    this.fetchBackupInfo();
                }, 30000);
                
                if (!this.isAdmin) {
                    this.fetchChildAPIKey();
                }

                // Add hasError to existing tasks if any
                this.uploadQueue.forEach(t => { if(t.hasError === undefined) t.hasError = false; });

                // Warn user before leaving page if uploads are active
                window.addEventListener('beforeunload', (e) => {
                    const hasActiveUploads = this.uploadQueue.some(t => !t.hasError && t.progress < 100);
                    if (hasActiveUploads) {
                        e.preventDefault();
                        e.returnValue = ''; // Standard way to trigger the browser's confirmation dialog
                    }
                });

                // Listen for global paste events to upload files/images from clipboard
                window.addEventListener('paste', (e) => {
                    const active = document.activeElement;
                    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable || active.getAttribute('contenteditable') === 'true')) {
                        return;
                    }

                    const items = (e.clipboardData || window.clipboardData)?.items;
                    if (!items) return;

                    const files = [];
                    for (const item of items) {
                        if (item.kind === 'file') {
                            const file = item.getAsFile();
                            if (file) {
                                files.push(file);
                            }
                        }
                    }

                    if (files.length > 0) {
                        e.preventDefault();
                        this.customConfirm(this.t('paste_confirm_title'), this.t('paste_confirm_msg')).then((confirmed) => {
                            if (confirmed) {
                                this.uploadFiles(files);
                            }
                        });
                    }
                });
            }
        },
        async checkUpdate() {
            const compareVersions = (v1, v2) => {
                const p1 = (v1 || 'v0.0.0').replace(/^v/, '').split('.').map(Number);
                const p2 = (v2 || 'v0.0.0').replace(/^v/, '').split('.').map(Number);
                for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
                    const n1 = p1[i] || 0;
                    const n2 = p2[i] || 0;
                    if (n1 > n2) return 1;
                    if (n1 < n2) return -1;
                }
                return 0;
            };

            try {
                const res = await fetch('https://api.github.com/repos/dabeecao/telecloud-go/releases');
                if (res.ok) {
                    const releases = await res.json();
                    if (releases && releases.length > 0) {
                        const latest = releases[0];
                        const latestVersion = latest.tag_name;
                        const currentVersion = TeleCloud.version || 'v1.0.0';
                        
                        if (latestVersion && compareVersions(latestVersion, currentVersion) === 1) {
                            this.updateAvailable = true;
                            this.latestReleaseUrl = latest.html_url;
                            this.changelog = releases.slice(0, 5).map(r => ({
                                tag: r.tag_name,
                                name: r.name,
                                body: r.body,
                                url: r.html_url,
                                date: r.published_at
                            }));

                            const dismissedDate = localStorage.getItem('tc_update_dismissed');
                            const today = new Date().toDateString();
                            
                            if (dismissedDate !== today) {
                                const choice = await this.showUIModal('update', this.t('update_title'), this.t('update_msg') + ` (${latestVersion})`);
                                if (choice === 'confirm') {
                                    this.currentTab = 'changelog';
                                } else if (choice === 'dismiss_today') {
                                    localStorage.setItem('tc_update_dismissed', today);
                                }
                            }
                        }
                    }
                }
            } catch (e) { console.error('Failed to check for updates', e); }
        },
        initWebSocket() {
            if (this.ws) return;
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/api/ws`;
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    let task = this.uploadQueue.find(t => t.id === data.task_id);
                    if (!task) {
                        // Dynamically create task if it's not in the visible queue (e.g., torrent subtasks)
                        if (data.status === 'done' || data.status === 'error' || data.status === 'cancelled') return;
                        
                        const isSinglePhase = data.task_id.startsWith('torrent_') || data.task_id.startsWith('torrent_file_') || data.task_id.startsWith('remote_');
                        let progress = data.percent || 0;
                        if (!isSinglePhase) {
                            progress = Math.round(progress / 2);
                        }

                        task = {
                            id: data.task_id,
                            name: data.filename || 'File',
                            filename: data.filename,
                            size: data.size || 0,
                            uploadedBytes: data.uploaded_bytes || 0,
                            progress: progress,
                            status: data.status,
                            statusText: '',
                            hasError: false,
                            isCancelled: false,
                            countdown: 5,
                            countdownInterval: null,
                            isTorrent: data.task_id.startsWith('torrent_') || data.task_id.startsWith('torrent_file_'),
                            singlePhase: isSinglePhase
                        };
                        
                        // Parse message immediately for new tasks
                        let msg = data.message;
                        if (msg && msg.includes('|')) {
                            const parts = msg.split('|');
                            const key = parts[0];
                            const params = {};
                            parts[1].split(',').forEach(p => {
                                const [k, v] = p.split('=');
                                params[k] = v;
                            });
                            msg = this.t(key, params);
                        } else if (msg) {
                            msg = this.t(msg);
                        }
                        task.statusText = msg || this.t(data.status);

                        this.tasks[data.task_id] = task;
                        this.uploadQueue.unshift(task);
                    }

                    if (task) {
                        if (task.isCancelled && data.status !== 'cancelled') return;
                        if (data.size && data.size > 0 && (!task.size || task.size === 0)) {
                            task.size = data.size;
                        }
                        if (data.status === 'downloading' || data.status === 'telegram' || data.status === 'uploading' || data.status === 'done' || data.status === 'error' || data.status === 'cancelled') {
                            task.status = data.status;
                            let msg = data.message;
                            if (msg && msg.startsWith('uploading_part_')) {
                                const matchOf = msg.match(/uploading_part_(\d+)_of_(\d+)/);
                                if (matchOf) {
                                    msg = this.t('uploading_part_x_of_y', {x: matchOf[1], y: matchOf[2]});
                                } else {
                                    const matchSingle = msg.match(/uploading_part_(\d+)/);
                                    if (matchSingle) {
                                        msg = this.t('uploading_part', {n: matchSingle[1]});
                                    }
                                }
                            } else if (msg && msg.startsWith('retrying_part_')) {
                                const match = msg.match(/retrying_part_(\d+)_attempt_(\d+)/);
                                if (match) {
                                    msg = this.t('retrying_part_attempt', {x: match[1], y: match[2]});
                                }
                            } else if (msg && msg.includes('|')) {
                                const parts = msg.split('|');
                                const key = parts[0];
                                const params = {};
                                parts[1].split(',').forEach(p => {
                                    const [k, v] = p.split('=');
                                    params[k] = v;
                                });
                                msg = this.t(key, params);
                            } else {
                                msg = this.t(msg);
                            }
                            task.statusText = msg || this.t(data.status);
                            task.hasError = false;
                        }

                        if (data.status === 'uploading_to_server' || data.status === 'downloading') {
                            task.status = data.status;
                            if (!task.hasError) {
                                task.statusText = this.t(data.message) || task.statusText;
                                // Phase 1: 0-50%
                                if (data.percent !== undefined) {
                                    task.progress = task.singlePhase ? data.percent : Math.round(data.percent / 2);
                                }
                                if (data.speed !== undefined && data.speed > 0) {
                                    task.speed = data.speed;
                                }
                                if (data.uploaded_bytes !== undefined && data.uploaded_bytes > 0) {
                                    task.uploadedBytes = data.uploaded_bytes;
                                }
                                if (data.size !== undefined && data.size > 0) {
                                    task.size = data.size;
                                }
                                if (data.filename) {
                                    task.filename = data.filename;
                                    if (task.name === 'Torrent' || task.name === 'File' || task.isTorrent || !task.name) {
                                        task.name = data.filename; // Only sync UI binding for generic tasks to avoid overwriting local file names
                                    }
                                }
                            }
                        } else if (data.message === 'waiting_slot') {
                            task.statusText = this.t('waiting_slot');
                            task.hasError = false;
                            // If waiting for Telegram upload, we're at 50%
                            // If waiting for yt-dlp download, we're at 0%
                            task.progress = (data.status === 'telegram') ? 50 : 0;
                        }

                        if (data.status === 'telegram' || data.status === 'done') {
                            // Phase 2: 50-100% for normal, 0-100% for singlePhase (Remote Upload)
                            if (task.singlePhase) {
                                task.progress = data.percent;
                            } else {
                                task.progress = 50 + Math.round(data.percent / 2);
                            }
                            
                            if (data.uploaded_bytes && data.uploaded_bytes > 0) {
                                // Reset metrics when starting Telegram phase
                                if (data.status === 'telegram' && (!task._speedInit || task.statusText === this.t('pushing_to_tg'))) {
                                    task.startTime = Date.now();
                                    task.uploadedBytes = data.uploaded_bytes;
                                    task.lastSpeedBytes = data.uploaded_bytes;
                                    task.lastSpeedTime = Date.now();
                                    task.speed = 0;
                                    task._speedBuffer = [];
                                    task._speedInit = true;
                                }
                                
                                task.uploadedBytes = data.uploaded_bytes;
                                const now = Date.now();
                                const lastTime = task.lastSpeedTime || task.startTime || now;
                                const elapsed = (now - lastTime) / 1000;

                                // Update speed every 1 second to ensure stability
                                if (elapsed >= 1.0) {
                                    const bytesSent = task.uploadedBytes - (task.lastSpeedBytes || 0);
                                    if (bytesSent >= 0) {
                                        const instantSpeed = bytesSent / elapsed;
                                        
                                        // Use a sliding window of the last 5 samples for professional-grade stability
                                        if (!task._speedBuffer) task._speedBuffer = [];
                                        task._speedBuffer.push(instantSpeed);
                                        if (task._speedBuffer.length > 5) task._speedBuffer.shift();
                                        
                                        // Average the buffer to get a stable "moving average" speed
                                        const sum = task._speedBuffer.reduce((a, b) => a + b, 0);
                                        task.speed = sum / task._speedBuffer.length;
                                    }
                                    task.lastSpeedTime = now;
                                    task.lastSpeedBytes = task.uploadedBytes;
                                }
                            }
                        }

                        if (data.status === 'done' && !task._countdownStarted) {
                            task.progress = 100;
                            task.statusText = this.t('done');
                            task.hasError = false;
                            this.fetchFiles(true);
                            
                            // Visual countdown before removal
                            task._countdownStarted = true;
                            task.countdown = 5;
                            if (task.countdownInterval) clearInterval(task.countdownInterval);
                            
                            task.countdownInterval = setInterval(() => {
                                task.countdown--;
                                if (task.countdown <= 0) {
                                    clearInterval(task.countdownInterval);
                                    this.uploadQueue = this.uploadQueue.filter(t => t.id !== task.id);
                                }
                            }, 1000);
                        } else if (data.status === 'error') {
                            const errorMsg = data.message || '';
                            // Error messages may be "key: detail" (e.g., "upload_part_failed: rpc error...")
                            // Try to translate the key part and append the detail for context.
                            let displayError;
                            const colonIdx = errorMsg.indexOf(': ');
                            if (colonIdx > 0) {
                                const keyPart = errorMsg.substring(0, colonIdx);       // e.g. "upload_part_failed"
                                const detailPart = errorMsg.substring(colonIdx + 2);   // e.g. "rpc error..."
                                const translatedKey = this.t(keyPart);
                                if (translatedKey !== keyPart) {
                                    // Key has a translation — show "TranslatedKey (detail)"
                                    displayError = translatedKey + ' (' + detailPart + ')';
                                } else {
                                    // No translation for compound key — try whole string
                                    const translatedFull = this.t(errorMsg);
                                    displayError = (translatedFull !== errorMsg) ? translatedFull : errorMsg;
                                }
                            } else {
                                const translated = this.t(errorMsg);
                                displayError = (translated !== errorMsg) ? translated : errorMsg;
                            }
                            task.statusText = this.t('status_error') + ': ' + displayError;
                            task.hasError = true;
                        } else if (data.status === 'cancelled') {
                            task.statusText = this.t('cancelled');
                            task.isCancelled = true;
                            task.hasError = false;
                        }
                    }
                } catch (e) {
                    console.error('WS message error:', e);
                }
            };

            this.ws.onclose = () => {
                this.ws = null;
                // Reconnect after 5 seconds
                setTimeout(() => this.initWebSocket(), 5000);
            };

            this.ws.onerror = (err) => {
                console.error('WS error:', err);
                this.ws.close();
            };
        },
        showUIModal(type, title, message = '', defaultValue = '', isDanger = false, inputType = 'text') {
            return new Promise((resolve) => {
                this.modal = { show: true, type, title, message, input: defaultValue, resolve, isDanger, inputType };
                if (type === 'prompt') {
                    setTimeout(() => { if (this.$refs.modalInput) this.$refs.modalInput.focus(); }, 100);
                }
            });
        },
        closeUIModal(result) {
            if (this.modal.resolve) this.modal.resolve(result);
            this.modal.show = false;
        },
        async customPrompt(title, defaultValue = '', inputType = 'text') { return await this.showUIModal('prompt', title, '', defaultValue, false, inputType); },
        async customConfirm(title, message, isDanger = false) { return await this.showUIModal('confirm', title, message, '', isDanger); },
        async customAlert(title, message) { return await this.showUIModal('alert', title, message); },
        openContextMenu(e, file) {
            if (!file) return; 
            this.contextMenu.file = file;
            let x = e.clientX; let y = e.clientY;
            if (window.innerWidth - x < 210) x = window.innerWidth - 210;
            if (window.innerHeight - y < 250) y = window.innerHeight - 250;
            this.contextMenu.x = x;
            this.contextMenu.y = y;
            this.contextMenu.show = true;
        },
        closeContextMenu() { this.contextMenu.show = false; },
        async login() {
            if (this.isLoggingIn) return;
            this.isLoggingIn = true;
            try {
                const fd = new FormData(); 
                fd.append('username', this.username);
                fd.append('password', this.password);
                const res = await fetch('/login', { method: 'POST', body: fd });
                if (res.ok) {
                    const data = await res.json();
                    if (data.status === 'force_password_change') {
                        await this.customAlert(this.t('force_password_change_title'), this.t('force_password_change_msg'));
                        const newPass = await this.customPrompt(this.t('new_password'), "", "password");
                        if (!newPass) return;
                        const confirmPass = await this.customPrompt(this.t('confirm_password'), "", "password");
                        if (newPass !== confirmPass) {
                            this.showToast(this.t('toast_pass_mismatch'), 'error');
                            return;
                        }
                        
                        // Call change password API
                        let cfd = new FormData();
                        cfd.append('old_password', this.password);
                        cfd.append('new_password', newPass);
                        let cres = await fetch('/api/settings/password', { 
                            method: 'POST', 
                            body: cfd, 
                            headers: { 
                                'X-CSRF-Token': TeleCloud.getCsrfToken(),
                                // We need to pass the login credentials because we don't have a session yet
                                'Authorization': 'Basic ' + btoa(this.username + ':' + this.password)
                            } 
                        });

                        if (cres.ok) {
                            this.showToast(this.t('toast_pass_changed'), 'success');
                            // Update stored password to the new one so the next login() call succeeds
                            this.password = newPass;
                            // After change, log in again automatically to get a real session
                            this.isLoggingIn = false; 
                            return await this.login();
                        } else {
                            const d = await cres.json();
                            this.showToast(this.handleCommonError(d.error, 'status_error'), 'error');
                        }
                    } else {
                        window.location.href = '/'; 
                    }
                } else {
                    const data = await res.json();
                    this.showToast(this.handleCommonError(data.error, 'toast_login_fail'), 'error');
                }
            } catch (e) {
                this.showToast(this.t('conn_error'), 'error');
            } finally {
                this.isLoggingIn = false;
            }
        },
        async loginWithPasskey() {
            if (!window.PublicKeyCredential) {
                this.showToast(this.t('passkey_not_supported'), 'error');
                return;
            }
            if (this.isPasskeyLoading) return;
            this.isPasskeyLoading = true;
            try {
                const beginResp = await fetch('/api/passkey/login/begin' + (this.username ? '?username=' + this.username : ''));
                const options = await beginResp.json();
                if (options.error) throw new Error(options.error);
                const bufferToBase64 = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
                const base64ToBuffer = (base64) => {
                    const binary = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
                    const buffer = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
                    return buffer.buffer;
                };
                options.publicKey.challenge = base64ToBuffer(options.publicKey.challenge);
                if (options.publicKey.allowCredentials) {
                    options.publicKey.allowCredentials.forEach(c => c.id = base64ToBuffer(c.id));
                }
                const credential = await navigator.credentials.get(options);
                const finishResp = await fetch('/api/passkey/login/finish', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': TeleCloud.getCsrfToken() },
                    body: JSON.stringify({
                        id: credential.id,
                        rawId: bufferToBase64(credential.rawId),
                        type: credential.type,
                        response: {
                            authenticatorData: bufferToBase64(credential.response.authenticatorData),
                            clientDataJSON: bufferToBase64(credential.response.clientDataJSON),
                            signature: bufferToBase64(credential.response.signature),
                            userHandle: credential.response.userHandle ? bufferToBase64(credential.response.userHandle) : null
                        }
                    })
                });
                const result = await finishResp.json();
                if (result.status === 'force_password_change') {
                    this.isPasskeyLoading = false;
                    await this.customAlert(this.t('force_password_change_title'), this.t('force_password_change_msg'));
                    const newPass = await this.customPrompt(this.t('new_password'), "", "password");
                    if (!newPass) return;
                    const confirmPass = await this.customPrompt(this.t('confirm_password'), "", "password");
                    if (newPass !== confirmPass) {
                        this.showToast(this.t('toast_pass_mismatch'), 'error');
                        return;
                    }
                    let cfd = new FormData();
                    cfd.append('old_password', "");
                    cfd.append('new_password', newPass);
                    let cres = await fetch('/api/settings/password', { method: 'POST', body: cfd, headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } });
                    if (cres.ok) {
                        this.showToast(this.t('toast_pass_changed'), 'success');
                        window.location.href = '/';
                    } else {
                        const d = await cres.json();
                        this.showToast(this.handleCommonError(d.error, 'status_error'), 'error');
                    }
                } else if (result.status === 'success') {
                    window.location.href = '/';
                } else {
                    throw new Error(result.error || this.t('err_passkey_auth_failed'));
                }
            } catch (err) {
                this.isPasskeyLoading = false;
                if (err.name === 'AbortError' || err.name === 'NotAllowedError') return;
                console.error(err);
                this.showToast(this.t('passkey_error') + ': ' + err.message, 'error');
            }
        },

        async logout() { await fetch('/logout', { method: 'POST', headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } }); window.location.href = '/login'; },
        getBreadcrumbs() { return this.currentPath === '/' ? [] : this.currentPath.split('/').filter(Boolean); },
        navigateToFolder(folderName) { if (this.isLoading || this.isRefreshing) return; this.currentPath = this.currentPath === '/' ? '/' + folderName : this.currentPath + '/' + folderName; this.fetchFiles(); },
        navigateToIndex(index) { if (this.isLoading || this.isRefreshing) return; this.currentPath = '/' + this.getBreadcrumbs().slice(0, index + 1).join('/'); this.fetchFiles(); },
        navigateTo(path) { if (this.isLoading || this.isRefreshing) return; this.currentPath = path; this.fetchFiles(); },
        async fetchFiles(silentLoad = false) {
            // Debounce silent refreshes: many tasks completing simultaneously
            // would otherwise hammer /api/files. Coalesce into a single call
            // after 800ms of quiet. Non-silent calls (navigation) run immediately.
            if (silentLoad) {
                if (this._fetchDebounceTimer) clearTimeout(this._fetchDebounceTimer);
                this._fetchDebounceTimer = setTimeout(() => {
                    this._fetchDebounceTimer = null;
                    this._doFetchFiles(true);
                }, 800);
                return;
            }
            return this._doFetchFiles(false);
        },
        async _doFetchFiles(silentLoad = false) {
            if (this.isLoading || this.isRefreshing) return;
            const startTime = Date.now();
            if (!silentLoad && (!this.files || this.files.length === 0)) { this.isLoading = true; } else { this.isRefreshing = true; }
            try {
                const res = await fetch(`/api/files?path=${encodeURIComponent(this.currentPath)}`);
                if (res.status === 401) {
                    window.location.href = '/login';
                    return;
                }
                if (res.status === 403) {
                    const data = await res.json();
                    if (data.error === 'force_password_change') {
                        this.logout();
                        return;
                    }
                }
                const data = await res.json();
                this.files = data.files || [];
                if (data.storage_used !== undefined) this.storageUsed = data.storage_used;
                this.selectedIds = this.selectedIds.filter(id => this.files.some(f => f.id === id));
                if (!silentLoad) { this.searchQuery = ''; this.currentPage = 1; } else { if (this.currentPage > this.totalPages) this.currentPage = Math.max(1, this.totalPages); }
            } catch (e) { console.error('Fetch error', e); } finally { 
                const elapsed = Date.now() - startTime;
                if (elapsed < 500 && this.isRefreshing) await new Promise(r => setTimeout(r, 500 - elapsed));
                this.isLoading = false; this.isRefreshing = false; 
            }
        },
        async fetchTrashFiles() {
            if (this.isTrashLoading) return;
            const startTime = Date.now();
            this.isTrashLoading = true;
            try {
                const res = await fetch('/api/trash');
                if (res.ok) {
                    const data = await res.json();
                    this.trashFiles = data.files || [];
                }
            } catch (e) {
                console.error('Fetch trash error', e);
            } finally {
                const elapsed = Date.now() - startTime;
                if (elapsed < 500) await new Promise(r => setTimeout(r, 500 - elapsed));
                this.isTrashLoading = false;
            }
        },
        async restoreFile(id) {
            try {
                const res = await fetch(`/api/files/${id}/restore`, { 
                    method: 'POST', 
                    headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } 
                });
                if (res.ok) {
                    this.showToast(this.t('toast_restored'), 'success');
                    this.fetchTrashFiles();
                    this.fetchFiles(true);
                } else {
                    const d = await res.json();
                    this.showToast(this.handleCommonError(d.error, 'status_error'), 'error');
                }
            } catch (e) {
                this.showToast(this.t('conn_error'), 'error');
            }
        },
        async permanentDeleteFile(id) {
            const confirmed = await this.customConfirm(this.t('delete_permanent_title'), this.t('delete_permanent_msg'), true);
            if (!confirmed) return;
            try {
                const res = await fetch(`/api/files/${id}/permanent`, { 
                    method: 'DELETE', 
                    headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } 
                });
                if (res.ok) {
                    this.showToast(this.t('toast_deleted_permanent'), 'success');
                    this.fetchTrashFiles();
                } else {
                    const d = await res.json();
                    this.showToast(this.handleCommonError(d.error, 'status_error'), 'error');
                }
            } catch (e) {
                this.showToast(this.t('conn_error'), 'error');
            }
        },
        async emptyTrash() {
            const confirmed = await this.customConfirm(this.t('empty_trash'), this.t('empty_trash_confirm_msg'), true);
            if (!confirmed) return;
            this.isTrashLoading = true;
            try {
                const res = await fetch('/api/trash', { 
                    method: 'DELETE', 
                    headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } 
                });
                if (res.ok) {
                    this.showToast(this.t('toast_trash_emptied'), 'success');
                    this.trashFiles = [];
                    this.fetchFiles(true);
                } else {
                    const d = await res.json();
                    this.showToast(this.handleCommonError(d.error, 'status_error'), 'error');
                }
            } catch (e) {
                this.showToast(this.t('conn_error'), 'error');
            } finally {
                this.isTrashLoading = false;
            }
        },
        async createNewFolder() {
            const name = await this.customPrompt(this.t('new_folder_title'), "");
            if (!name || name.trim() === "") return;
            const tempId = 'temp_' + Date.now();
            this.files.unshift({ id: tempId, filename: name.trim(), is_folder: true, size: 0, created_at: new Date().toISOString() });
            const fd = new FormData(); fd.append('name', name.trim()); fd.append('path', this.currentPath);
            const response = await fetch('/api/folders', { method: 'POST', body: fd, headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } });
            if (response.ok) {
                this.fetchFiles(true); 
                this.showToast(this.t('toast_created', {n: name.trim()}));
            } else {
                const data = await response.json();
                this.showToast(this.handleCommonError(data.error, 'status_error'), 'error');
            }
        },
        copyToClipboard(action, idsArray) { this.clipboard = { action: action, ids: [...idsArray] }; this.selectedIds = []; },
        async executePaste() {
            if (this.clipboard.ids.length === 0) return;
            if (this.clipboard.action === 'move') this.files = this.files.filter(f => !this.clipboard.ids.includes(f.id));
            const response = await fetch('/api/actions/paste', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': TeleCloud.getCsrfToken() }, body: JSON.stringify({ action: this.clipboard.action, item_ids: this.clipboard.ids, destination: this.currentPath }) });
            if (response.ok) {
                this.clipboard = { action: null, ids: [] }; 
                this.fetchFiles(true);
                this.showToast(this.t('toast_pasted'));
            } else {
                const data = await response.json();
                this.showToast(this.handleCommonError(data.error, 'status_error'), 'error');
                this.fetchFiles(true);
            }
        },
        async deleteBatch() {
            const confirmed = await this.customConfirm(this.t('delete_confirm_title'), this.t('delete_batch_msg', {n: this.selectedIds.length}), true);
            if (!confirmed) return;
            const idsToDelete = [...this.selectedIds];
            this.files = this.files.filter(f => !idsToDelete.includes(f.id));
            this.selectedIds = [];
            let successCount = 0;
            let errorOccurred = false;
            for (let id of idsToDelete) {
                const response = await fetch(`/api/files/${id}`, { method: 'DELETE', headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } });
                if (response.ok) successCount++;
                else errorOccurred = true;
            }
            this.fetchFiles(true);
            if (errorOccurred) {
                this.showToast(this.t('status_error'), 'error');
            } else {
                this.showToast(this.t('toast_deleted', {n: successCount}), 'success');
            }
        },
        remoteUploadModal: false,
        remoteUrl: '',
        remoteOverwrite: false,
        remoteIsBulk: false,
        remoteIsSubmitting: false,
        uploadQueue: [],
        async submitRemoteUpload() {
            if (!this.remoteUrl || this.remoteIsSubmitting) return;
            
            const urls = this.remoteUrl.split('\n').map(u => u.trim()).filter(u => u !== '');
            if (urls.length === 0) return;
            if (urls.length > 50) {
                this.showToast(this.t('err_max_urls').replace('{n}', 50), 'error');
                return;
            }

            this.remoteIsSubmitting = true;
            try {
                const isSocialMedia = (url) => {
                    try {
                        const u = new URL(url);
                        const host = u.hostname.toLowerCase().replace(/^www\./, '');
                        const socialDomains = [
                            'youtube.com', 'youtu.be', 'tiktok.com', 'facebook.com', 'fb.watch', 'fb.com',
                            'instagram.com', 'instagr.am', 'twitter.com', 'x.com', 'twitch.tv',
                            'vimeo.com', 'dailymotion.com', 'soundcloud.com', 'reddit.com', 'threads.net',
                            'bilibili.com', 'douyin.com', 'kuai.com', 'kuaishou.com'
                        ];
                        return socialDomains.some(d => host === d || host.endsWith('.' + d));
                    } catch (e) { return false; }
                };

                let tasksStarted = 0;
                for (const rawUrl of urls) {
                    let targetUrl = rawUrl;
                    try {
                        const u = new URL(targetUrl);
                        if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error();
                    } catch (e) {
                        this.showToast(this.t('err_invalid_url') + ': ' + targetUrl, 'error');
                        continue;
                    }

                    if (isSocialMedia(targetUrl)) {
                        if (!this.remoteIsBulk) {
                            // Jump to YT-DLP tab and fetch info
                            this.remoteUploadModal = false;
                            this.currentTab = 'ytdlp';
                            this.ytdlpUrl = targetUrl;
                            this.ytdlpInfo = null;
                            this.fetchYTDLPFormats();
                            return; // Exit early as we transitioned
                        }

                        // Batch mode or user continued: Route to YT-DLP background download
                        const taskId = 'ytdlp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
                        this.uploadQueue.push({
                            id: taskId,
                            name: 'Social: ' + targetUrl,
                            progress: 0,
                            statusText: this.t('preparing_upload'),
                            isCancelled: false,
                            hasError: false,
                            status: 'preparing',
                            size: 0,
                            singlePhase: false,
                            ytdlpUrl: targetUrl,
                            targetPath: this.currentPath
                        });
                        tasksStarted++;

                        let fd = new FormData();
                        fd.append('url', targetUrl);
                        fd.append('path', this.currentPath);
                        fd.append('download_type', 'video'); // Default to video for auto-social
                        fd.append('task_id', taskId);
                        
                        try {
                            let res = await fetch('/api/ytdlp/download', {
                                method: 'POST',
                                body: fd,
                                headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() }
                            });
                            if (!res.ok) {
                                let d = await res.json();
                                let task = this.uploadQueue.find(t => t.id === taskId);
                                if (task) {
                                    task.statusText = this.handleCommonError(d.error, 'status_error');
                                    task.hasError = true;
                                }
                            }
                        } catch (e) {
                            let task = this.uploadQueue.find(t => t.id === taskId);
                            if (task) {
                                task.statusText = this.t('conn_error');
                                task.hasError = true;
                            }
                        }
                        continue;
                    }

                    // Regular Remote Upload - Check first
                    try {
                        let checkFd = new FormData();
                        checkFd.append('url', targetUrl);
                        let checkRes = await fetch('/api/remote-upload/check', {
                            method: 'POST',
                            body: checkFd,
                            headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() }
                        });

                        if (checkRes.ok) {
                            const meta = await checkRes.json();
                            let warningShown = false;
                            if (meta.content_type && meta.content_type.includes('text/html')) {
                                warningShown = true;
                                const confirmed = await this.customConfirm(
                                    this.t('remote_html_confirm_title'), 
                                    this.t('remote_html_confirm_msg') + 
                                    '<div class="mt-3 p-3 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 text-[10px] font-mono flex flex-col gap-1">' +
                                    '<span class="text-slate-400 uppercase font-bold tracking-wider">URL:</span>' +
                                    '<div class="text-slate-600 dark:text-slate-400 truncate select-all" title="' + targetUrl + '">' + targetUrl + '</div>' +
                                    '</div>'
                                );
                                if (!confirmed) continue;
                            }

                            // Range Support Check - Only show if HTML warning wasn't already shown
                            if (!warningShown && meta.range_support === false && (meta.content_length > 200 * 1024 * 1024 || meta.content_length === 0)) {
                                const confirmed = await this.customConfirm(
                                    this.t('remote_poor_url_confirm_title'),
                                    this.t('remote_poor_url_confirm_msg') +
                                    '<div class="mt-3 p-3 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 text-[10px] font-mono flex flex-col gap-1">' +
                                    '<span class="text-slate-400 uppercase font-bold tracking-wider">URL:</span>' +
                                    '<div class="text-slate-600 dark:text-slate-400 truncate select-all" title="' + targetUrl + '">' + targetUrl + '</div>' +
                                    '</div>'
                                );
                                if (!confirmed) continue;
                            }

                            const taskId = 'remote_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
                            const displayName = meta.filename || (targetUrl.split('/').pop() || targetUrl);
                            
                            this.uploadQueue.push({
                                id: taskId,
                                name: 'URL: ' + displayName,
                                progress: 0,
                                statusText: this.t('preparing_upload'),
                                isCancelled: false,
                                hasError: false,
                                status: 'preparing',
                                size: meta.content_length || 0,
                                singlePhase: true,
                                remoteUrl: targetUrl,
                                targetPath: this.currentPath,
                                overwrite: this.remoteOverwrite
                            });
                            tasksStarted++;

                            let fd = new FormData();
                            fd.append('url', targetUrl);
                            fd.append('path', this.currentPath);
                            fd.append('overwrite', this.remoteOverwrite);
                            fd.append('task_id', taskId);

                            let res = await fetch('/api/remote-upload', {
                                method: 'POST',
                                body: fd,
                                headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() }
                            });

                            if (!res.ok) {
                                let d = await res.json();
                                this.uploadQueue = this.uploadQueue.filter(t => t.id !== taskId);
                                this.showToast(this.handleCommonError(d.error, 'status_error') + ': ' + targetUrl, 'error');
                            }
                        } else {
                            let errorMsg = 'remote_failed';
                            try {
                                const d = await checkRes.json();
                                if (d.error) errorMsg = d.error;
                            } catch(e) {}
                            this.showToast(this.handleCommonError(errorMsg, 'err_remote_failed') + ': ' + targetUrl, 'error');
                        }
                    } catch (e) {
                        console.error('Check failed', e);
                        this.showToast(this.t('conn_error') + ': ' + targetUrl, 'error');
                    }
                }
                
                if (tasksStarted > 0) {
                    this.showToast(this.t('toast_dl_started'), 'success');
                    this.remoteUploadModal = false;
                    this.remoteUrl = '';
                }
            } finally {
                this.remoteIsSubmitting = false;
            }
        },

        async handleDrop(e) { 
            this.dragOver = false; 
            await this.handleDroppedData(e.dataTransfer); 
        },
        handleUploadModalSelect(e) { 
            this.uploadFiles(Array.from(e.target.files)); 
            e.target.value = ''; 
            this.uploadModal = false; 
        },
        async handleUploadModalDrop(e) { 
            this.uploadDragOver = false; 
            this.uploadModal = false; 
            await this.handleDroppedData(e.dataTransfer); 
        },
        async scanFiles(items) {
            const files = [];
            const scan = async (entry, path = '') => {
                if (entry.isFile) {
                    const file = await new Promise((resolve) => entry.file(resolve));
                    if (path) file.relativeDir = path.endsWith('/') ? path.slice(0, -1) : path;
                    files.push(file);
                } else if (entry.isDirectory) {
                    const reader = entry.createReader();
                    const entries = await new Promise((resolve) => {
                        let allEntries = [];
                        const read = () => {
                            reader.readEntries((results) => {
                                if (results.length) {
                                    allEntries = allEntries.concat(results);
                                    read();
                                } else {
                                    resolve(allEntries);
                                }
                            });
                        };
                        read();
                    });
                    for (const child of entries) {
                        await scan(child, path + entry.name + '/');
                    }
                }
            };

            for (const item of items) {
                if (item.webkitGetAsEntry) {
                    const entry = item.webkitGetAsEntry();
                    if (entry) await scan(entry);
                } else if (item.kind === 'file') {
                    files.push(item.getAsFile());
                }
            }
            return files;
        },
        async handleDroppedData(dataTransfer) {
            // Synchronously extract all values from dataTransfer before any async call
            // as the browser clears dataTransfer after the event loop turn finishes.
            const urlData = dataTransfer.getData('URL');
            const uriListData = dataTransfer.getData('text/uri-list');
            const htmlData = dataTransfer.getData('text/html');
            const dtFiles = dataTransfer.files ? Array.from(dataTransfer.files) : [];
            
            const entries = [];
            const directFiles = [];
            if (dataTransfer.items) {
                for (const item of dataTransfer.items) {
                    if (item.webkitGetAsEntry) {
                        const entry = item.webkitGetAsEntry();
                        if (entry) {
                            entries.push(entry);
                        }
                    } else if (item.kind === 'file') {
                        const file = item.getAsFile();
                        if (file) {
                            directFiles.push(file);
                        }
                    }
                }
            }

            let files = [];
            if (entries.length > 0) {
                const scan = async (entry, path = '') => {
                    if (entry.isFile) {
                        const file = await new Promise((resolve) => entry.file(resolve));
                        if (path) file.relativeDir = path.endsWith('/') ? path.slice(0, -1) : path;
                        files.push(file);
                    } else if (entry.isDirectory) {
                        const reader = entry.createReader();
                        const entriesList = await new Promise((resolve) => {
                            let allEntries = [];
                            const read = () => {
                                reader.readEntries((results) => {
                                    if (results.length) {
                                        allEntries = allEntries.concat(results);
                                        read();
                                    } else {
                                        resolve(allEntries);
                                    }
                                });
                            };
                            read();
                        });
                        for (const child of entriesList) {
                            await scan(child, path + entry.name + '/');
                        }
                    }
                };
                for (const entry of entries) {
                    await scan(entry);
                }
            } else if (directFiles.length > 0) {
                files = directFiles;
            } else if (dtFiles.length > 0) {
                files = dtFiles;
            }

            if (files.length === 0) {
                let imageUrl = '';
                
                // Parse text/html first to grab the actual <img> tag src (e.g. from Facebook CDN)
                if (htmlData) {
                    try {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(htmlData, 'text/html');
                        const img = doc.querySelector('img');
                        if (img && img.src) {
                            imageUrl = img.src;
                        }
                    } catch (e) {
                        console.error("Failed to parse dragged HTML data:", e);
                    }
                }
                
                // Fallback to URL data if no img tag found in HTML
                if (!imageUrl) {
                    imageUrl = urlData || uriListData;
                }

                if (imageUrl) {
                    if (imageUrl.startsWith('data:')) {
                        try {
                            const parts = imageUrl.split(',');
                            const mime = parts[0].match(/:(.*?);/)[1];
                            const bstr = atob(parts[1]);
                            let n = bstr.length;
                            const u8arr = new Uint8Array(n);
                            while (n--) {
                                u8arr[n] = bstr.charCodeAt(n);
                            }
                            const blob = new Blob([u8arr], { type: mime });
                            const ext = mime.split('/')[1] || 'png';
                            const filename = `dropped_image_${Date.now()}.${ext}`;
                            const file = new File([blob], filename, { type: mime });
                            files.push(file);
                            this.uploadFiles(files);
                        } catch (err) {
                            console.error("Failed to parse base64 dropped image:", err);
                        }
                    } else {
                        const isInternal = imageUrl.startsWith('/') || imageUrl.startsWith(window.location.origin);
                        
                        if (isInternal) {
                            try {
                                const res = await fetch(imageUrl);
                                if (res.ok) {
                                    const blob = await res.blob();
                                    const urlParts = imageUrl.split('/');
                                    let namePart = urlParts[urlParts.length - 1].split('?')[0];
                                    if (!namePart || !namePart.includes('.')) {
                                        const ext = blob.type.split('/')[1] || 'jpg';
                                        namePart = `dropped_image_${Date.now()}.${ext}`;
                                    }
                                    const file = new File([blob], namePart, { type: blob.type });
                                    files.push(file);
                                    this.uploadFiles(files);
                                    return;
                                }
                            } catch (err) {
                                console.log("Client fetch of internal URL failed:", err);
                            }
                        }

                        // For external URLs, bypass client-side fetch to prevent violating Content Security Policy (connect-src) 
                        // and CORS restrictions. Directly request server-side remote download.
                        this.showToast(this.t('remote_adding') || 'Đang yêu cầu máy chủ tải ảnh...', 'info');
                        try {
                            const taskId = 'remote_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
                            const displayName = imageUrl.split('/').pop().split('?')[0] || 'dropped_image.jpg';
                            
                            this.uploadQueue.push({
                                id: taskId,
                                name: 'URL: ' + displayName,
                                progress: 0,
                                statusText: this.t('preparing_upload') || 'Đang chuẩn bị...',
                                isCancelled: false,
                                hasError: false,
                                status: 'preparing',
                                size: 0,
                                singlePhase: true,
                                remoteUrl: imageUrl,
                                targetPath: this.currentPath,
                                overwrite: false
                            });

                            let fd = new FormData();
                            fd.append('url', imageUrl);
                            fd.append('path', this.currentPath);
                            fd.append('overwrite', 'false');
                            fd.append('task_id', taskId);

                            let res = await fetch('/api/remote-upload', {
                                method: 'POST',
                                body: fd,
                                headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() }
                            });

                            if (!res.ok) {
                                let d = await res.json();
                                this.uploadQueue = this.uploadQueue.filter(t => t.id !== taskId);
                                this.showToast(this.handleCommonError(d.error, 'status_error') + ': ' + imageUrl, 'error');
                            }
                        } catch (remoteErr) {
                            console.error("Server-side Remote Upload failed:", remoteErr);
                            this.showToast(this.t('remote_failed') || 'Tải ảnh qua máy chủ thất bại', 'error');
                        }
                    }
                }
            } else {
                this.uploadFiles(files);
            }
        },
        async uploadFiles(fileList) {
            if (!fileList || fileList.length === 0) return;
            if (fileList.length > 500) {
                this.showToast(this.t('err_max_files').replace('{n}', 500), 'error');
                return;
            }
            const newTasks = [];
            
            // Check for existing files
            const filenames = fileList.map(f => f.name).join('|');
            let existingFiles = [];
            try {
                const fd = new FormData();
                fd.append('path', this.currentPath);
                fd.append('filenames', filenames);
                const res = await fetch('/api/upload/check-exists', {
                    method: 'POST',
                    body: fd,
                    headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() }
                });
                if (res.ok) {
                    const data = await res.json();
                    existingFiles = data.existing || [];
                }
            } catch (e) { console.error("Collision check failed:", e); }

            let applyToAllAction = null;

            for (let i = 0; i < fileList.length; i++) {
                const file = fileList[i];
                let overwrite = false;

                if (existingFiles.includes(file.name)) {
                    let action = applyToAllAction;
                    if (!action) {
                        this.modal.applyToAll = false;
                        action = await this.showUIModal('collision', this.t('file_exists_title'), file.name);
                        if (!action) continue; // Cancelled
                        if (this.modal.applyToAll) applyToAllAction = action;
                    }

                    if (action === 'skip') continue;
                    if (action === 'overwrite') overwrite = true;
                    // rename is default (overwrite=false)
                }

                // Create a stable task ID based on file metadata to support resuming
                const generateHash = (str) => {
                    let hash = 0;
                    for (let j = 0; j < str.length; j++) {
                        hash = ((hash << 5) - hash) + str.charCodeAt(j);
                        hash |= 0;
                    }
                    return Math.abs(hash).toString(36);
                };
                const taskId = 'task_' + generateHash(file.name) + '_' + file.size + '_' + file.lastModified;
                
                // Check if a task with the same ID already exists in the queue
                const existingTaskIndex = this.uploadQueue.findIndex(t => t.id === taskId);
                if (existingTaskIndex !== -1) {
                    const existingTask = this.uploadQueue[existingTaskIndex];
                    // If it's already uploading and not cancelled/errored, don't add it again
                    if (existingTask.progress < 100 && !existingTask.isCancelled && !existingTask.hasError) {
                        continue;
                    }
                    // Otherwise, remove the old task (cancelled/errored/done) to avoid duplicate IDs in the UI
                    this.uploadQueue.splice(existingTaskIndex, 1);
                }

                const task = { 
                    id: taskId, 
                    name: file.name, 
                    progress: 0, 
                    statusText: this.t('waiting_slot'), 
                    isCancelled: false,
                    file: file,
                    overwrite: overwrite,
                    hasError: false,
                    status: 'waiting_slot',
                    targetPath: (function(app, f) {
                        let rel = f.relativeDir;
                        if (!rel && f.webkitRelativePath) {
                            const parts = f.webkitRelativePath.split('/');
                            if (parts.length > 1) rel = parts.slice(0, -1).join('/');
                        }
                        if (rel) {
                            return app.currentPath === '/' ? '/' + rel : app.currentPath + '/' + rel;
                        }
                        return app.currentPath;
                    })(this, file),
                    size: file.size,
                    speed: 0,
                    uploadedBytes: 0,
                    startTime: null,
                    lastUpdateTime: null,
                    lastUploadedBytes: 0
                };
                
                newTasks.push(task);
            }
            
            // Add all to queue at once for better performance
            this.uploadQueue.unshift(...newTasks);
            
            const CONCURRENCY = 3;
            const activeQueue = newTasks.filter(t => !t.hasError);

            const processQueue = async () => {
                while (activeQueue.length > 0) {
                    const task = activeQueue.shift();
                    if (task.isCancelled) continue;
                    
                    task.statusText = this.t('preparing_upload');
                    await this.uploadSingleFile(task.file, task.id, task.targetPath, task.overwrite);
                }
            };

            const workers = [];
            for (let i = 0; i < Math.min(CONCURRENCY, activeQueue.length); i++) {
                workers.push(processQueue());
            }
            await Promise.all(workers);
        },

        async retryUpload(taskId) {
            const task = this.uploadQueue.find(t => t.id === taskId);
            if (!task) return;
            
            task.progress = 0;
            task.statusText = this.t('preparing_upload');
            task.isCancelled = false;
            task.hasError = false;
            
            if (task.file) {
                // Retry local file upload
                await this.uploadSingleFile(task.file, taskId, task.targetPath, task.overwrite);
            } else if (task.remoteUrl) {
                // Retry remote URL upload
                let fd = new FormData();
                fd.append('url', task.remoteUrl);
                fd.append('path', task.targetPath);
                fd.append('overwrite', task.overwrite);
                fd.append('task_id', taskId);

                try {
                    let res = await fetch('/api/remote-upload', {
                        method: 'POST',
                        body: fd,
                        headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() }
                    });
                    if (!res.ok) {
                        let d = await res.json();
                        task.statusText = this.handleCommonError(d.error, 'status_error');
                        task.hasError = true;
                    }
                } catch (e) {
                    task.statusText = this.t('conn_error');
                    task.hasError = true;
                }
            } else if (task.ytdlpUrl) {
                // Retry YT-DLP upload
                let fd = new FormData();
                fd.append('url', task.ytdlpUrl);
                fd.append('path', task.targetPath);
                fd.append('download_type', 'video');
                fd.append('task_id', taskId);
                
                try {
                    let res = await fetch('/api/ytdlp/download', {
                        method: 'POST',
                        body: fd,
                        headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() }
                    });
                    if (!res.ok) {
                        let d = await res.json();
                        task.statusText = this.handleCommonError(d.error, 'status_error');
                        task.hasError = true;
                    }
                } catch (e) {
                    task.statusText = this.t('conn_error');
                    task.hasError = true;
                }
            }
        },

        async uploadSingleFile(file, taskId, targetPath, overwrite = false) {
            const CHUNK_SIZE = 50 * 1024 * 1024;
            const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
            let hasError = false;
            let task = this.uploadQueue.find(t => t.id === taskId);
            if (task) {
                task._progressMap = new Array(totalChunks).fill(0);
            }

            // Check if server already has some chunks for this task
            let existingChunks = [];
            try {
                const checkRes = await fetch(`/api/upload/check/${taskId}`);
                if (checkRes.ok) {
                    const checkData = await checkRes.json();
                    existingChunks = checkData.chunks || [];
                    if (task && existingChunks.length > 0) {
                        existingChunks.forEach(chunkIndex => {
                            const actualSize = (chunkIndex === totalChunks - 1) 
                                ? (file.size % CHUNK_SIZE || CHUNK_SIZE) 
                                : CHUNK_SIZE;
                            task._progressMap[chunkIndex] = actualSize;
                        });
                        const totalUploaded = task._progressMap.reduce((a, b) => a + b, 0);
                        task.uploadedBytes = Math.min(totalUploaded, file.size);
                        task.progress = Math.round((task.uploadedBytes / file.size) * 50);
                    }
                }
            } catch (e) {
                console.error("Resume check failed:", e);
            }

            task = this.uploadQueue.find(t => t.id === taskId);
            if (task) {
                task.startTime = Date.now();
                task.lastUpdateTime = task.startTime;
            }

            // Worker pool for parallel chunks
            const CHUNK_CONCURRENCY = 3;
            const chunkQueue = Array.from({ length: totalChunks }, (_, i) => i)
                                    .filter(i => !existingChunks.includes(i));
            
            if (chunkQueue.length === 0 && totalChunks > 0) {
                // All chunks already uploaded
                task = this.uploadQueue.find(t => t.id === taskId);
                if (task) {
                    task.progress = 50;
                    task.statusText = this.t('syncing_tg');
                }
                return;
            }
            
            const uploadWorker = async () => {
                while (chunkQueue.length > 0 && !hasError) {
                    const chunkIndex = chunkQueue.shift();
                    let task = this.uploadQueue.find(t => t.id === taskId);
                    if (!task || task.isCancelled) break;

                    const start = chunkIndex * CHUNK_SIZE;
                    const end = Math.min(start + CHUNK_SIZE, file.size);
                    const chunk = file.slice(start, end);
                    const fd = new FormData(); 
                    fd.append('file', chunk); 
                    fd.append('filename', file.name); 
                    fd.append('path', targetPath); 
                    fd.append('task_id', taskId); 
                    fd.append('chunk_index', chunkIndex); 
                    fd.append('total_chunks', totalChunks);
                    fd.append('total_size', file.size);
                    fd.append('chunk_size', CHUNK_SIZE);
                    fd.append('overwrite', overwrite);

                    let retries = 3;
                    let success = false;
                    while (retries > 0 && !success) {
                        task = this.uploadQueue.find(t => t.id === taskId);
                        if (task && task.isCancelled) return; // Exit if already cancelled

                        try {
                            if (task && !task.statusText.includes(this.t('status_error'))) {
                                const uploadedStr = this.formatBytes(task.uploadedBytes || 0);
                                const totalStr = this.formatBytes(file.size);
                                task.statusText = `${this.t('pushing', { uploaded: uploadedStr, total: totalStr })} ${retries < 3 ? '(' + this.t('retry') + ' ' + (3 - retries) + ')' : ''}`;
                            }


                            const result = await new Promise((resolve, reject) => {
                                const xhr = new XMLHttpRequest();
                                if (task) {
                                    if (!task._xhrs) task._xhrs = [];
                                    task._xhrs.push(xhr);
                                }

                                xhr.open('POST', '/api/upload');
                                xhr.setRequestHeader('X-CSRF-Token', TeleCloud.getCsrfToken());
                                
                                xhr.upload.onprogress = (e) => {
                                    if (e.lengthComputable) {
                                        const now = Date.now();
                                        const task = this.uploadQueue.find(t => t.id === taskId);
                                        if (task && task._progressMap) {
                                            task._progressMap[chunkIndex] = e.loaded;
                                            
                                            const totalUploaded = task._progressMap.reduce((a, b) => a + b, 0);
                                            task.uploadedBytes = Math.min(totalUploaded, file.size);
                                            
                                            if (task.lastUpdateTime && task.lastUpdateTime < now) {
                                                const elapsed = (now - task.lastUpdateTime) / 1000;
                                                const bytesSentSinceLast = totalUploaded - (task.lastUploadedBytes || 0);
                                                if (elapsed > 0.1) {
                                                    const instantSpeed = bytesSentSinceLast / elapsed;
                                                    if (task.speed === 0) task.speed = instantSpeed;
                                                    else task.speed = (task.speed * 0.8) + (instantSpeed * 0.2);
                                                    
                                                    task.lastUpdateTime = now;
                                                    task.lastUploadedBytes = totalUploaded;
                                                }
                                            } else {
                                                task.lastUpdateTime = now;
                                                task.lastUploadedBytes = totalUploaded;
                                            }

                                            const overallPercent = (task.uploadedBytes / file.size) * 50;
                                            task.progress = Math.min(50, Math.round(overallPercent));

                                            // Real-time byte progress in status text
                                            const uploadedStr = this.formatBytes(task.uploadedBytes);
                                            const totalStr = this.formatBytes(file.size);
                                            task.statusText = this.t('pushing', { uploaded: uploadedStr, total: totalStr });
                                        }
                                    }
                                };
                                xhr.onload = () => {
                                    const task = this.uploadQueue.find(t => t.id === taskId);
                                    if (task && task._xhrs) task._xhrs = task._xhrs.filter(x => x !== xhr);
                                    
                                    if (xhr.status >= 200 && xhr.status < 300) {
                                        // Mark chunk as fully completed in the map
                                        if (task && task._progressMap) {
                                            task._progressMap[chunkIndex] = chunk.size;
                                        }
                                        try { resolve(JSON.parse(xhr.responseText)); } catch(e) { reject(e); }
                                    } else {
                                        try {
                                            const err = JSON.parse(xhr.responseText);
                                            reject(new Error(err.error || `Upload failed (${xhr.status})`));
                                        } catch(e) {
                                            reject(new Error(`Upload failed (${xhr.status})`));
                                        }
                                    }
                                };
                                xhr.onerror = () => {
                                    const task = this.uploadQueue.find(t => t.id === taskId);
                                    if (task) {
                                        if (task._xhrs) task._xhrs = task._xhrs.filter(x => x !== xhr);
                                    }
                                    reject(new Error(this.t('conn_error')));
                                };
                                xhr.onabort = () => {
                                    const task = this.uploadQueue.find(t => t.id === taskId);
                                    if (task) {
                                        if (task._xhrs) task._xhrs = task._xhrs.filter(x => x !== xhr);
                                    }
                                    const msg = (task && task.isCancelled) ? this.t('cancelled') : this.t('conn_error');
                                    reject(new Error(msg));
                                };
                                xhr.send(fd);
                            });
                            
                            success = true;
                            if (task) {
                                const totalUploaded = task._progressMap.reduce((a, b) => a + b, 0);
                                task.uploadedBytes = Math.min(totalUploaded, file.size);
                                task.progress = Math.round((task.uploadedBytes / file.size) * 50);
                                if (result.status === "processing_telegram") {
                                    task.statusText = this.t('syncing_tg');
                                }
                            }
                        } catch (err) { 
                            retries--;
                            console.error(`Upload chunk ${chunkIndex} error (retries left: ${retries}):`, err);
                            if (retries === 0) {
                                let task = this.uploadQueue.find(t => t.id === taskId); 
                                if(task && !task.isCancelled) {
                                    task.statusText = this.t('conn_error');
                                    task.hasError = true;
                                }
                                hasError = true;
                            } else {
                                await new Promise(r => setTimeout(r, 2000)); // Wait before retry
                            }
                        }
                    }
                }
            };

            const workers = [];
            for (let i = 0; i < Math.min(CHUNK_CONCURRENCY, totalChunks); i++) {
                workers.push(uploadWorker());
            }
            await Promise.all(workers);

            // Fallback polling: if WS missed the `done`/`error` message (common when uploading
            // many files simultaneously and WS reconnects or browser is overloaded), poll the
            // task status API until we get a terminal state. Max 10 minutes.
            if (!hasError) {
                const POLL_INTERVAL = 3000;
                const POLL_TIMEOUT = 10 * 60 * 1000;
                const pollStart = Date.now();

                const pollTask = async () => {
                    while (Date.now() - pollStart < POLL_TIMEOUT) {
                        // Stop polling if WS already updated the task to a terminal state
                        const t = this.uploadQueue.find(q => q.id === taskId);
                        if (!t) return; // Task removed from queue
                        if (t.status === 'done' || t.isCancelled || t.hasError) return;

                        await new Promise(r => setTimeout(r, POLL_INTERVAL));

                        try {
                            const res = await fetch('/api/tasks');
                            if (!res.ok) continue;
                            const data = await res.json();
                            const serverTask = data.tasks && data.tasks[taskId];
                            const task = this.uploadQueue.find(q => q.id === taskId);
                            if (!task) return;

                            if (!serverTask) {
                                // Task no longer on server — may have been cleaned up after done
                                // Give WS a little more time before giving up
                                await new Promise(r => setTimeout(r, 2000));
                                const t2 = this.uploadQueue.find(q => q.id === taskId);
                                if (t2 && t2.status !== 'done' && !t2.hasError) {
                                    // Still not updated — assume done (task cleaned up = completed)
                                    task.progress = 100;
                                    task.status = 'done';
                                    task.statusText = this.t('done');
                                    task.hasError = false;
                                    this.fetchFiles(true);
                                    task.countdown = 5;
                                    const timer = setInterval(() => {
                                        task.countdown--;
                                        if (task.countdown <= 0) {
                                            clearInterval(timer);
                                            this.uploadQueue = this.uploadQueue.filter(q => q.id !== taskId);
                                        }
                                    }, 1000);
                                }
                                return;
                            }

                            if (serverTask.status === 'done') {
                                task.progress = 100;
                                task.status = 'done';
                                task.statusText = this.t('done');
                                task.hasError = false;
                                if (serverTask.file_id) task.fileId = serverTask.file_id;
                                this.fetchFiles(true);
                                task.countdown = 5;
                                const timer = setInterval(() => {
                                    task.countdown--;
                                    if (task.countdown <= 0) {
                                        clearInterval(timer);
                                        this.uploadQueue = this.uploadQueue.filter(q => q.id !== taskId);
                                    }
                                }, 1000);
                                return;
                            } else if (serverTask.status === 'error') {
                                const errorMsg = serverTask.message || '';
                                let displayError;
                                const colonIdx = errorMsg.indexOf(': ');
                                if (colonIdx > 0) {
                                    const keyPart = errorMsg.substring(0, colonIdx);
                                    const detailPart = errorMsg.substring(colonIdx + 2);
                                    const translatedKey = this.t(keyPart);
                                    displayError = (translatedKey !== keyPart) ? translatedKey + ' (' + detailPart + ')' : errorMsg;
                                } else {
                                    const translated = this.t(errorMsg);
                                    displayError = (translated !== errorMsg) ? translated : errorMsg;
                                }
                                task.statusText = this.t('status_error') + ': ' + displayError;
                                task.hasError = true;
                                task.status = 'error';
                                return;
                            } else if (serverTask.status === 'cancelled') {
                                task.statusText = this.t('cancelled');
                                task.isCancelled = true;
                                task.status = 'cancelled';
                                return;
                            }
                            // Still in progress — update progress display from server data
                            if (serverTask.status === 'telegram' && serverTask.percent !== undefined) {
                                task.progress = 50 + Math.round(serverTask.percent / 2);
                                task.statusText = this.t('telegram');
                            }
                        } catch (e) {
                            console.warn('[Poll] Task status check failed:', e);
                        }
                    }
                };

                pollTask();
            }
        },
        async toggleShare(file) {
            const targetFile = this.files.find(f => f.id === file.id);
            if (targetFile) {
                if (targetFile.share_token) {
                    const response = await fetch(`/api/files/${file.id}/share`, { method: 'DELETE', headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } });
                    if (response.ok) {
                        targetFile.share_token = null;
                        this.showToast(this.t('toast_revoked'), 'success');
                    } else {
                        const data = await response.json();
                        this.showToast(this.handleCommonError(data.error, 'status_error'), 'error');
                    }
                } else {
                    const password = await this.customPrompt(this.t('share_password_prompt'), "");
                    targetFile.share_token = 'loading...';
                    const fd = new FormData();
                    if (password) fd.append('password', password);
                    const response = await fetch(`/api/files/${file.id}/share`, { method: 'POST', body: fd, headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } });
                    if (response.ok) {
                        const data = await response.json();
                        targetFile.share_token = data.share_token;
                        targetFile.direct_token = data.direct_token; 
                        this.copyShareLink(targetFile, 'regular');
                    } else {
                        targetFile.share_token = null;
                        const data = await response.json();
                        this.showToast(this.handleCommonError(data.error, 'status_error'), 'error');
                    }
                }
            }
        },
        async copyShareLink(file, type = 'regular') {
            const link = type === 'direct' ? `${window.location.origin}/dl/${file.direct_token}` : `${window.location.origin}/s/${file.share_token}`;
            try {
                await TeleCloud.copyToClipboard(link);
                const label = type === 'direct' ? this.t('link_direct') : this.t('link_share');
                this.showToast(this.t('toast_copied', {t: label}));
            } catch (err) {
                console.error('Failed to copy link:', err);
            }
        },
        showToast(msg, type = 'success', duration = 3500) {
            if (this.toastTimeout) clearTimeout(this.toastTimeout);
            this.toastModal = { show: true, message: msg, type: type, persistent: duration === 0 };
            if (duration > 0) {
                this.toastTimeout = setTimeout(() => { this.toastModal.show = false; }, duration);
            }
        },
        async deleteFile(id) { 
            const confirmed = await this.customConfirm(this.t('delete_confirm_title'), this.t('delete_confirm_msg'), true); 
            if (!confirmed) return; 
            this.files = this.files.filter(f => f.id !== id);
            const response = await fetch(`/api/files/${id}`, { method: 'DELETE', headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } }); 
            if (response.ok) {
                this.fetchFiles(true);
                this.showToast(this.t('toast_deleted', {n: 1}), 'success'); 
            } else {
                const data = await response.json();
                this.showToast(this.handleCommonError(data.error, 'status_error'), 'error');
                this.fetchFiles(true);
            }
        },
        async renameFile(file) { 
            const newName = await this.customPrompt(this.t('rename_title'), file.filename); 
            if (!newName || newName === file.filename) return; 
            const targetFile = this.files.find(f => f.id === file.id);
            if(targetFile) targetFile.filename = newName;
            const fd = new FormData(); fd.append('new_name', newName); 
            const response = await fetch(`/api/files/${file.id}/rename`, { method: 'PUT', body: fd, headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } }); 
            if (response.ok) {
                this.fetchFiles(true); 
                this.showToast(this.t('toast_renamed')); 
            } else {
                const data = await response.json();
                this.showToast(this.handleCommonError(data.error, 'status_error'), 'error');
                this.fetchFiles(true);
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
            
            // Set loading = true; the DOM img's @load/@error events will clear it
            this.comicViewer.pageLoading = true;
        },
        nextComicPage() {
            if (this.comicViewer.currentPageIndex < this.comicViewer.pages.length - 1) {
                this.comicViewer.currentPageIndex++;
                this.loadComicPage();
                this.preloadNextComicPage();
                this.saveComicProgress();
            }
        },
        prevComicPage() {
            if (this.comicViewer.currentPageIndex > 0) {
                this.comicViewer.currentPageIndex--;
                this.loadComicPage();
                this.saveComicProgress();
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
            // 1. Kill rAF immediately without triggering Alpine reactivity
            if (window._comicAutoScrollRaf) {
                cancelAnimationFrame(window._comicAutoScrollRaf);
                window._comicAutoScrollRaf = null;
            }
            if (window._comicIntersectionObserver) {
                window._comicIntersectionObserver.disconnect();
                window._comicIntersectionObserver = null;
            }
            // 2. Hide immediately to trigger the Alpine.js leaving transition
            this.comicViewer.show = false;
            this.comicViewer.autoScrollActive = false;
            // 3. Snapshot the closing file identity and blob URLs for later cleanup
            const closingFile = this.comicViewer.file;
            const urls = this.comicViewer.pageUrls ? [...this.comicViewer.pageUrls] : [];
            // 4. Defer nuke and state reset to let transition complete cleanly.
            //    Guard: only clear state if the viewer has NOT been reopened for another file
            //    during the 400ms window (prevents the deferred null from blanking a fresh open).
            setTimeout(() => {
                if (this.comicViewer.show) return; // viewer was reopened — leave state alone
                if (this.comicViewer.file && closingFile &&
                    (String(this.comicViewer.file.id) !== String(closingFile.id) ||
                     this.comicViewer.file.filename !== closingFile.filename)) return; // different file opened
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
                this._saveEpubScroll();
                this.epubViewer.currentChapter++;
                this._loadEpubChapter(this.epubViewer.file, false);
            }
        },
        prevEpubChapter(startAtBottom = false) {
            if (this.epubViewer.currentChapter > 0) {
                this._saveEpubScroll();
                this.epubViewer.currentChapter--;
                this._loadEpubChapter(this.epubViewer.file, startAtBottom);
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
                this._loadEpubChapter(this.epubViewer.file, false);
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
            const bg = isDark ? '#1e293b' : '#ffffff';
            const fg = isDark ? '#f1f5f9' : '#0f172a';
            
            let style = doc.getElementById('tc-epub-theme');
            if (!style) {
                style = doc.createElement('style');
                style.id = 'tc-epub-theme';
                doc.head.appendChild(style);
            }
            style.textContent = `
                body { background: ${bg} !important; color: ${fg} !important; font-size: ${this.epubViewer.fontSize}% !important; line-height: 1.6 !important; padding: 20px !important; max-width: 800px !important; margin: 0 auto !important; font-family: Inter, system-ui, -apple-system, sans-serif !important; }
                p, span, div, li, td, th, h1, h2, h3, h4, h5, h6 { color: ${fg} !important; }
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
                    background: ${isDark ? '#475569' : '#cbd5e1'};
                    border-radius: 4px;
                }
                ::-webkit-scrollbar-thumb:hover {
                    background: ${isDark ? '#64748b' : '#94a3b8'};
                }
            `;
        },
        changeEpubFontSize(delta) {
            this.epubViewer.fontSize = Math.max(50, Math.min(250, this.epubViewer.fontSize + delta));
            this.applyEpubTheme();
        },
        nextEpubPage() { this.nextEpubChapter(); },
        prevEpubPage() { this.prevEpubChapter(); },
        closeEpubViewer() {
            // 1. Kill rAF immediately without triggering Alpine reactivity
            if (window._epubAutoScrollRaf) {
                cancelAnimationFrame(window._epubAutoScrollRaf);
                window._epubAutoScrollRaf = null;
            }
            // 2. Cancel any pending chapter transition timeouts
            this._transitioningChapter = false;
            // 3. Save scroll position while iframe is still alive
            try { this._saveEpubScroll(); } catch(e) {}
            // 4. Hide immediately to trigger the Alpine.js leaving transition
            this.epubViewer.show = false;
            this.epubViewer.autoScrollActive = false;
            // 5. Defer nuke and state reset to let transition complete cleanly
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
            this.pdfViewer.show = true;
            this.pdfViewer.file = file;
            this.pdfViewer.loading = true;
            this.pdfViewer.pageLoading = true;
            this.pdfViewer.sidebarOpen = false;
            this.pdfViewer.zoom = 'width';
            this.pdfViewer.pageProgress = 0;
            this.pdfViewer.currentPage = 1;
            this.pdfViewer.numPages = 0;
            this.pdfViewer.settingsOpen = false;
            this.pdfViewer.toc = [];
            this.pdfViewer.autoScrollActive = false;
            this.pdfViewer.autoScrollSpeed = 2;
            
            const isDarkGlobal = document.documentElement.classList.contains('dark');
            this.pdfViewer.darkModeFilter = isDarkGlobal;

            const token = this.shareToken || this.token || shareToken || '';
            const hasShareToken = !!token;
            
            let downloadUrl;
            if (hasShareToken) {
                if (file && file.id) {
                    downloadUrl = `/s/${token}/file/${file.id}/stream`;
                } else {
                    downloadUrl = `/s/${token}/stream`;
                }
            } else {
                downloadUrl = `/download/${file.id}`;
            }

            if (window._pdfLoadingTask) {
                try { window._pdfLoadingTask.destroy(); } catch(e) {}
                window._pdfLoadingTask = null;
            }
            if (window._pdfRenderTask) {
                try { window._pdfRenderTask.cancel(); } catch(e) {}
                window._pdfRenderTask = null;
            }
            window._pdfDoc = null;

            if (window._pdfResizeHandler) {
                window.removeEventListener('resize', window._pdfResizeHandler);
            }
            window._pdfResizeHandler = () => {
                if (this.pdfViewer.show && (this.pdfViewer.zoom === 'width' || this.pdfViewer.zoom === 'height')) {
                    if (window._pdfResizeTimeout) clearTimeout(window._pdfResizeTimeout);
                    window._pdfResizeTimeout = setTimeout(() => {
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
                    }, 150);
                }
            };
            window.addEventListener('resize', window._pdfResizeHandler);

            this.$nextTick(async () => {
                try {
                    const loadingTask = pdfjsLib.getDocument({ url: downloadUrl, withCredentials: true });
                    window._pdfLoadingTask = loadingTask;
                    
                    const pdfDoc = await loadingTask.promise;
                    if (!this.pdfViewer.show || !this.pdfViewer.file || String(this.pdfViewer.file.id || '') !== String(file.id || '') || this.pdfViewer.file.filename !== file.filename) {
                        return;
                    }
                    
                    window._pdfDoc = pdfDoc;
                    this.pdfViewer.numPages = pdfDoc.numPages;
                    this.pdfViewer.loading = false;

                    try {
                        const outline = await pdfDoc.getOutline();
                        if (outline && outline.length > 0) {
                            const resolveOutline = async (items) => {
                                const result = [];
                                for (const item of items) {
                                    let pageNumber = null;
                                    if (item.dest) {
                                        try {
                                            let dest = item.dest;
                                            if (typeof dest === 'string') {
                                                dest = await pdfDoc.getDestination(dest);
                                            }
                                            if (dest && Array.isArray(dest)) {
                                                const pageRef = dest[0];
                                                const pageIndex = await pdfDoc.getPageIndex(pageRef);
                                                pageNumber = pageIndex + 1;
                                            }
                                        } catch (e) {
                                            console.error("Outline dest resolution error:", e);
                                        }
                                    }
                                    const node = { title: item.title, page: pageNumber };
                                    if (item.items && item.items.length > 0) {
                                        node.children = await resolveOutline(item.items);
                                    }
                                    result.push(node);
                                }
                                return result;
                            };
                            const resolved = await resolveOutline(outline);
                            const flatten = (nodes, depth = 0) => {
                                let list = [];
                                nodes.forEach(n => {
                                    list.push({ title: n.title, page: n.page, depth });
                                    if (n.children) {
                                        list = list.concat(flatten(n.children, depth + 1));
                                    }
                                });
                                return list;
                            };
                            this.pdfViewer.toc = flatten(resolved);
                        }
                    } catch (e) {
                        console.error("Failed to parse outline:", e);
                    }

                    let startPage = 1;
                    if (file && file.id) {
                        const saved = localStorage.getItem(`pdf-page-${file.id}`);
                        if (saved) {
                            const p = parseInt(saved);
                            if (p >= 1 && p <= pdfDoc.numPages) {
                                startPage = p;
                            }
                        }
                        const savedMode = localStorage.getItem(`pdf-scroll-mode-${file.id}`);
                        if (savedMode) {
                            this.pdfViewer.scrollMode = savedMode;
                        } else {
                            this.pdfViewer.scrollMode = 'page';
                        }
                    } else {
                        this.pdfViewer.scrollMode = 'page';
                    }
                    this.pdfViewer.currentPage = startPage;
                    this.pdfViewer.pageProgress = Math.round((startPage / pdfDoc.numPages) * 100);
                    if (this.pdfViewer.scrollMode === 'continuous') {
                        this.$nextTick(() => {
                            setTimeout(() => {
                                const container = document.getElementById('pdf-continuous-container') || 
                                                  document.getElementById('share-pdf-continuous-container') || 
                                                  document.getElementById('share-folder-pdf-continuous-container');
                                if (container) {
                                    const wrapper = container.querySelector(`.pdf-page-wrapper[data-page="${startPage}"]`);
                                    if (wrapper) {
                                        wrapper.scrollIntoView({ behavior: 'auto', block: 'start' });
                                    }
                                }
                            }, 300);
                        });
                    } else {
                        this.renderPdfPage(startPage);
                    }

                } catch (err) {
                    console.error("PDF.js initialization failed:", err);
                    this.showToast(this.t('err_loading_pdf'), 'error');
                    this.pdfViewer.show = false;
                    this.pdfViewer.loading = false;
                    this.pdfViewer.pageLoading = false;
                }
            });
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
        pdfNextPage() {
            if (this.pdfViewer.currentPage < this.pdfViewer.numPages) {
                this.renderPdfPage(this.pdfViewer.currentPage + 1);
                this.$nextTick(() => {
                    const area = document.getElementById('pdf-viewer-area');
                    if (area) area.scrollTop = 0;
                });
            }
        },
        pdfPrevPage() {
            if (this.pdfViewer.currentPage > 1) {
                this.renderPdfPage(this.pdfViewer.currentPage - 1);
                this.$nextTick(() => {
                    const area = document.getElementById('pdf-viewer-area');
                    if (area) area.scrollTop = 0;
                });
            }
        },
        pdfJumpToPage(page) {
            const p = parseInt(page);
            if (p >= 1 && p <= this.pdfViewer.numPages) {
                this.renderPdfPage(p);
                this.$nextTick(() => {
                    const area = document.getElementById('pdf-viewer-area');
                    if (area) area.scrollTop = 0;
                });
            }
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
        async showFileInfo(file) {
            if (file.is_folder) return;
            const typeData = this.getFileTypeData(file.filename);
            const ext = file.filename.split('.').pop().toLowerCase();
            const imgExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'heic', 'heif'];
            const videoExts = ['mp4', 'webm', 'ogg', 'mov', 'mkv', 'ogv', '3gp', 'flv', 'wmv'];
            const audioExts = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'opus', 'oga', 'aac', 'm4b'];
            const textExts = ['txt', 'md', 'log', 'json', 'js', 'py', 'go', 'html', 'css', 'yml', 'yaml', 'sql', 'sh', 'conf', 'ini', 'c', 'cpp', 'h', 'hpp', 'cs', 'java', 'rb', 'rs', 'swift'];
            const isComicOrEpubOrPdf = (typeData.n === 'type_comic' || typeData.n === 'type_epub' || typeData.n === 'type_pdf');
            const isTooLarge = (imgExts.includes(ext) && file.size > 50 * 1024 * 1024) || 
                               (isComicOrEpubOrPdf && file.size > 150 * 1024 * 1024) || 
                               (textExts.includes(ext) && file.size > 10 * 1024 * 1024);
            
            const langMap = {
                'js': 'javascript', 'json': 'json', 'py': 'python', 'go': 'go', 
                'html': 'markup', 'css': 'css', 'yml': 'yaml', 'yaml': 'yaml',
                'sql': 'sql', 'sh': 'bash', 'md': 'markdown', 'c': 'clike', 'cpp': 'clike',
                'h': 'clike', 'hpp': 'clike', 'cs': 'clike', 'java': 'java', 'rb': 'ruby',
                'rs': 'rust', 'swift': 'swift'
            };

            const mimeTypes = { 
                'mp4': 'video/mp4', 'webm': 'video/webm', 'ogg': 'video/ogg', 'ogv': 'video/ogg',
                'mov': 'video/mp4', 'mkv': 'video/webm', 'mp3': 'audio/mpeg', 'wav': 'audio/wav', 
                'flac': 'audio/flac', 'm4a': 'audio/mp4', 'opus': 'audio/ogg', 'oga': 'audio/ogg',
                'aac': 'audio/aac', 'm4b': 'audio/mp4'
            };
            let isMedia = false; let mediaHtml = ''; let playerTarget = null;
            let isLarge = false;
            const streamUrl = `/api/files/${file.id}/stream`;
            const thumbUrl = `/api/files/${file.id}/thumb`;
            
            mediaHtml = TeleCloud.getMediaHtml(file);
            if (mediaHtml) {
                isMedia = true;
                isLarge = true; // Make media modals larger by default
                if ((videoExts.includes(ext) || audioExts.includes(ext)) && !(TeleCloud.isAppleDevice() && ext === 'mkv')) {
                    playerTarget = { el: '#index-tele-player', type: videoExts.includes(ext) ? 'video' : 'audio' };
                }
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
            if (playerTarget) {
                setTimeout(() => {
                    if (this.playerInstance) this.playerInstance.destroy();
                    const accentColor = getComputedStyle(document.body).getPropertyValue('--accent-color').trim() || '#3b82f6';
                    
                    if (playerTarget.type === 'audio') {
                        const plyrOpts = { controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'settings'], settings: ['speed'], speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] } };
                        this.playerInstance = new Plyr(playerTarget.el, plyrOpts);
                    } else {
                        const matchedSubs = findSubtitlesForVideo(file.filename, this.files || [], false, '');
                        this.playerInstance = new Artplayer({
                            logger: false,
                            container: playerTarget.el,
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
                            autoPlayback: true,
                            airplay: true,
                            type: file.filename.split('.').pop().toLowerCase() === 'mkv' ? 'mp4' : file.filename.split('.').pop().toLowerCase(),
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
                                buildArtplayerSubtitleSetting(file.filename, this.files || [], false, '', (k) => this.t(k))
                            ],
                            icons: {
                                loading: '<i class="fa-solid fa-spinner fa-spin text-4xl"></i>',
                                state: '<i class="fa-solid fa-play text-4xl"></i>',
                            }
                        });
                        this.playerInstance.on('error', (error, reconnectTime) => {
                            const ua = navigator.userAgent;
                            const isApple = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Safari") && !ua.includes("Chrome") && !ua.includes("Edg"));
                            if (isApple) {
                                Alpine.store('app').showToast(this.t('err_video_unsupported_apple'), "error");
                            }
                        });
                        this.playerInstance.on('fullscreen', (state) => document.body.classList.toggle('art-fullscreen-active', state));
                        this.playerInstance.on('fullscreenWeb', (state) => document.body.classList.toggle('art-fullscreen-active', state));
                    }
                }, 50);
            }
        },
        async loadFilePreview() {
            this.fileInfoModal.needsLoad = false;
            const file = this.fileInfoModal.file;
            const ext = file.filename.split('.').pop().toLowerCase();
            const streamUrl = `/api/files/${file.id}/stream`;
            const langMap = { 'js': 'javascript', 'json': 'json', 'py': 'python', 'go': 'go', 'html': 'markup', 'css': 'css', 'yml': 'yaml', 'yaml': 'yaml', 'sql': 'sql', 'sh': 'bash', 'md': 'markdown' };

            this.fileInfoModal.isPreviewLoading = true;
            this.fileInfoModal.isMedia = false;

            try {
                const response = await fetch(streamUrl, { headers: { 'Range': 'bytes=0-262144' } });
                if (!response.ok && response.status !== 206) throw new Error("Failed to fetch");
                const content = await response.text();
                
                let mediaHtml = '';
                if (ext === 'md') {
                    mediaHtml = `<div class="text-preview-container markdown-preview">${this.parseMarkdown(content)}</div>`;
                } else {
                    const lang = langMap[ext] || 'none';
                    mediaHtml = `<div class="text-preview-container"><pre><code class="language-${lang}">${content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre></div>`;
                }
                this.fileInfoModal.mediaHtml = mediaHtml;
                this.fileInfoModal.isMedia = true;
                
                if (ext !== 'md' && window.Prism) {
                    setTimeout(() => Prism.highlightAllUnder(document.querySelector('.text-preview-container')), 50);
                }
            } catch (e) {
                console.error("Preview failed", e);
                this.fileInfoModal.mediaHtml = `<div class="p-4 text-center text-red-500 text-sm">${this.t('preview_error')}</div>`;
                this.fileInfoModal.isMedia = true;
            } finally {
                this.fileInfoModal.isPreviewLoading = false;
            }
        },

        async fetchPasskeys() {
            try {
                const resp = await fetch('/api/passkeys');
                this.passkeys = (await resp.json()) || [];
            } catch (err) {
                console.error('Failed to fetch passkeys', err);
                this.passkeys = [];
            }
        },

        async registerPasskey() {
            if (!this.webauthnRPID) {
                this.showToast(this.t('err_passkey_not_configured'), 'error');
                if (this.isAdmin) this.currentTab = 'settings';
                return;
            }
            if (!window.PublicKeyCredential) {
                this.showToast(this.t('passkey_not_supported'), 'error');
                return;
            }

            const name = await this.customPrompt(this.t('passkey_name_prompt'), "My Passkey");
            if (!name) return;

            try {
                const beginResp = await fetch('/api/passkey/register/begin');
                const options = await beginResp.json();
                
                if (options.error) throw new Error(options.error);

                // Prepare options
                const bufferToBase64 = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
                const base64ToBuffer = (base64) => {
                    const binary = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
                    const buffer = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
                    return buffer.buffer;
                };

                options.publicKey.challenge = base64ToBuffer(options.publicKey.challenge);
                options.publicKey.user.id = base64ToBuffer(options.publicKey.user.id);
                if (options.publicKey.excludeCredentials) {
                    options.publicKey.excludeCredentials.forEach(c => c.id = base64ToBuffer(c.id));
                }

                const credential = await navigator.credentials.create(options);
                
                const finishResp = await fetch('/api/passkey/register/finish?name=' + encodeURIComponent(name), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': TeleCloud.getCsrfToken() },
                    body: JSON.stringify({
                        id: credential.id,
                        rawId: bufferToBase64(credential.rawId),
                        type: credential.type,
                        response: {
                            attestationObject: bufferToBase64(credential.response.attestationObject),
                            clientDataJSON: bufferToBase64(credential.response.clientDataJSON),
                            transports: credential.response.getTransports ? credential.response.getTransports() : []
                        }
                    })
                });

                const result = await finishResp.json();
                if (result.status === 'success') {
                    this.showToast(this.t('passkey_registered'), 'success');
                    this.fetchPasskeys();
                } else {
                    throw new Error(result.error || this.t('err_passkey_reg_failed'));
                }
            } catch (err) {
                if (err.name === 'AbortError' || err.name === 'NotAllowedError') return;
                console.error(err);
                this.showToast(this.t('passkey_error') + ': ' + err.message, 'error');
            }
        },

        async deletePasskey(id) {
            const ok = await this.customConfirm(this.t('delete_confirm_title'), this.t('delete_confirm_msg'), true);
            if (!ok) return;

            try {
                const resp = await fetch('/api/passkeys/' + id, {
                    method: 'DELETE',
                    headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() }
                });
                const result = await resp.json();
                if (result.status === 'success') {
                    this.showToast(this.t('passkey_deleted'), 'success');
                    this.fetchPasskeys();
                } else {
                    throw new Error(result.error);
                }
            } catch (err) {
                this.showToast(this.t('passkey_error'), 'error');
            }
        },

        async renamePasskey(id, currentName) {
            const newName = await this.customPrompt(this.t('passkey_name_prompt'), currentName || "");
            if (!newName || newName === currentName) return;

            try {
                const fd = new FormData();
                fd.append('name', newName);
                const resp = await fetch(`/api/passkeys/${id}/rename`, {
                    method: 'POST',
                    headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() },
                    body: fd
                });
                const result = await resp.json();
                if (result.status === 'success') {
                    this.showToast(this.t('passkey_renamed'), 'success');
                    this.fetchPasskeys();
                } else {
                    throw new Error(result.error);
                }
            } catch (err) {
                this.showToast(this.t('passkey_error'), 'error');
            }
        },
        async fetchYTDLPStatus() {
            try {
                const res = await fetch('/api/ytdlp/status');
                if (res.ok) {
                    const data = await res.json();
                    this.ytdlpEnabled = data.enabled;
                }
            } catch (e) { console.error('Failed to fetch ytdlp status', e); }
        },
        async fetchTorrentStatus() {
            try {
                const res = await fetch('/api/torrent/status');
                if (res.ok) {
                    const data = await res.json();
                    this.torrentEnabled = data.enabled;
                }
            } catch (e) { console.error('Failed to fetch torrent status', e); }
        },
        async submitTorrentAdd() {
            if (!this.torrentInput) return;
            this.torrentLoading = true;
            let fd = new FormData();
            fd.append('input', this.torrentInput);
            fd.append('path', this.currentPath);
            try {
                const res = await fetch('/api/torrent/add', { 
                    method: 'POST', 
                    body: fd, 
                    headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } 
                });
                const d = await res.json();
                if (res.ok) {
                    this.showToast(this.t('torrent_started'), 'success');
                    this.torrentInput = '';
                    this.isQueueMinimized = false;
                    this.fetchActiveTasks();
                } else {
                    this.showToast(this.handleCommonError(d.error, 'status_error'), 'error');
                }
            } catch (e) {
                this.showToast(this.t('conn_error'), 'error');
            } finally {
                this.torrentLoading = false;
            }
        },
        async uploadTorrentFile(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            this.torrentLoading = true;
            let fd = new FormData();
            fd.append('file', file);
            fd.append('path', this.currentPath);
            
            try {
                const res = await fetch('/api/torrent/upload', {
                    method: 'POST',
                    body: fd,
                    headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() }
                });
                const d = await res.json();
                if (res.ok) {
                    this.showToast(this.t('torrent_started'), 'success');
                    this.isQueueMinimized = false;
                    this.fetchActiveTasks();
                } else {
                    this.showToast(this.handleCommonError(d.error, 'status_error'), 'error');
                }
            } catch (e) {
                this.showToast(this.t('conn_error'), 'error');
            } finally {
                this.torrentLoading = false;
                e.target.value = '';
            }
        },
        async checkYTDLPCookies() {
            try {
                const res = await fetch('/api/ytdlp/cookies/status');
                const d = await res.json();
                this.ytdlpHasCookie = d.has_cookie;
            } catch (e) {
                console.error('Failed to check cookies:', e);
            }
        },
        async uploadYTDLPCookies(e) {
            const file = e.target.files[0];
            if (!file) return;

            let fd = new FormData();
            fd.append('cookie_file', file);
            try {
                const res = await fetch('/api/ytdlp/cookies', { 
                    method: 'POST', 
                    body: fd, 
                    headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } 
                });
                if (res.ok) {
                    this.ytdlpHasCookie = true;
                    this.showToast(this.t('toast_success'), 'success');
                } else {
                    const d = await res.json();
                    this.showToast(this.handleCommonError(d.error, 'upload_failed'), 'error');
                }
            } catch (e) {
                this.showToast(this.t('conn_error'), 'error');
            } finally {
                e.target.value = ''; // Reset input
            }
        },
        async removeYTDLPCookies() {
            try {
                const res = await fetch('/api/ytdlp/cookies', { 
                    method: 'DELETE', 
                    headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } 
                });
                if (res.ok) {
                    this.ytdlpHasCookie = false;
                    this.showToast(this.t('toast_success'), 'success');
                } else {
                    this.showToast(this.t('status_error'), 'error');
                }
            } catch (e) {
                this.showToast(this.t('conn_error'), 'error');
            }
        },
        async fetchYTDLPFormats() {
            if (!this.ytdlpUrl) return;
            
            // Basic URL validation
            try {
                new URL(this.ytdlpUrl);
            } catch (e) {
                this.showToast(this.t('invalid_url'), 'error');
                return;
            }

            this.ytdlpLoading = true;
            this.ytdlpInfo = null;
            let fd = new FormData();
            fd.append('url', this.ytdlpUrl);
            try {
                const res = await fetch('/api/ytdlp/formats', { method: 'POST', body: fd, headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } });
                const d = await res.json();
                if (res.ok) {
                    this.ytdlpInfo = d;
                    if (this.ytdlpInfo.formats && this.ytdlpInfo.formats.length > 0) {
                        this.ytdlpSelectedFormat = ''; // Default to best
                    }
                } else {
                    let errorMsg = d.error || 'ytdlp_error';
                    // Simplify complex yt-dlp error messages for the user
                    if (errorMsg.includes('Unsupported URL')) errorMsg = 'err_unsupported_url';
                    else if (errorMsg.includes('Unable to download webpage')) errorMsg = 'err_network_error';
                    else if (errorMsg.includes('Video unavailable')) errorMsg = 'err_video_unavailable';
                    
                    this.showToast(this.handleCommonError(errorMsg, 'ytdlp_error'), 'error');
                }
            } catch (e) {
                this.showToast(this.t('conn_error'), 'error');
            } finally {
                this.ytdlpLoading = false;
            }
        },
        async submitYTDLPDownload() {
            if (!this.ytdlpUrl) return;
            let fd = new FormData();
            fd.append('url', this.ytdlpUrl);
            fd.append('format_id', this.ytdlpSelectedFormat);
            fd.append('download_type', this.ytdlpDownloadType);
            fd.append('path', this.currentPath);
            try {
                const res = await fetch('/api/ytdlp/download', { method: 'POST', body: fd, headers: { 'X-CSRF-Token': TeleCloud.getCsrfToken() } });
                if (res.ok) {
                    const data = await res.json();
                    if (!this.uploadQueue.some(t => t.id === data.task_id)) {
                        this.uploadQueue.push({
                            id: data.task_id,
                            name: this.ytdlpInfo ? this.ytdlpInfo.title : 'Media Download',
                        progress: 0,
                        statusText: this.t('initiating_ytdlp'),
                        hasError: false,
                        isCancelled: false,
                        status: 'preparing',
                        size: 0,
                        startTime: Date.now(),
                        uploadedBytes: 0,
                        speed: 0
                        });
                    } else {
                        // If task already created via WebSocket, just update its name
                        let t = this.uploadQueue.find(t => t.id === data.task_id);
                        if (t && this.ytdlpInfo) t.name = this.ytdlpInfo.title;
                    }
                    this.showToast(this.t('ytdlp_started'), 'success');
                    this.ytdlpUrl = '';
                    this.ytdlpInfo = null;
                } else {
                    const d = await res.json();
                    this.showToast(this.handleCommonError(d.error, 'ytdlp_error'), 'error');
                }
            } catch (e) {
                this.showToast(this.t('conn_error'), 'error');
            }
        }
    }
}

function shareApp() {
    return {
        shareToken: '',
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
        get filteredFiles() {
            let results = [...this.files];
            if (this.searchQuery.trim() !== '') {
                const query = this.searchQuery.toLowerCase();
                results = results.filter(f => f.filename.toLowerCase().includes(query));
            }

            return results.sort((a, b) => {
                if (a.is_folder && !b.is_folder) return -1;
                if (!a.is_folder && b.is_folder) return 1;

                let valA, valB;
                if (this.sortBy === 'name') {
                    valA = a.filename.toLowerCase();
                    valB = b.filename.toLowerCase();
                } else if (this.sortBy === 'date') {
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
            return Math.ceil(this.filteredFiles.length / this.itemsPerPage) || 1;
        },
        get displayedFiles() {
            const start = (this.currentPage - 1) * this.itemsPerPage;
            const end = start + this.itemsPerPage;
            return this.filteredFiles.slice(start, end);
        },
        currentPath: '/', 
        openMenuId: null,
        selectedIds: [], 

        plyrInstance: null,
        imageViewer: { show: false, src: '', filename: '' },
        lightboxLoading: false,
        comicViewer: { show: false, file: null, pages: [], pageUrls: [], currentPageIndex: 0, loading: false, fitMode: 'height', pageLoading: false, scrollMode: 'page', autoScrollActive: false, autoScrollSpeed: 2, settingsOpen: false },
        epubViewer: { show: false, file: null, loading: false, sidebarOpen: false, toc: [], fontSize: 100, pageProgress: 0, scrollMode: 'scrolled', autoScrollActive: false, autoScrollSpeed: 2, settingsOpen: false, spine: [], resourceBaseUrl: '', currentChapter: 0, title: '' },
        pdfViewer: { show: false, file: null, loading: false, sidebarOpen: false, toc: [], zoom: 100, pageProgress: 0, settingsOpen: false, currentPage: 1, numPages: 0, darkModeFilter: false, pageLoading: false, autoScrollActive: false, autoScrollSpeed: 2, scrollMode: 'page' },
        fileInfoModal: { show: false, file: null, typeName: '', ext: '', svgIcon: '', bgColor: '', isMedia: false, mediaHtml: '', isLarge: false, isPreviewLoading: false, needsLoad: false, tooLarge: false, bypassWarning: false, unsupportedMedia: false },
        contextMenu: { show: false, x: 0, y: 0, file: null },
        
        init() { 
            this.shareToken = this.$refs.token ? this.$refs.token.textContent.trim() : '';
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

            this.fetchFiles(false);
        },
        openContextMenu(e, file) {
            if (!file) return; 
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
            if (this.comicViewer.currentPageIndex < this.comicViewer.pages.length - 1) {
                this.comicViewer.currentPageIndex++;
                this.loadComicPage();
                this.preloadNextComicPage();
                this.saveComicProgress();
            }
        },
        prevComicPage() {
            if (this.comicViewer.currentPageIndex > 0) {
                this.comicViewer.currentPageIndex--;
                this.loadComicPage();
                this.saveComicProgress();
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
                        
                        this._loadEpubChapter(file);
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
        _loadEpubChapter(file, startAtBottom = false) {
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
                    const savedScroll = file.id ? localStorage.getItem(`epub-scroll-${file.id}`) : null;
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
                this._saveEpubScroll();
                this.epubViewer.currentChapter++;
                this._loadEpubChapter(this.epubViewer.file, false);
            }
        },
        prevEpubChapter(startAtBottom = false) {
            if (this.epubViewer.currentChapter > 0) {
                this._saveEpubScroll();
                this.epubViewer.currentChapter--;
                this._loadEpubChapter(this.epubViewer.file, startAtBottom);
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
                this._loadEpubChapter(this.epubViewer.file, false);
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
            const bg = isDark ? '#1e293b' : '#ffffff';
            const fg = isDark ? '#f1f5f9' : '#0f172a';
            
            let style = doc.getElementById('tc-epub-theme');
            if (!style) {
                style = doc.createElement('style');
                style.id = 'tc-epub-theme';
                doc.head.appendChild(style);
            }
            style.textContent = `
                body { background: ${bg} !important; color: ${fg} !important; font-size: ${this.epubViewer.fontSize}% !important; line-height: 1.6 !important; padding: 20px !important; max-width: 800px !important; margin: 0 auto !important; font-family: Inter, system-ui, -apple-system, sans-serif !important; }
                p, span, div, li, td, th, h1, h2, h3, h4, h5, h6 { color: ${fg} !important; }
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
                    background: ${isDark ? '#475569' : '#cbd5e1'};
                    border-radius: 4px;
                }
                ::-webkit-scrollbar-thumb:hover {
                    background: ${isDark ? '#64748b' : '#94a3b8'};
                }
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
            this.pdfViewer.show = true;
            this.pdfViewer.file = file;
            this.pdfViewer.loading = true;
            this.pdfViewer.pageLoading = true;
            this.pdfViewer.sidebarOpen = false;
            this.pdfViewer.zoom = 'width';
            this.pdfViewer.pageProgress = 0;
            this.pdfViewer.currentPage = 1;
            this.pdfViewer.numPages = 0;
            this.pdfViewer.settingsOpen = false;
            this.pdfViewer.toc = [];
            this.pdfViewer.autoScrollActive = false;
            this.pdfViewer.autoScrollSpeed = 2;
            
            const isDarkGlobal = document.documentElement.classList.contains('dark');
            this.pdfViewer.darkModeFilter = isDarkGlobal;

            const token = this.shareToken || this.token || shareToken || '';
            const hasShareToken = !!token;
            
            let downloadUrl;
            if (hasShareToken) {
                if (file && file.id) {
                    downloadUrl = `/s/${token}/file/${file.id}/stream`;
                } else {
                    downloadUrl = `/s/${token}/stream`;
                }
            } else {
                downloadUrl = `/download/${file.id}`;
            }

            if (window._pdfLoadingTask) {
                try { window._pdfLoadingTask.destroy(); } catch(e) {}
                window._pdfLoadingTask = null;
            }
            if (window._pdfRenderTask) {
                try { window._pdfRenderTask.cancel(); } catch(e) {}
                window._pdfRenderTask = null;
            }
            window._pdfDoc = null;

            if (window._pdfResizeHandler) {
                window.removeEventListener('resize', window._pdfResizeHandler);
            }
            window._pdfResizeHandler = () => {
                if (this.pdfViewer.show && (this.pdfViewer.zoom === 'width' || this.pdfViewer.zoom === 'height')) {
                    if (window._pdfResizeTimeout) clearTimeout(window._pdfResizeTimeout);
                    window._pdfResizeTimeout = setTimeout(() => {
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
                    }, 150);
                }
            };
            window.addEventListener('resize', window._pdfResizeHandler);

            this.$nextTick(async () => {
                try {
                    const loadingTask = pdfjsLib.getDocument({ url: downloadUrl, withCredentials: true });
                    window._pdfLoadingTask = loadingTask;
                    
                    const pdfDoc = await loadingTask.promise;
                    if (!this.pdfViewer.show || !this.pdfViewer.file || String(this.pdfViewer.file.id || '') !== String(file.id || '') || this.pdfViewer.file.filename !== file.filename) {
                        return;
                    }
                    
                    window._pdfDoc = pdfDoc;
                    this.pdfViewer.numPages = pdfDoc.numPages;
                    this.pdfViewer.loading = false;

                    try {
                        const outline = await pdfDoc.getOutline();
                        if (outline && outline.length > 0) {
                            const resolveOutline = async (items) => {
                                const result = [];
                                for (const item of items) {
                                    let pageNumber = null;
                                    if (item.dest) {
                                        try {
                                            let dest = item.dest;
                                            if (typeof dest === 'string') {
                                                dest = await pdfDoc.getDestination(dest);
                                            }
                                            if (dest && Array.isArray(dest)) {
                                                const pageRef = dest[0];
                                                const pageIndex = await pdfDoc.getPageIndex(pageRef);
                                                pageNumber = pageIndex + 1;
                                            }
                                        } catch (e) {
                                            console.error("Outline dest resolution error:", e);
                                        }
                                    }
                                    const node = { title: item.title, page: pageNumber };
                                    if (item.items && item.items.length > 0) {
                                        node.children = await resolveOutline(item.items);
                                    }
                                    result.push(node);
                                }
                                return result;
                            };
                            const resolved = await resolveOutline(outline);
                            const flatten = (nodes, depth = 0) => {
                                let list = [];
                                nodes.forEach(n => {
                                    list.push({ title: n.title, page: n.page, depth });
                                    if (n.children) {
                                        list = list.concat(flatten(n.children, depth + 1));
                                    }
                                });
                                return list;
                            };
                            this.pdfViewer.toc = flatten(resolved);
                        }
                    } catch (e) {
                        console.error("Failed to parse outline:", e);
                    }

                    let startPage = 1;
                    if (file && file.id) {
                        const saved = localStorage.getItem(`pdf-page-${file.id}`);
                        if (saved) {
                            const p = parseInt(saved);
                            if (p >= 1 && p <= pdfDoc.numPages) {
                                startPage = p;
                            }
                        }
                        const savedMode = localStorage.getItem(`pdf-scroll-mode-${file.id}`);
                        if (savedMode) {
                            this.pdfViewer.scrollMode = savedMode;
                        } else {
                            this.pdfViewer.scrollMode = 'page';
                        }
                    } else {
                        this.pdfViewer.scrollMode = 'page';
                    }
                    this.pdfViewer.currentPage = startPage;
                    this.pdfViewer.pageProgress = Math.round((startPage / pdfDoc.numPages) * 100);
                    if (this.pdfViewer.scrollMode === 'continuous') {
                        this.$nextTick(() => {
                            setTimeout(() => {
                                const container = document.getElementById('pdf-continuous-container') || 
                                                  document.getElementById('share-pdf-continuous-container') || 
                                                  document.getElementById('share-folder-pdf-continuous-container');
                                if (container) {
                                    const wrapper = container.querySelector(`.pdf-page-wrapper[data-page="${startPage}"]`);
                                    if (wrapper) {
                                        wrapper.scrollIntoView({ behavior: 'auto', block: 'start' });
                                    }
                                }
                            }, 300);
                        });
                    } else {
                        this.renderPdfPage(startPage);
                    }

                } catch (err) {
                    console.error("PDF.js initialization failed:", err);
                    this.showToast(this.t('err_loading_pdf'), 'error');
                    this.pdfViewer.show = false;
                    this.pdfViewer.loading = false;
                    this.pdfViewer.pageLoading = false;
                }
            });
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
        pdfNextPage() {
            if (this.pdfViewer.currentPage < this.pdfViewer.numPages) {
                this.renderPdfPage(this.pdfViewer.currentPage + 1);
                this.$nextTick(() => {
                    const area = document.getElementById('pdf-viewer-area');
                    if (area) area.scrollTop = 0;
                });
            }
        },
        pdfPrevPage() {
            if (this.pdfViewer.currentPage > 1) {
                this.renderPdfPage(this.pdfViewer.currentPage - 1);
                this.$nextTick(() => {
                    const area = document.getElementById('pdf-viewer-area');
                    if (area) area.scrollTop = 0;
                });
            }
        },
        pdfJumpToPage(page) {
            const p = parseInt(page);
            if (p >= 1 && p <= this.pdfViewer.numPages) {
                this.renderPdfPage(p);
                this.$nextTick(() => {
                    const area = document.getElementById('pdf-viewer-area');
                    if (area) area.scrollTop = 0;
                });
            }
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
        async showFileInfo(file) {
            if (file.is_folder) return;
            const typeData = this.getFileTypeData(file.filename);
            const ext = file.filename.split('.').pop().toLowerCase();
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
            let isMedia = false; let mediaHtml = ''; let playerTarget = null;
            let isLarge = false;
            
            mediaHtml = TeleCloud.getMediaHtml(file, { isShare: true, shareToken: this.shareToken });
            if (mediaHtml) {
                isMedia = true;
                isLarge = true; // Make media modals larger by default
                if ((videoExts.includes(ext) || audioExts.includes(ext)) && !(TeleCloud.isAppleDevice() && ext === 'mkv')) {
                    playerTarget = { el: '#tele-player', type: videoExts.includes(ext) ? 'video' : 'audio' };
                }
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
            if (playerTarget) {
                setTimeout(() => {
                    if (this.playerInstance) this.playerInstance.destroy();
                    const accentColor = getComputedStyle(document.body).getPropertyValue('--accent-color').trim() || '#3b82f6';
                    const streamUrl = `/s/${this.shareToken}/file/${file.id}/stream`;
                    const thumbUrl = `/s/${this.shareToken}/file/${file.id}/thumb`;

                    if (playerTarget.type === 'audio') {
                        const plyrOpts = { controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'settings'], settings: ['speed'], speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] } };
                        this.playerInstance = new Plyr(playerTarget.el, plyrOpts);
                    } else {
                        const matchedSubs = findSubtitlesForVideo(file.filename, this.files || [], true, this.shareToken);
                        this.playerInstance = new Artplayer({
                            logger: false,
                            container: playerTarget.el,
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
                            autoPlayback: true,
                            airplay: true,
                            type: file.filename.split('.').pop().toLowerCase() === 'mkv' ? 'mp4' : file.filename.split('.').pop().toLowerCase(),
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
                                buildArtplayerSubtitleSetting(file.filename, this.files || [], true, this.shareToken, (k) => this.t(k))
                            ],
                            icons: {
                                loading: '<i class="fa-solid fa-spinner fa-spin text-4xl"></i>',
                                state: '<i class="fa-solid fa-play text-4xl"></i>',
                            }
                        });
                        this.playerInstance.on('error', (error, reconnectTime) => {
                            const ua = navigator.userAgent;
                            const isApple = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Safari") && !ua.includes("Chrome") && !ua.includes("Edg"));
                            if (isApple) {
                                Alpine.store('app').showToast(this.t('err_video_unsupported_apple'), "error");
                            }
                        });
                        this.playerInstance.on('fullscreen', (state) => document.body.classList.toggle('art-fullscreen-active', state));
                        this.playerInstance.on('fullscreenWeb', (state) => document.body.classList.toggle('art-fullscreen-active', state));
                    }
                }, 50);
            }
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
                
                if (ext !== 'md' && window.Prism) {
                    setTimeout(() => Prism.highlightAllUnder(document.querySelector('#media-preview-container')), 50);
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

function shareFileApp() {
    return {
        lang: TeleCloud.lang,
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
        comicViewer: { show: false, file: null, pages: [], pageUrls: [], currentPageIndex: 0, loading: false, fitMode: 'height', pageLoading: false, scrollMode: 'page', autoScrollActive: false, autoScrollSpeed: 2, settingsOpen: false },
        epubViewer: { show: false, file: null, loading: false, sidebarOpen: false, toc: [], fontSize: 100, pageProgress: 0, scrollMode: 'scrolled', autoScrollActive: false, autoScrollSpeed: 2, settingsOpen: false, spine: [], resourceBaseUrl: '', currentChapter: 0, title: '' },
        pdfViewer: { show: false, file: null, loading: false, sidebarOpen: false, toc: [], zoom: 100, pageProgress: 0, settingsOpen: false, currentPage: 1, numPages: 0, darkModeFilter: false, pageLoading: false, autoScrollActive: false, autoScrollSpeed: 2, scrollMode: 'page' },
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
            if (this.comicViewer.currentPageIndex < this.comicViewer.pages.length - 1) {
                this.comicViewer.currentPageIndex++;
                this.loadComicPage();
                this.preloadNextComicPage();
                this.saveComicProgress();
            }
        },
        prevComicPage() {
            if (this.comicViewer.currentPageIndex > 0) {
                this.comicViewer.currentPageIndex--;
                this.loadComicPage();
                this.saveComicProgress();
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
                        
                        this._loadEpubChapter(file);
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
        _loadEpubChapter(file, startAtBottom = false) {
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
                    const savedScroll = file.id ? localStorage.getItem(`epub-scroll-${file.id}`) : null;
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
                this._saveEpubScroll();
                this.epubViewer.currentChapter++;
                this._loadEpubChapter(this.epubViewer.file, false);
            }
        },
        prevEpubChapter(startAtBottom = false) {
            if (this.epubViewer.currentChapter > 0) {
                this._saveEpubScroll();
                this.epubViewer.currentChapter--;
                this._loadEpubChapter(this.epubViewer.file, startAtBottom);
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
                this._loadEpubChapter(this.epubViewer.file, false);
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
            const bg = isDark ? '#1e293b' : '#ffffff';
            const fg = isDark ? '#f1f5f9' : '#0f172a';
            
            let style = doc.getElementById('tc-epub-theme');
            if (!style) {
                style = doc.createElement('style');
                style.id = 'tc-epub-theme';
                doc.head.appendChild(style);
            }
            style.textContent = `
                body { background: ${bg} !important; color: ${fg} !important; font-size: ${this.epubViewer.fontSize}% !important; line-height: 1.6 !important; padding: 20px !important; max-width: 800px !important; margin: 0 auto !important; font-family: Inter, system-ui, -apple-system, sans-serif !important; }
                p, span, div, li, td, th, h1, h2, h3, h4, h5, h6 { color: ${fg} !important; }
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
                    background: ${isDark ? '#475569' : '#cbd5e1'};
                    border-radius: 4px;
                }
                ::-webkit-scrollbar-thumb:hover {
                    background: ${isDark ? '#64748b' : '#94a3b8'};
                }
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
            this.pdfViewer.show = true;
            this.pdfViewer.file = file;
            this.pdfViewer.loading = true;
            this.pdfViewer.pageLoading = true;
            this.pdfViewer.sidebarOpen = false;
            this.pdfViewer.zoom = 'width';
            this.pdfViewer.pageProgress = 0;
            this.pdfViewer.currentPage = 1;
            this.pdfViewer.numPages = 0;
            this.pdfViewer.settingsOpen = false;
            this.pdfViewer.toc = [];
            this.pdfViewer.autoScrollActive = false;
            this.pdfViewer.autoScrollSpeed = 2;
            
            const isDarkGlobal = document.documentElement.classList.contains('dark');
            this.pdfViewer.darkModeFilter = isDarkGlobal;

            const token = this.shareToken || this.token || shareToken || '';
            const hasShareToken = !!token;
            
            let downloadUrl;
            if (hasShareToken) {
                downloadUrl = `/s/${token}/stream`;
            } else {
                downloadUrl = `/download/${file.id}`;
            }

            if (window._pdfLoadingTask) {
                try { window._pdfLoadingTask.destroy(); } catch(e) {}
                window._pdfLoadingTask = null;
            }
            if (window._pdfRenderTask) {
                try { window._pdfRenderTask.cancel(); } catch(e) {}
                window._pdfRenderTask = null;
            }
            window._pdfDoc = null;

            if (window._pdfResizeHandler) {
                window.removeEventListener('resize', window._pdfResizeHandler);
            }
            window._pdfResizeHandler = () => {
                if (this.pdfViewer.show && (this.pdfViewer.zoom === 'width' || this.pdfViewer.zoom === 'height')) {
                    if (window._pdfResizeTimeout) clearTimeout(window._pdfResizeTimeout);
                    window._pdfResizeTimeout = setTimeout(() => {
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
                    }, 150);
                }
            };
            window.addEventListener('resize', window._pdfResizeHandler);

            this.$nextTick(async () => {
                try {
                    const loadingTask = pdfjsLib.getDocument({ url: downloadUrl, withCredentials: true });
                    window._pdfLoadingTask = loadingTask;
                    
                    const pdfDoc = await loadingTask.promise;
                    if (!this.pdfViewer.show || !this.pdfViewer.file || String(this.pdfViewer.file.id || '') !== String(file.id || '') || this.pdfViewer.file.filename !== file.filename) {
                        return;
                    }
                    
                    window._pdfDoc = pdfDoc;
                    this.pdfViewer.numPages = pdfDoc.numPages;
                    this.pdfViewer.loading = false;

                    try {
                        const outline = await pdfDoc.getOutline();
                        if (outline && outline.length > 0) {
                            const resolveOutline = async (items) => {
                                const result = [];
                                for (const item of items) {
                                    let pageNumber = null;
                                    if (item.dest) {
                                        try {
                                            let dest = item.dest;
                                            if (typeof dest === 'string') {
                                                dest = await pdfDoc.getDestination(dest);
                                            }
                                            if (dest && Array.isArray(dest)) {
                                                const pageRef = dest[0];
                                                const pageIndex = await pdfDoc.getPageIndex(pageRef);
                                                pageNumber = pageIndex + 1;
                                            }
                                        } catch (e) {
                                            console.error("Outline dest resolution error:", e);
                                        }
                                    }
                                    const node = { title: item.title, page: pageNumber };
                                    if (item.items && item.items.length > 0) {
                                        node.children = await resolveOutline(item.items);
                                    }
                                    result.push(node);
                                }
                                return result;
                            };
                            const resolved = await resolveOutline(outline);
                            const flatten = (nodes, depth = 0) => {
                                let list = [];
                                nodes.forEach(n => {
                                    list.push({ title: n.title, page: n.page, depth });
                                    if (n.children) {
                                        list = list.concat(flatten(n.children, depth + 1));
                                    }
                                });
                                return list;
                            };
                            this.pdfViewer.toc = flatten(resolved);
                        }
                    } catch (e) {
                        console.error("Failed to parse outline:", e);
                    }

                    let startPage = 1;
                    if (file && file.id) {
                        const saved = localStorage.getItem(`pdf-page-${file.id}`);
                        if (saved) {
                            const p = parseInt(saved);
                            if (p >= 1 && p <= pdfDoc.numPages) {
                                startPage = p;
                            }
                        }
                        const savedMode = localStorage.getItem(`pdf-scroll-mode-${file.id}`);
                        if (savedMode) {
                            this.pdfViewer.scrollMode = savedMode;
                        } else {
                            this.pdfViewer.scrollMode = 'page';
                        }
                    } else {
                        this.pdfViewer.scrollMode = 'page';
                    }
                    this.pdfViewer.currentPage = startPage;
                    this.pdfViewer.pageProgress = Math.round((startPage / pdfDoc.numPages) * 100);
                    if (this.pdfViewer.scrollMode === 'continuous') {
                        this.$nextTick(() => {
                            setTimeout(() => {
                                const container = document.getElementById('pdf-continuous-container') || 
                                                  document.getElementById('share-pdf-continuous-container') || 
                                                  document.getElementById('share-folder-pdf-continuous-container');
                                if (container) {
                                    const wrapper = container.querySelector(`.pdf-page-wrapper[data-page="${startPage}"]`);
                                    if (wrapper) {
                                        wrapper.scrollIntoView({ behavior: 'auto', block: 'start' });
                                    }
                                }
                            }, 300);
                        });
                    } else {
                        this.renderPdfPage(startPage);
                    }

                } catch (err) {
                    console.error("PDF.js initialization failed:", err);
                    this.showToast(this.t('err_loading_pdf'), 'error');
                    this.pdfViewer.show = false;
                    this.pdfViewer.loading = false;
                    this.pdfViewer.pageLoading = false;
                }
            });
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
        pdfNextPage() {
            if (this.pdfViewer.currentPage < this.pdfViewer.numPages) {
                this.renderPdfPage(this.pdfViewer.currentPage + 1);
                this.$nextTick(() => {
                    const area = document.getElementById('pdf-viewer-area');
                    if (area) area.scrollTop = 0;
                });
            }
        },
        pdfPrevPage() {
            if (this.pdfViewer.currentPage > 1) {
                this.renderPdfPage(this.pdfViewer.currentPage - 1);
                this.$nextTick(() => {
                    const area = document.getElementById('pdf-viewer-area');
                    if (area) area.scrollTop = 0;
                });
            }
        },
        pdfJumpToPage(page) {
            const p = parseInt(page);
            if (p >= 1 && p <= this.pdfViewer.numPages) {
                this.renderPdfPage(p);
                this.$nextTick(() => {
                    const area = document.getElementById('pdf-viewer-area');
                    if (area) area.scrollTop = 0;
                });
            }
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
                                this.$nextTick(() => { if (window.Prism) Prism.highlightAllUnder(document.querySelector('#media-preview-container')); });
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
                        setTimeout(() => { 
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
                                        buildArtplayerSubtitleSetting(this.filename, [], true, this.token, (k) => this.t(k))
                                    ],
                                    icons: {
                                        loading: '<i class="fa-solid fa-spinner fa-spin text-4xl"></i>',
                                        state: '<i class="fa-solid fa-play text-4xl"></i>',
                                    }
                                });
                                this.playerInstance.on('error', (error, reconnectTime) => {
                                    const ua = navigator.userAgent;
                                    const isApple = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Safari") && !ua.includes("Chrome") && !ua.includes("Edg"));
                                    if (isApple) {
                                        Alpine.store('app').showToast(Alpine.store('app').t('err_video_unsupported_apple'), "error");
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
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    Alpine.start();
});

