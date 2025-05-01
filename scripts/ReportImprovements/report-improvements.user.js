// ==UserScript==
// @name         Report Improvements
// @version      1.5.0
// @description  Various improvements to XenForo reports
// @author       Jindosh
// @match        *://*/reports/*
// @updateURL    https://raw.githubusercontent.com/Kirin-Jindosh/forum-stuff/refs/heads/main/scripts/ReportImprovements/report-improvements.user.js
// @downloadURL  https://raw.githubusercontent.com/Kirin-Jindosh/forum-stuff/refs/heads/main/scripts/ReportImprovements/report-improvements.user.js
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'xf-report-filter-allowedForums';
    const LIVE_REFRESH_KEY = 'xf-report-filter-liveRefreshEnabled';
    const REFRESH_INTERVAL = 15000;
    const TAB_ID = `tab-${Math.random().toString(36).substr(2, 9)}`;
    const HEARTBEAT_KEY = 'xf-report-refresh-heartbeat';
    const ICON_URL = 'https://raw.githubusercontent.com/Kirin-Jindosh/forum-stuff/refs/heads/dev/scripts/ReportImprovements/PepeHmmm.png';

    let refreshIntervalId = null;

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

        document.body.appendChild(popup);

        btn.addEventListener('click', () => {
            const current = getAllowedForums();
            document.getElementById('xf-forum-editor').value = current.join('\n');
            document.getElementById('xf-live-refresh-toggle').checked = isLiveRefreshEnabled();
            popup.style.display = popup.style.display === 'none' ? 'block' : 'none';
            updateTabStatusWarning();
        });

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

    function checkForReportUpdates() {
        if (!isMasterTab()) {
            return;
        }

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
                    if (key && !newKeys.has(key)) {
                        console.log(`[Live Refresh] Report ${key} is missing (resolved)`);
                        r.remove();
                    }
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

    waitForReportsContainer(() => {
        hoistReports();
        createSettingsUI();
        startHeartbeat();
        setInterval(updateTabStatusWarning, 5000);
        restartLiveRefresh();
    });
})();