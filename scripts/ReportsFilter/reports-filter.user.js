// ==UserScript==
// @name         Report filter
// @version      1.2
// @description  Does what it says on the tin
// @author       Jindosh
// @match        *://*/reports/*
// @updateURL    https://github.com/Kirin-Jindosh/forum-stuff/raw/refs/heads/main/scripts/ReportsFilter/reports-filter.user.js
// @downloadURL  https://github.com/Kirin-Jindosh/forum-stuff/raw/refs/heads/main/scripts/ReportsFilter/reports-filter.user.js
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'xf-report-filter-allowedForums';

    function getAllowedForums() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];
        return JSON.parse(stored);
    }

    function saveAllowedForums(forums) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(forums));
    }

    function filterReports() {
        const allowedForums = getAllowedForums();

        if (allowedForums.length === 0) {
            document.querySelectorAll('.structItem.structItem--report').forEach(report => {
                report.style.display = '';
            });
            return;
        }

        const reports = document.querySelectorAll('.structItem.structItem--report');
        reports.forEach(report => {
            const forumLink = report.querySelector('.structItem-forum a');
            if (forumLink) {
                const forumName = forumLink.textContent.trim();
                if (!allowedForums.some(f => f.toLowerCase() === forumName.toLowerCase())) {
                    report.style.display = 'none';
                } else {
                    report.style.display = '';
                }
            }
        });
    }

    function createSettingsUI() {
        const btn = document.createElement('button');
        btn.textContent = 'Filter';
        btn.style.position = 'fixed';
        btn.style.bottom = '20px';
        btn.style.right = '20px';
        btn.style.zIndex = '1000';
        btn.style.padding = '8px 12px';
        btn.style.background = '#3db7c7';
        btn.style.color = '#fff';
        btn.style.border = 'none';
        btn.style.borderRadius = '5px';
        btn.style.cursor = 'pointer';
        document.body.appendChild(btn);

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
            <label style="font-weight: bold; display:block; margin-bottom: 5px;">Subforums (one per line):</label>
            <textarea id="xf-forum-editor" style="width: 200px; height: 100px;"></textarea><br>
            <button id="xf-save-forums" style="margin-top: 8px;">Filter</button>
        `;

        document.body.appendChild(popup);

        btn.addEventListener('click', () => {
            const current = getAllowedForums();
            document.getElementById('xf-forum-editor').value = current.join('\n');
            popup.style.display = (popup.style.display === 'none') ? 'block' : 'none';
        });

        document.getElementById('xf-save-forums').addEventListener('click', () => {
            const lines = document.getElementById('xf-forum-editor').value
                .split('\n')
                .map(f => f.trim())
                .filter(f => f.length > 0);
            saveAllowedForums(lines);
            filterReports();
            popup.style.display = 'none';
        });
    }

    function setupObserver() {
        const container = document.querySelector('.structItemContainer');
        if (container) {
            const observer = new MutationObserver(() => {
                filterReports();
            });
            observer.observe(container, { childList: true, subtree: true });
        }
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

    waitForReportsContainer(() => {
        filterReports();
        createSettingsUI();
        setupObserver();
    });

})();
