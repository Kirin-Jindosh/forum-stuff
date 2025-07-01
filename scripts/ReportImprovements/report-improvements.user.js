// ==UserScript==
// @name         Report Improvements
// @version      1.6
// @description  Various improvements to XenForo reports
// @author       Jindosh
// @match        *://*ity.su/*
// @updateURL    https://raw.githubusercontent.com/Kirin-Jindosh/forum-stuff/refs/heads/main/scripts/ReportImprovements/report-improvements.user.js
// @downloadURL  https://raw.githubusercontent.com/Kirin-Jindosh/forum-stuff/refs/heads/main/scripts/ReportImprovements/report-improvements.user.js
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function () {
    'use strict';

    const IS_REPORTS_PAGE = location.pathname.includes('/reports/');
    const IS_THREADS_PAGE = location.pathname.includes('/threads/');

    if (!IS_REPORTS_PAGE && !IS_THREADS_PAGE) return;

    const STORAGE_KEY = 'xf-report-filter-allowedForums';
    const LIVE_REFRESH_KEY = 'xf-report-filter-liveRefreshEnabled';
    const REFRESH_INTERVAL = 15000;
    const TAB_ID = `tab-${Math.random().toString(36).substr(2, 9)}`;
    const HEARTBEAT_KEY = 'xf-report-refresh-heartbeat';
    const MAX_IDLE_TIME = 5 * 60 * 1000;
    const ICON_URL = 'https://raw.githubusercontent.com/Kirin-Jindosh/forum-stuff/refs/heads/dev/scripts/ReportImprovements/PepeHmmm.png';

    let refreshIntervalId = null;
    let lastInteraction = Date.now();

    const style = document.createElement('style');
    style.textContent = `
    @keyframes xfFlash {
        0%   { background-color: #2d2d2d; box-shadow: 0 0 0px 0px rgba(0, 150, 255, 0); }
        30%  { background-color: #2d2d2d; box-shadow: 0 0 10px 4px rgba(0, 150, 255, 0.4); }
        100% { background-color: transparent; box-shadow: none; }
    }

    .xf-flash-highlight {
        animation: xfFlash 2s ease-out;
    }
    `;
    document.head.appendChild(style);


    function getAllowedForums() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];
        return JSON.parse(stored);
    }

    function saveAllowedForums(forums) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(forums));
    }

    function isLiveRefreshEnabled() {
        return localStorage.getItem(LIVE_REFRESH_KEY) === 'true';
    }

    function setLiveRefreshEnabled(enabled) {
        localStorage.setItem(LIVE_REFRESH_KEY, enabled.toString());
    }

    function getReportKey(reportElement) {
        const link = reportElement.querySelector('a.structItem-title');
        return link ? link.href : null;
    }

    function hoistReports(fromDocument = document) {
        const allowedForums = getAllowedForums().map(f => f.toLowerCase());
        const existingSection = document.getElementById('xf-report-hoist');
        if (existingSection) existingSection.remove();

        if (allowedForums.length === 0) return;

        const allBlocks = fromDocument.querySelectorAll('.structItemContainer');

        const hoistedContainer = document.createElement('div');
        hoistedContainer.id = 'xf-report-hoist';
        hoistedContainer.className = 'block';
        hoistedContainer.style.marginBottom = '20px';

        const inner = document.createElement('div');
        inner.className = 'block-container';
        hoistedContainer.appendChild(inner);

        const header = document.createElement('div');
        header.className = 'block-header';
        header.innerHTML = `<span class="block-header--title">Filtered reports:</span>`;
        inner.appendChild(header);

        const body = document.createElement('div');
        body.className = 'structItemContainer';
        inner.appendChild(body);

        let matchCount = 0;

        const openBlock = allBlocks[0];
        if (openBlock) {
            const reports = openBlock.querySelectorAll('.structItem.structItem--report');
            reports.forEach(report => {
                const forumLink = report.querySelector('.structItem-forum a');
                const forumName = forumLink?.textContent.trim().toLowerCase() ?? '';
                if (allowedForums.some(f => forumName.includes(f))) {
                    const clone = report.cloneNode(true);
                    body.appendChild(clone);
                    matchCount++;
                }
            });
        }

        if (matchCount > 0) {
            const mainList = document.querySelector('.p-body-main .block-container');
            if (mainList) {
                mainList.parentNode.insertBefore(hoistedContainer, mainList);
            } else {
                document.body.insertBefore(hoistedContainer, document.body.firstChild);
            }
        }
    }

    function setupJumpToPost() {
        const container = document.querySelector('.p-title');
        if (!container) return;

        const wrapper = document.createElement('div');
        wrapper.style.display = 'inline-flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.marginLeft = '1rem';

        const input = document.createElement('input');
        input.type = 'number';
        input.min = '1';
        input.placeholder = 'Jump to post #';
        input.style.width = '80px';
        input.style.marginRight = '0.5rem';

        const button = document.createElement('button');
        button.textContent = 'Go';
        button.style.cursor = 'pointer';

        wrapper.appendChild(input);
        wrapper.appendChild(button);
        container.appendChild(wrapper);

        button.addEventListener('click', () => {
            const num = parseInt(input.value);
            if (isNaN(num) || num <= 0) return;

            const postsPerPage = 20;
            const page = Math.ceil(num / postsPerPage);
            const targetUrl = getPageUrl(page);

            sessionStorage.setItem('xf-scroll-to-post-number', num);
            window.location.href = targetUrl;
        });
    }

    function getPageUrl(page) {
        const baseUrl = window.location.href.split('/page-')[0].split('#')[0];
        return `${baseUrl}/page-${page}#posts`;
    }

    function tryScrollToPost() {
        const num = parseInt(localStorage.getItem('xf-scroll-to-post-number'), 10);
        if (!num || isNaN(num)) return;

        localStorage.removeItem('xf-scroll-to-post-number');

        const anchors = [...document.querySelectorAll('a[href*="/post-"]')]
            .filter(a => a.textContent.trim() === `#${num}`);

        if (anchors.length === 0) return;

        const postAnchor = anchors[0];
        const postContainer = postAnchor.closest('.message');

        if (postContainer) {
            postContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            postContainer.classList.add('xf-flash-highlight');
            setTimeout(() => postContainer.classList.remove('xf-flash-highlight'), 1500);
        }
    }

    function createSettingsUI() {
        const btn = document.createElement('button');
        btn.style.position = 'fixed';
        btn.style.bottom = '20px';
        btn.style.right = '60px';
        btn.style.zIndex = '1000';
        btn.style.width = '40px';
        btn.style.height = '40px';
        btn.style.backgroundImage = `url('${ICON_URL}')`;
        btn.style.backgroundSize = 'contain';
        btn.style.backgroundRepeat = 'no-repeat';
        btn.style.backgroundColor = 'transparent';
        btn.style.border = 'none';
        btn.style.cursor = 'pointer';
        btn.title = 'Filter settings';
        document.body.appendChild(btn);

        const warningIcon = document.createElement('div');
        warningIcon.id = 'xf-refresh-warning-icon';
        warningIcon.textContent = '🔕';
        warningIcon.style.position = 'fixed';
        warningIcon.style.bottom = '20px';
        warningIcon.style.right = '105px';
        warningIcon.style.zIndex = '1000';
        warningIcon.style.fontSize = '20px';
        warningIcon.style.display = 'none';
        warningIcon.title = 'Something needs your attention';
        document.body.appendChild(warningIcon);

        const popup = document.createElement('div');
        popup.style.position = 'fixed';
        popup.style.bottom = '60px';
        popup.style.right = '20px';
        popup.style.zIndex = '1001';
        popup.style.background = '#262626';
        popup.style.border = '1px solid #ccc';
        popup.style.borderRadius = '5px';
        popup.style.padding = '10px';
        popup.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
        popup.style.display = 'none';

        if (IS_REPORTS_PAGE) {
            popup.innerHTML = `
                <label style="font-weight: bold; display:block; margin-bottom: 5px;">Subforums to highlight (one per line):</label>
                <textarea id="xf-forum-editor" style="width: 200px; height: 100px;"></textarea><br>
                <label style="display:block; margin-top:10px;">
                    <input type="checkbox" id="xf-live-refresh-toggle"> Live update reports
                </label>
                <div id="xf-live-refresh-warning" style="color:rgb(218, 20, 20); margin-top: 8px; display: none;">
                    Live refresh is already enabled in another tab.
                </div>
                <button id="xf-save-forums" style="margin-top: 8px;">Filter</button>
            `;
        } else {
            popup.innerHTML = `
                <label style="font-weight: bold; display:block; margin-bottom: 5px;">Jump to post number:</label>
                <input id="xf-jump-post-number" type="number" min="1" style="width: 100%; margin-bottom: 8px;"><br>
                <button id="xf-jump-post-button" style="width: 100%;">Go to post</button>
            `;
        }

        document.body.appendChild(popup);

        btn.addEventListener('click', () => {
            popup.style.display = popup.style.display === 'none' ? 'block' : 'none';
            if (IS_REPORTS_PAGE) {
                const current = getAllowedForums();
                document.getElementById('xf-forum-editor').value = current.join('\n');
                document.getElementById('xf-live-refresh-toggle').checked = isLiveRefreshEnabled();
                updateTabStatusWarning();
            }
        });

        if (IS_REPORTS_PAGE) {
            document.getElementById('xf-save-forums').addEventListener('click', () => {
                const lines = document.getElementById('xf-forum-editor').value
                    .split('\n')
                    .map(f => f.trim())
                    .filter(f => f.length > 0);
                saveAllowedForums(lines);
                setLiveRefreshEnabled(document.getElementById('xf-live-refresh-toggle').checked);
                hoistReports();
                popup.style.display = 'none';
                updateTabStatusWarning();
                restartLiveRefresh();
            });
        }

        if (IS_THREADS_PAGE) {
            document.getElementById('xf-jump-post-button').addEventListener('click', () => {
                const input = document.getElementById('xf-jump-post-number');
                const postNumber = parseInt(input.value, 10);
                if (!postNumber || postNumber < 1) return;

                const page = Math.ceil(postNumber / 20);
                const currentUrl = window.location.href;
                const baseUrl = currentUrl.replace(/\/page-\d+.*$/, '').split('#')[0];

                localStorage.setItem('xf-scroll-to-post-number', postNumber);
                window.location.href = `${baseUrl}/page-${page}#post-${postNumber}`;
            });
        }
    }

    function checkForReportUpdates() {
        if (!isMasterTab()) return;
        if (Date.now() - lastInteraction > MAX_IDLE_TIME) return;

        GM_xmlhttpRequest({
            method: 'GET',
            url: window.location.href,
            onload: function (response) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(response.responseText, 'text/html');

                const openReportsNew = Array.from(doc.querySelectorAll('.structItemContainer'))[0]
                    .querySelectorAll('.structItem.structItem--report');

                const realContainers = Array.from(document.querySelectorAll('.structItemContainer'))
                    .filter(c => !c.closest('#xf-report-hoist'));

                const currentReports = realContainers.length > 0
                    ? realContainers[0].querySelectorAll('.structItem.structItem--report')
                    : [];

                const newKeys = new Set([...openReportsNew].map(getReportKey));
                const currentKeys = new Set([...currentReports].map(getReportKey));

                currentReports.forEach(r => {
                    const key = getReportKey(r);
                    if (key && !newKeys.has(key)) r.remove();
                });

                const container = realContainers.length > 0 ? realContainers[0] : null;
                if (container) {
                    openReportsNew.forEach(r => {
                        const key = getReportKey(r);
                        if (key && !currentKeys.has(key)) {
                            if (!container.querySelector(`[href="${key}"]`)) {
                                const clone = r.cloneNode(true);
                                container.insertBefore(clone, container.firstChild);
                            }
                        }
                    });
                }

                hoistReports();
            },
            onerror: function (err) {
                console.error('Live refresh failed:', err);
            }
        });
    }

    function startLiveRefresh() {
        if (refreshIntervalId) return;
        refreshIntervalId = setInterval(checkForReportUpdates, REFRESH_INTERVAL);
    }

    function stopLiveRefresh() {
        clearInterval(refreshIntervalId);
        refreshIntervalId = null;
    }

    function restartLiveRefresh() {
        stopLiveRefresh();
        if (isLiveRefreshEnabled()) startLiveRefresh();
    }

    function waitForReportsContainer(callback) {
        const check = setInterval(() => {
            const container = document.querySelector('.structItemContainer');
            if (container) {
                clearInterval(check);
                callback();
            }
        }, 200);
    }

    function startHeartbeat() {
        setInterval(() => {
            const data = JSON.parse(localStorage.getItem(HEARTBEAT_KEY) || '{}');
            const timeSinceLastBeat = Date.now() - (data.timestamp || 0);
            const isStale = timeSinceLastBeat > 7000;

            if (data.tabId === TAB_ID || isStale) {
                const newBeat = {
                    tabId: TAB_ID,
                    timestamp: Date.now()
                };
                localStorage.setItem(HEARTBEAT_KEY, JSON.stringify(newBeat));
            }
        }, 3000);
    }

    function isMasterTab() {
        const data = JSON.parse(localStorage.getItem(HEARTBEAT_KEY) || '{}');
        const isLeader = data.tabId === TAB_ID;
        const isRecent = Date.now() - data.timestamp < 7000;
        return isLeader && isRecent;
    }

    function updateTabStatusWarning() {
        const isLeader = isMasterTab();
        const refreshEnabled = isLiveRefreshEnabled();
        const warningText = document.getElementById('xf-live-refresh-warning');
        const warningIcon = document.getElementById('xf-refresh-warning-icon');

        if (refreshEnabled && !isLeader) {
            warningText.style.display = 'block';
            warningIcon.style.display = 'block';
        } else {
            warningText.style.display = 'none';
            warningIcon.style.display = 'none';
        }
    }

    function tabActivity() {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) lastInteraction = Date.now();
        });
    }

    createSettingsUI();

    if (IS_REPORTS_PAGE) {
        waitForReportsContainer(() => {
            hoistReports();
            startHeartbeat();
            setInterval(updateTabStatusWarning, 5000);
            tabActivity();
            restartLiveRefresh();
        });
    }

    if (IS_THREADS_PAGE) {
        setupJumpToPost();
        setTimeout(tryScrollToPost, 500);
    }
})();