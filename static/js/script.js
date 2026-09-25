import Alpine from 'alpinejs';
import collapse from '@alpinejs/collapse';
import './modules/player_helpers.js';
import { cloudApp } from './modules/cloud_app.js';
import { shareApp } from './modules/share_app.js';
import { shareFileApp } from './modules/share_file_app.js';

Alpine.plugin(collapse);
window.Alpine = Alpine;

// Expose main app functions to window for Alpine.js x-data
window.cloudApp = cloudApp;
window.shareApp = shareApp;
window.shareFileApp = shareFileApp;

document.addEventListener('DOMContentLoaded', () => {
    Alpine.start();
});
