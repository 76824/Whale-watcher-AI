
(function() {
    const backend = window.CHENDA_BACKEND || document.currentScript.getAttribute('data-backend') || '';
    const intervalMs = parseInt(document.currentScript.getAttribute('data-interval-ms') || '5000', 10);

    const tableContainer = document.getElementById('chenda-signal-table');
    const jsonContainer = document.getElementById('signal_json');

    const statusEl = document.createElement('div');
    statusEl.style.fontSize = '0.9em';
    statusEl.style.marginBottom = '5px';
    if (tableContainer) {
        tableContainer.parentNode.insertBefore(statusEl, tableContainer);
    } else if (jsonContainer) {
        jsonContainer.parentNode.insertBefore(statusEl, jsonContainer);
    } else {
        document.body.insertBefore(statusEl, document.body.firstChild);
    }

    async function fetchSignal() {
        const url = backend ? backend.replace(/\/$/, '') + '/signal' : '/signal';
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
            const data = await res.json();
            statusEl.textContent = '✅ Last updated: ' + new Date().toLocaleTimeString();

            if (tableContainer && data && typeof data === 'object') {
                renderTable(tableContainer, data);
            }
            if (jsonContainer) {
                jsonContainer.textContent = JSON.stringify(data, null, 2);
            }

            document.dispatchEvent(new CustomEvent('chenda:signal', { detail: data }));
        } catch (err) {
            statusEl.textContent = '❌ Error fetching /signal: ' + err.message;
        }
    }

    function renderTable(container, data) {
        if (!data || typeof data !== 'object') {
            container.textContent = 'No data';
            return;
        }
        let html = '<table border="1" cellpadding="4" cellspacing="0"><thead><tr>';
        html += '<th>Key</th><th>Value</th></tr></thead><tbody>';
        for (const [key, value] of Object.entries(data)) {
            html += '<tr><td>' + key + '</td><td>' + (typeof value === 'object' ? JSON.stringify(value) : value) + '</td></tr>';
        }
        html += '</tbody></table>';
        container.innerHTML = html;
    }

    setInterval(fetchSignal, intervalMs);
    fetchSignal();
})();
