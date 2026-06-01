// =============================================================
//  IEEE 14-Bus ML Load Flow Analyzer — script.js
// =============================================================

// ── Contingency mappings ──────────────────────────────────────
const contingencyMapping = [
    { group: "⚡ Base Case", options: [
        { label: "Base Case (N-0)", value: 0 }
    ]},
    { group: "🔋 Generator Contingencies", options: [
        { label: "G1 — Generator 1 Out", value: 1 },
        { label: "G2 — Generator 2 Out", value: 2 },
        { label: "G3 — Generator 3 Out", value: 3 },
        { label: "G4 — Generator 4 Out", value: 4 }
    ]},
    { group: "🔌 Line Contingencies", options: [
        { label: "L1  — Line 1  Out", value: 5  },
        { label: "L2  — Line 2  Out", value: 12 },
        { label: "L3  — Line 3  Out", value: 13 },
        { label: "L4  — Line 4  Out", value: 14 },
        { label: "L5  — Line 5  Out", value: 15 },
        { label: "L6  — Line 6  Out", value: 16 },
        { label: "L7  — Line 7  Out", value: 17 },
        { label: "L8  — Line 8  Out", value: 18 },
        { label: "L9  — Line 9  Out", value: 19 },
        { label: "L10 — Line 10 Out", value: 6  },
        { label: "L11 — Line 11 Out", value: 7  },
        { label: "L12 — Line 12 Out", value: 8  },
        { label: "L13 — Line 13 Out", value: 9  },
        { label: "L14 — Line 14 Out", value: 10 },
        { label: "L15 — Line 15 Out", value: 11 }
    ]},
    { group: "📦 Load Contingencies", options: [
        { label: "D1  — Load 1  Off",  value: 20 },
        { label: "D2  — Load 2  Off",  value: 23 },
        { label: "D3  — Load 3  Off",  value: 24 },
        { label: "D4  — Load 4  Off",  value: 25 },
        { label: "D5  — Load 5  Off",  value: 26 },
        { label: "D6  — Load 6  Off",  value: 27 },
        { label: "D7  — Load 7  Off",  value: 28 },
        { label: "D8  — Load 8  Off",  value: 29 },
        { label: "D9  — Load 9  Off",  value: 30 },
        { label: "D10 — Load 10 Off",  value: 21 },
        { label: "D11 — Load 11 Off",  value: 22 }
    ]},
    { group: "⚙️ Shunt Contingency", options: [
        { label: "SH1 — Shunt 1  Off", value: 31 }
    ]}
];

const CODE_TO_LOAD = {20:1,23:2,24:3,25:4,26:5,27:6,28:7,29:8,30:9,21:10,22:11};
const CODE_TO_LINE = {5:1,12:2,13:3,14:4,15:5,16:6,17:7,18:8,19:9,6:10,7:11,8:12,9:13,10:14,11:15};

const topoLabel = {}, topoType = {};
const typeMap = {
    "⚡ Base Case":"base","🔋 Generator Contingencies":"gen",
    "🔌 Line Contingencies":"line","📦 Load Contingencies":"load",
    "⚙️ Shunt Contingency":"shunt"
};
contingencyMapping.forEach(g => g.options.forEach(o => {
    topoLabel[o.value] = o.label.split("—").pop().trim();
    topoType[o.value]  = typeMap[g.group] || "base";
}));

const LINE_LABELS = [
    "L1 (1-2)","L2 (1-5)","L3 (2-3)","L4 (2-4)","L5 (2-5)",
    "L6 (3-4)","L7 (4-5)","L8 (4-7)","L9 (4-9)","L10 (5-6)",
    "L11 (6-11)","L12 (6-12)","L13 (6-13)","L14 (7-8)","L15 (7-9)"
];
const BUS_LABELS = Array.from({length:14}, (_,i) => `Bus ${i+1}`);

// ── Chart instances ──
let voltageChart = null, angleChart = null, lossChart = null, currentChart = null;
let cmpVoltageChart = null, cmpQLossChart = null, cmpLossChart = null, cmpErrorChart = null;
let chartsInitialised = false, cmpChartsInitialised = false;

// ── State ──
let globalResults    = [];
let loadingInterval  = null;
let autoPlayInterval = null;
let autoPlaySpeed    = 800;

// =============================================================
//  CHART.JS GLOBAL DEFAULTS
// =============================================================
Chart.defaults.animation.duration = 300;
Chart.defaults.font.family = "'JetBrains Mono', monospace";

// Shared tooltip plugin config — shows crosshair + full data on hover
const SHARED_TOOLTIP = {
    mode: 'index',
    intersect: false,
    backgroundColor: 'rgba(10,14,25,0.92)',
    borderColor: 'rgba(6,182,212,0.4)',
    borderWidth: 1,
    titleColor: '#94a3b8',
    bodyColor: '#e2e8f0',
    padding: 10,
    cornerRadius: 8,
    titleFont: { family: "'JetBrains Mono', monospace", size: 11 },
    bodyFont: { family: "'JetBrains Mono', monospace", size: 11 },
};

const GRID_COLOR  = 'rgba(255,255,255,0.05)';
const TICK_COLOR  = '#475569';
const LEG_COLOR   = '#94a3b8';

function makeScales(opts = {}) {
    return {
        x: {
            grid: { color: GRID_COLOR },
            ticks: { color: TICK_COLOR, maxRotation: opts.xRot ?? 45, font: { size: 10 } },
            ...(opts.x || {})
        },
        y: {
            grid: { color: GRID_COLOR },
            ticks: { color: TICK_COLOR, ...(opts.yTickExtra || {}) },
            ...(opts.y || {})
        }
    };
}

function makeLegend() {
    return { labels: { color: LEG_COLOR, font: { size: 11 }, usePointStyle: true, pointStyleWidth: 12 } };
}

// =============================================================
//  INIT
// =============================================================
document.addEventListener("DOMContentLoaded", () => {
    buildInputs();
    buildDropdown();
    buildCompareDropdown();
    setupDragDrop();
    checkServerHealth();
    setupKeyboardShortcuts();
    setupSpeedSlider();

    // ── Deferred chart init: create charts when tab becomes visible ──
    // This fixes the "hidden canvas = zero size" Chart.js bug.
    const dashTab    = document.querySelector('#dashboard-tab');
    const compareTab = document.querySelector('#compare-tab');

    if (dashTab) {
        dashTab.addEventListener('shown.bs.tab', () => {
            if (!chartsInitialised) { initDashboardCharts(); chartsInitialised = true; }
            else { resizeCharts(); }
        });
    }
    if (compareTab) {
        compareTab.addEventListener('shown.bs.tab', () => {
            if (!cmpChartsInitialised) {
                initCompareCharts();
                cmpChartsInitialised = true;
            }
            // Always force a resize after the tab transition so the canvas
            // picks up its now-visible container width/height.
            requestAnimationFrame(() => resizeCmpCharts());
        });
    }
});

function resizeCharts() {
    [voltageChart, angleChart, lossChart, currentChart].forEach(c => c && c.resize());
}
function resizeCmpCharts() {
    [cmpVoltageChart, cmpQLossChart, cmpLossChart, cmpErrorChart].forEach(c => c && c.resize());
}

// =============================================================
//  KEYBOARD SHORTCUTS
// =============================================================
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
        if (['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)) return;
        if (e.key === 'ArrowLeft')  { e.preventDefault(); changeHour(-1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); changeHour(1);  }
        if (e.key === ' ')          { e.preventDefault(); toggleAutoPlay(); }
    });
}

function setupSpeedSlider() {
    const sl = document.getElementById('speed-slider');
    if (!sl) return;
    sl.addEventListener('input', () => {
        autoPlaySpeed = parseInt(sl.value);
        document.getElementById('speed-label').textContent = autoPlaySpeed + 'ms';
        if (autoPlayInterval) { clearInterval(autoPlayInterval); startAutoPlay(); }
    });
}

// =============================================================
//  BUILD P/Q INPUTS
// =============================================================
function buildInputs() {
    const container = document.getElementById('manual-inputs-container');
    let html = `<div class="input-section-label text-info fw-bold mb-2 col-12">
        <i class="fas fa-bolt me-1"></i>Active Power Injections (MW)</div>`;
    for (let i = 1; i <= 11; i++) {
        html += `<div class="col-md-2 col-4 mb-2">
            <label class="small text-info fw-semibold mb-1" id="lbl-P${i}">P<sub>${i}</sub></label>
            <input type="number" id="P${i}" class="form-control form-control-sm"
                   value="0.00" step="0.01" placeholder="MW">
        </div>`;
    }
    html += `<div class="input-section-label text-warning fw-bold mb-2 mt-2 col-12">
        <i class="fas fa-wave-square me-1"></i>Reactive Power Injections (MVAR)</div>`;
    for (let i = 1; i <= 11; i++) {
        html += `<div class="col-md-2 col-4 mb-2">
            <label class="small text-warning fw-semibold mb-1" id="lbl-Q${i}">Q<sub>${i}</sub></label>
            <input type="number" id="Q${i}" class="form-control form-control-sm"
                   value="0.00" step="0.01" placeholder="MVAR">
        </div>`;
    }
    container.innerHTML = html;
}

function applyLoadLocking(topoCode) {
    for (let i = 1; i <= 11; i++) {
        const p = document.getElementById(`P${i}`), q = document.getElementById(`Q${i}`);
        if (!p || !q) continue;
        p.disabled = false; p.classList.remove('input-locked');
        q.disabled = false; q.classList.remove('input-locked');
        document.getElementById(`lbl-P${i}`).classList.remove('text-muted');
        document.getElementById(`lbl-Q${i}`).classList.remove('text-muted');
    }
    const loadNum = CODE_TO_LOAD[parseInt(topoCode)];
    if (loadNum) {
        const p = document.getElementById(`P${loadNum}`), q = document.getElementById(`Q${loadNum}`);
        if (p && q) {
            p.value = "0.00"; p.disabled = true; p.classList.add('input-locked');
            q.value = "0.00"; q.disabled = true; q.classList.add('input-locked');
            document.getElementById(`lbl-P${loadNum}`).classList.add('text-muted');
            document.getElementById(`lbl-Q${loadNum}`).classList.add('text-muted');
        }
    }
}

// =============================================================
//  DROPDOWNS
// =============================================================
function buildDropdown() {
    const select = document.getElementById('topology-select');
    contingencyMapping.forEach(group => {
        const og = document.createElement('optgroup');
        og.label = group.group;
        group.options.forEach(opt => {
            const o = document.createElement('option');
            o.value = opt.value; o.text = opt.label;
            og.appendChild(o);
        });
        select.appendChild(og);
    });
}

function buildCompareDropdown() {
    const sel = document.getElementById('cmp-topology-select');
    if (!sel) return;
    contingencyMapping.forEach(group => {
        const og = document.createElement('optgroup');
        og.label = group.group;
        group.options.forEach(opt => {
            const o = document.createElement('option');
            o.value = opt.value; o.text = opt.label;
            og.appendChild(o);
        });
        sel.appendChild(og);
    });
    sel.addEventListener('change', () => applyCompareLocking(sel.value));
}

function applyCompareLocking(topoCode) {
    for (let i = 1; i <= 11; i++) {
        const p = document.getElementById(`cmp-P${i}`), q = document.getElementById(`cmp-Q${i}`);
        if (!p || !q) continue;
        p.disabled = false; p.classList.remove('input-locked');
        q.disabled = false; q.classList.remove('input-locked');
    }
    const loadNum = CODE_TO_LOAD[parseInt(topoCode)];
    if (loadNum) {
        const p = document.getElementById(`cmp-P${loadNum}`), q = document.getElementById(`cmp-Q${loadNum}`);
        if (p && q) {
            p.value = "0"; p.disabled = true; p.classList.add('input-locked');
            q.value = "0"; q.disabled = true; q.classList.add('input-locked');
        }
    }
}

// =============================================================
//  SERVER HEALTH
// =============================================================
async function checkServerHealth() {
    const indicator = document.getElementById('server-status');
    if (!indicator) return;
    try {
        const res  = await fetch('/health');
        const data = await res.json();
        if (data.ready) {
            const n = data.assets_loaded || 0;
            indicator.innerHTML = `<i class="fas fa-circle text-success me-1"></i><span class="text-success">Ready</span><span class="text-muted ms-2" style="font-size:0.68rem">(${n} assets)</span>`;
        } else {
            indicator.innerHTML = `<i class="fas fa-circle-notch fa-spin text-warning me-1"></i><span class="text-warning">Loading models…</span>`;
            setTimeout(checkServerHealth, 3000);
        }
    } catch {
        indicator.innerHTML = `<i class="fas fa-circle text-danger me-1"></i><span class="text-danger">Offline</span>`;
        setTimeout(checkServerHealth, 5000);
    }
}

// =============================================================
//  DRAG & DROP  (batch upload)
// =============================================================
function setupDragDrop() {
    const zone = document.getElementById('drop-zone');
    if (!zone) return;
    zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-active'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-active'));
    zone.addEventListener('drop', e => {
        e.preventDefault(); zone.classList.remove('drag-active');
        const file = e.dataTransfer.files[0];
        if (file) { document.getElementById('file-upload').files = e.dataTransfer.files; setFileName(file); }
    });
    document.getElementById('file-upload').addEventListener('change', e => {
        if (e.target.files[0]) setFileName(e.target.files[0]);
    });
}
function setFileName(file) {
    const el = document.getElementById('file-name-display');
    const kb = (file.size / 1024).toFixed(1);
    el.innerHTML = `<i class="fas fa-file-alt me-1"></i>${file.name} <span class="text-muted ms-1">(${kb} KB)</span>`;
}

// =============================================================
//  IMAGE + CONTINGENCY
// =============================================================
function updateImage() {
    const val = document.getElementById('topology-select').value;
    const img = document.getElementById('manual-topology-img');
    img.style.opacity = 0.3;
    setTimeout(() => { img.src = `/static/images/${val}.png`; img.style.opacity = 1; }, 150);
    applyLoadLocking(val);
}

function getTypeBadgeHTML(code) {
    const t = topoType[code] || 'base';
    const cfg = {
        base:  { cls:'badge-type-base',  icon:'fa-check-circle', text:'N-0'      },
        gen:   { cls:'badge-type-gen',   icon:'fa-bolt',         text:'Gen Trip' },
        line:  { cls:'badge-type-line',  icon:'fa-plug',         text:'Line Out' },
        load:  { cls:'badge-type-load',  icon:'fa-cube',         text:'Load Off' },
        shunt: { cls:'badge-type-shunt', icon:'fa-cogs',         text:'Shunt'    },
    }[t];
    return `<span class="badge ${cfg.cls} me-1"><i class="fas ${cfg.icon} me-1"></i>${cfg.text}</span>`;
}

// =============================================================
//  DASHBOARD CHARTS  (created lazily when tab is first shown)
// =============================================================
function initDashboardCharts() {

    // ── Voltage Profile ──────────────────────────────────────
    voltageChart = new Chart(document.getElementById('voltageChart'), {
        type: 'line',
        data: {
            labels: BUS_LABELS,
            datasets: [{
                label: 'Voltage (p.u.)',
                data: [],
                borderColor: '#06b6d4',
                backgroundColor: 'rgba(6,182,212,0.07)',
                fill: true,
                tension: 0.35,
                pointRadius: ctx => ctx.dataIndex === 0 ? 9 : 5,
                pointStyle:  ctx => ctx.dataIndex === 0 ? 'rectRot' : 'circle',
                pointBackgroundColor: ctx => {
                    if (ctx.dataIndex === 0) return '#22c55e';
                    const v = ctx.raw;
                    if (v == null) return '#06b6d4';
                    return (v < 0.95 || v > 1.05) ? '#f43f5e' : '#06b6d4';
                },
                pointBorderColor: 'transparent',
                pointHoverRadius: 8,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: makeLegend(),
                tooltip: {
                    ...SHARED_TOOLTIP,
                    callbacks: {
                        title: ctx => ctx[0].label,
                        label: ctx => {
                            const v = ctx.raw;
                            if (v == null) return '';
                            const slack = ctx.dataIndex === 0 ? '  [Slack Bus]' : '';
                            const viol  = (v < 0.95 || v > 1.05) ? '  ⚠ VIOLATION' : '';
                            return `  ${v.toFixed(5)} p.u.${slack}${viol}`;
                        },
                        afterBody: ctx => {
                            const v = ctx[0].raw;
                            if (v == null) return [];
                            if (v < 0.95) return [`  → ${((0.95-v)*100).toFixed(3)}% below lower limit`];
                            if (v > 1.05) return [`  → ${((v-1.05)*100).toFixed(3)}% above upper limit`];
                            return [`  → Within ANSI band (0.95–1.05 p.u.)`];
                        }
                    }
                },
                annotation: {
                    annotations: {
                        low:  { type:'line', yMin:0.95, yMax:0.95, borderColor:'rgba(244,63,94,0.4)', borderWidth:1, borderDash:[4,4], label:{content:'0.95 p.u.', enabled:true, position:'end', color:'#f43f5e', font:{size:9}} },
                        high: { type:'line', yMin:1.05, yMax:1.05, borderColor:'rgba(244,63,94,0.4)', borderWidth:1, borderDash:[4,4], label:{content:'1.05 p.u.', enabled:true, position:'end', color:'#f43f5e', font:{size:9}} },
                    }
                }
            },
            scales: { ...makeScales({ y: { min: 0.88, max: 1.12 }, yTickExtra: { callback: v => v.toFixed(2) } }) }
        }
    });

    // ── Phase Angles ─────────────────────────────────────────
    angleChart = new Chart(document.getElementById('angleChart'), {
        type: 'bar',
        data: {
            labels: BUS_LABELS,
            datasets: [{
                label: 'Phase Angle (°)',
                data: [],
                backgroundColor: ctx => {
                    if (ctx.dataIndex === 0) return 'rgba(34,197,94,0.8)';
                    const v = ctx.raw;
                    return v == null ? 'rgba(139,92,246,0.5)'
                         : v < 0    ? 'rgba(251,191,36,0.75)'
                                    : 'rgba(139,92,246,0.75)';
                },
                borderRadius: 4,
                hoverBackgroundColor: ctx => {
                    if (ctx.dataIndex === 0) return 'rgba(34,197,94,1)';
                    const v = ctx.raw;
                    return v < 0 ? 'rgba(251,191,36,1)' : 'rgba(139,92,246,1)';
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: makeLegend(),
                tooltip: {
                    ...SHARED_TOOLTIP,
                    callbacks: {
                        label: ctx => {
                            const v = ctx.raw;
                            const slack = ctx.dataIndex === 0 ? '  [Reference = 0°]' : '';
                            return `  ${v?.toFixed(4)}°${slack}`;
                        }
                    }
                }
            },
            scales: makeScales({ yTickExtra: { callback: v => v.toFixed(1) + '°' } })
        }
    });

    // ── P Loss per Line ──────────────────────────────────────
    lossChart = new Chart(document.getElementById('lossChart'), {
        type: 'bar',
        data: {
            labels: LINE_LABELS,
            datasets: [{
                label: 'Active P Loss (MW)',
                data: [],
                backgroundColor: ctx => {
                    const v = ctx.raw;
                    if (v == null || v === 0) return 'rgba(100,116,139,0.4)';
                    return v > 5  ? 'rgba(239,68,68,0.9)'
                         : v > 2  ? 'rgba(249,115,22,0.85)'
                                  : 'rgba(244,63,94,0.65)';
                },
                hoverBackgroundColor: ctx => {
                    const v = ctx.raw;
                    if (v == null || v === 0) return 'rgba(100,116,139,0.6)';
                    return v > 5  ? 'rgba(239,68,68,1)'
                         : v > 2  ? 'rgba(249,115,22,1)'
                                  : 'rgba(244,63,94,0.9)';
                },
                borderRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: makeLegend(),
                tooltip: {
                    ...SHARED_TOOLTIP,
                    callbacks: {
                        label: ctx => {
                            const v = ctx.raw;
                            if (v === 0) return '  0.0000 MW  [Line Out of Service]';
                            return `  ${v?.toFixed(4)} MW`;
                        }
                    }
                }
            },
            scales: {
                ...makeScales({ xRot: 55 }),
                y: { grid:{color:GRID_COLOR}, ticks:{color:TICK_COLOR, callback: v => v.toFixed(2)+' MW'}, min: 0 }
            }
        }
    });

    // ── Line Currents ────────────────────────────────────────
    currentChart = new Chart(document.getElementById('currentChart'), {
        type: 'bar',
        data: {
            labels: LINE_LABELS,
            datasets: [{
                label: 'Line Current (kA)',
                data: [],
                backgroundColor: ctx => {
                    const v = ctx.raw;
                    if (v == null || v === 0) return 'rgba(100,116,139,0.4)';
                    const ka = Math.abs(v);
                    return ka > 0.8 ? 'rgba(244,63,94,0.9)'
                         : ka > 0.4 ? 'rgba(245,158,11,0.85)'
                                    : 'rgba(34,197,94,0.65)';
                },
                hoverBackgroundColor: ctx => {
                    const v = ctx.raw;
                    if (v == null || v === 0) return 'rgba(100,116,139,0.6)';
                    const ka = Math.abs(v);
                    return ka > 0.8 ? 'rgba(244,63,94,1)'
                         : ka > 0.4 ? 'rgba(245,158,11,1)'
                                    : 'rgba(34,197,94,1)';
                },
                borderRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: makeLegend(),
                tooltip: {
                    ...SHARED_TOOLTIP,
                    callbacks: {
                        label: ctx => {
                            const v = ctx.raw;
                            if (v === 0) return '  0.0000 kA  [Line Out of Service]';
                            return `  ${Math.abs(v).toFixed(4)} kA`;
                        }
                    }
                }
            },
            scales: {
                ...makeScales({ xRot: 55 }),
                y: { grid:{color:GRID_COLOR}, ticks:{color:TICK_COLOR, callback: v => v.toFixed(3)+' kA'}, min: 0 }
            }
        }
    });
}

// =============================================================
//  COMPARE CHARTS  (created lazily when tab is first shown)
// =============================================================
function initCompareCharts() {

    // ── Voltage comparison ───────────────────────────────────
    cmpVoltageChart = new Chart(document.getElementById('cmpVoltageChart'), {
        type: 'line',
        data: {
            labels: BUS_LABELS,
            datasets: [
                {
                    label: 'ML Ensemble',
                    data: [],
                    borderColor: '#06b6d4',
                    backgroundColor: 'rgba(6,182,212,0.06)',
                    tension: 0.3, fill: false,
                    pointRadius: 5, pointHoverRadius: 8,
                    pointBackgroundColor: '#06b6d4',
                },
                {
                    label: 'Newton-Raphson',
                    data: [],
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245,158,11,0.06)',
                    tension: 0.3, fill: false,
                    borderDash: [6, 3],
                    pointRadius: 4, pointHoverRadius: 7,
                    pointBackgroundColor: '#f59e0b',
                    pointStyle: 'triangle',
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: true,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: makeLegend(),
                tooltip: {
                    ...SHARED_TOOLTIP,
                    callbacks: {
                        label: ctx => `  ${ctx.dataset.label}: ${ctx.raw?.toFixed(5)} p.u.`,
                        afterBody: ctx => {
                            const ml = ctx.find(c=>c.datasetIndex===0)?.raw;
                            const nr = ctx.find(c=>c.datasetIndex===1)?.raw;
                            if (ml!=null && nr!=null) return [`  |Error|: ${Math.abs(ml-nr).toFixed(6)} p.u.`];
                            return [];
                        }
                    }
                }
            },
            scales: {
                ...makeScales(),
                y: { grid:{color:GRID_COLOR}, ticks:{color:TICK_COLOR, callback: v=>v.toFixed(3)}, suggestedMin: 0.9, suggestedMax: 1.1 }
            }
        }
    });

    // ── Q-Loss comparison (per-line) ─────────────────────────
    cmpQLossChart = new Chart(document.getElementById('cmpQLossChart'), {
        type: 'bar',
        data: {
            labels: LINE_LABELS,
            datasets: [
                { label:'ML Ensemble',    data:[], backgroundColor:'rgba(139,92,246,0.65)', borderRadius:3, hoverBackgroundColor:'rgba(139,92,246,1)' },
                { label:'Newton-Raphson', data:[], backgroundColor:'rgba(245,158,11,0.65)', borderRadius:3, hoverBackgroundColor:'rgba(245,158,11,1)' }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: true,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: makeLegend(),
                tooltip: {
                    ...SHARED_TOOLTIP,
                    callbacks: {
                        label: ctx => `  ${ctx.dataset.label}: ${ctx.raw?.toFixed(4)} MVAR`,
                        afterBody: ctx => {
                            const ml = ctx.find(c=>c.datasetIndex===0)?.raw;
                            const nr = ctx.find(c=>c.datasetIndex===1)?.raw;
                            if (ml!=null && nr!=null) return [`  |Error|: ${Math.abs(ml-nr).toFixed(5)} MVAR`];
                            return [];
                        }
                    }
                }
            },
            scales: {
                ...makeScales({ xRot: 55 }),
                y: { grid:{color:GRID_COLOR}, ticks:{color:TICK_COLOR, callback:v=>v.toFixed(2)+' MVAR'} }
            }
        }
    });

    // ── P Loss comparison ────────────────────────────────────
    cmpLossChart = new Chart(document.getElementById('cmpLossChart'), {
        type: 'bar',
        data: {
            labels: LINE_LABELS,
            datasets: [
                { label:'ML Ensemble',    data:[], backgroundColor:'rgba(6,182,212,0.65)',  borderRadius:3, hoverBackgroundColor:'rgba(6,182,212,1)' },
                { label:'Newton-Raphson', data:[], backgroundColor:'rgba(245,158,11,0.65)', borderRadius:3, hoverBackgroundColor:'rgba(245,158,11,1)' }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: true,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: makeLegend(),
                tooltip: {
                    ...SHARED_TOOLTIP,
                    callbacks: {
                        label: ctx => `  ${ctx.dataset.label}: ${ctx.raw?.toFixed(4)} MW`,
                        afterBody: ctx => {
                            const ml = ctx.find(c=>c.datasetIndex===0)?.raw;
                            const nr = ctx.find(c=>c.datasetIndex===1)?.raw;
                            if (ml!=null && nr!=null) return [`  |Error|: ${Math.abs(ml-nr).toFixed(5)} MW`];
                            return [];
                        }
                    }
                }
            },
            scales: {
                ...makeScales({ xRot: 55 }),
                y: { grid:{color:GRID_COLOR}, ticks:{color:TICK_COLOR, callback:v=>v.toFixed(3)+' MW'}, min: 0 }
            }
        }
    });

    // ── Per-bus voltage error ────────────────────────────────
    cmpErrorChart = new Chart(document.getElementById('cmpErrorChart'), {
        type: 'bar',
        data: {
            labels: BUS_LABELS,
            datasets: [{
                label: '|ML − NR| Voltage Error (p.u.)',
                data: [],
                backgroundColor: ctx => {
                    const v = ctx.raw;
                    if (v == null) return 'rgba(244,63,94,0.5)';
                    return v > 0.005 ? 'rgba(244,63,94,0.9)'
                         : v > 0.001 ? 'rgba(245,158,11,0.85)'
                                     : 'rgba(34,197,94,0.7)';
                },
                hoverBackgroundColor: 'rgba(244,63,94,1)',
                borderRadius: 4,
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: true,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: makeLegend(),
                tooltip: {
                    ...SHARED_TOOLTIP,
                    callbacks: {
                        label: ctx => {
                            const v = ctx.raw;
                            const grade = v > 0.005 ? '⚠ High' : v > 0.001 ? '~ Moderate' : '✓ Low';
                            return `  ${v?.toFixed(6)} p.u.  [${grade}]`;
                        }
                    }
                }
            },
            scales: {
                ...makeScales(),
                y: { grid:{color:GRID_COLOR}, ticks:{color:TICK_COLOR, callback:v=>v.toFixed(4)}, min: 0 }
            }
        }
    });
}

// =============================================================
//  LOADING OVERLAY
// =============================================================
function startLoadingState(isBatch = false) {
    document.getElementById('global-loader').classList.remove('d-none');
    const texts = isBatch ? [
        "Reading uploaded dataset…",
        "Preprocessing feature matrix…",
        "Predicting Bus Voltages (V2–V14)…",
        "Estimating Phase Angles (θ2–θ14)…",
        "Calculating Sending-End Power Flows…",
        "Calculating Receiving-End Power Flows…",
        "Computing Line Currents…",
        "Aggregating system losses…",
        "Almost there…"
    ] : [
        "Preprocessing inputs…",
        "Predicting Bus Voltages…",
        "Estimating Phase Angles…",
        "Calculating Power Flows…",
        "Computing Line Currents…",
        "Finalizing results…"
    ];
    let idx = 0;
    const textEl = document.getElementById('loading-text');
    const barEl  = document.getElementById('loading-bar');
    textEl.textContent = texts[0];
    if (barEl) { barEl.style.width = '0%'; barEl.style.transition = 'none'; }
    if (loadingInterval) clearInterval(loadingInterval);
    loadingInterval = setInterval(() => {
        idx = Math.min(idx + 1, texts.length - 1);
        textEl.textContent = texts[idx];
        if (barEl) {
            barEl.style.transition = 'width 1.2s ease';
            barEl.style.width = Math.round(((idx + 1) / texts.length) * 90) + '%';
        }
    }, isBatch ? 1600 : 1200);
}

function stopLoadingState() {
    if (loadingInterval) clearInterval(loadingInterval);
    const barEl = document.getElementById('loading-bar');
    if (barEl) { barEl.style.transition = 'width 0.3s ease'; barEl.style.width = '100%'; }
    setTimeout(() => document.getElementById('global-loader').classList.add('d-none'), 350);
}

// =============================================================
//  API CALLS — INFERENCE
// =============================================================
async function submitSingle() {
    const features = [];
    for (let i = 1; i <= 11; i++) features.push(parseFloat(document.getElementById(`P${i}`).value) || 0);
    for (let i = 1; i <= 11; i++) features.push(parseFloat(document.getElementById(`Q${i}`).value) || 0);
    features.push(parseFloat(document.getElementById('topology-select').value));
    startLoadingState(false);
    try {
        const res = await fetch('/predict_single', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({features})
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Server error'); }
        processResults(await res.json());
    } catch(e) { showToast('❌ ' + e.message, 'danger'); console.error(e); }
    finally { stopLoadingState(); }
}

async function submitBatch() {
    const fi = document.getElementById('file-upload');
    if (!fi.files[0]) { showToast('Please select a file first.', 'warning'); return; }
    startLoadingState(true);
    const fd = new FormData(); fd.append("file", fi.files[0]);
    try {
        const res = await fetch('/predict_batch', {method:'POST', body:fd});
        if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Server error'); }
        processResults(await res.json());
    } catch(e) { showToast('❌ ' + e.message, 'danger'); console.error(e); }
    finally { stopLoadingState(); }
}

// =============================================================
//  API CALLS — COMPARE
// =============================================================
async function runComparison() {
    const features = [];
    for (let i = 1; i <= 11; i++) features.push(parseFloat(document.getElementById(`cmp-P${i}`)?.value) || 0);
    for (let i = 1; i <= 11; i++) features.push(parseFloat(document.getElementById(`cmp-Q${i}`)?.value) || 0);
    features.push(parseFloat(document.getElementById('cmp-topology-select').value));

    const btn   = document.getElementById('run-compare-btn');
    const panel = document.getElementById('compare-results-panel');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin me-2"></i>Running NR + ML…';
    panel.classList.add('d-none');

    try {
        const res = await fetch('/compare', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({features})
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Server error'); }
        const data = await res.json();

        // Reset all result panels before new run
        document.getElementById('compare-results-panel').classList.add('d-none');
        document.getElementById('nr-diverged-panel').classList.add('d-none');
        document.getElementById('cmp-tables-panel').classList.add('d-none');
        const hintEl = document.getElementById('cmp-charts-hint');
        if (hintEl) hintEl.style.display = '';

        // Clear hint text once any result comes in
        const hint = document.getElementById('cmp-charts-hint');
        if (hint) hint.style.display = 'none';

        if (data.nr_converged) {
            // Normal path: both ML and NR succeeded
            if (!cmpChartsInitialised) { initCompareCharts(); cmpChartsInitialised = true; }
            renderCompareResults(data);
            panel.classList.remove('d-none');
            document.getElementById('cmp-tables-panel').classList.remove('d-none');
            showToast('✅ Comparison complete', 'success', 3000);
        } else {
            // NR diverged — show ML-only panel, hide tables (no NR data to compare)
            if (!cmpChartsInitialised) { initCompareCharts(); cmpChartsInitialised = true; }
            renderNRDivergedPanel(data);
            renderCompareChartsMLOnly(data.ml);
            document.getElementById('nr-diverged-panel').classList.remove('d-none');
            document.getElementById('cmp-tables-panel').classList.add('d-none');
            showToast('⚠️ NR solver diverged — ML result shown only', 'warning', 5000);
        }
        // Scroll to charts (always visible)
        document.getElementById('cmp-charts-row').scrollIntoView({behavior:'smooth', block:'start'});
    } catch(e) {
        showToast('❌ ' + e.message, 'danger');
        console.error(e);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-balance-scale me-2"></i>Run Comparison';
    }
}

// =============================================================
//  RENDER COMPARE RESULTS
// =============================================================
function renderCompareResults(data) {
    const {ml, nr, errors, topology} = data;

    // Headline topology
    const tLabel = topoLabel[topology] || `Category ${topology}`;
    document.getElementById('cmp-topo-label').innerHTML =
        getTypeBadgeHTML(topology) + `<span class="text-info ms-1">${tLabel}</span>`;

    // Total P / Q loss
    document.getElementById('cmp-ml-total-p').textContent  = ml.Total_P_Loss.toFixed(4);
    document.getElementById('cmp-nr-total-p').textContent  = nr.Total_P_Loss.toFixed(4);
    document.getElementById('cmp-err-total-p').textContent = errors.total_p_loss_err.toFixed(4);
    document.getElementById('cmp-ml-total-q').textContent  = (ml.Total_Q_Loss ?? 0).toFixed(4);
    document.getElementById('cmp-nr-total-q').textContent  = (nr.Total_Q_Loss ?? 0).toFixed(4);
    document.getElementById('cmp-err-total-q').textContent = (errors.total_q_loss_err ?? 0).toFixed(4);

    // Error metric pills
    document.getElementById('cmp-v-mae').textContent   = errors.voltage.mae.toFixed(5);
    document.getElementById('cmp-v-rmse').textContent  = errors.voltage.rmse.toFixed(5);
    document.getElementById('cmp-v-max').textContent   = errors.voltage.max_err.toFixed(5);
    document.getElementById('cmp-p-mae').textContent   = errors.p_loss.mae.toFixed(4);
    document.getElementById('cmp-p-rmse').textContent  = errors.p_loss.rmse.toFixed(4);
    document.getElementById('cmp-q-mae').textContent   = (errors.q_loss?.mae ?? 0).toFixed(4);

    // Voltage accuracy bar
    const pct = Math.max(0, 100 - errors.voltage.mae * 100);
    document.getElementById('cmp-accuracy-pct').textContent = pct.toFixed(3) + '%';
    document.getElementById('cmp-accuracy-bar').style.width = Math.min(100, pct) + '%';

    // ── Charts ──
    // Defensive: if for any reason charts weren't created yet, do it now.
    if (!cmpChartsInitialised) { initCompareCharts(); cmpChartsInitialised = true; }

    const mlV = [1.06, ...ml.V2_V14];
    const nrV = nr.V_all;
    if (cmpVoltageChart) {
        cmpVoltageChart.data.datasets[0].data = mlV;
        cmpVoltageChart.data.datasets[1].data = nrV;
        cmpVoltageChart.resize();
        cmpVoltageChart.update();
    }

    if (cmpQLossChart) {
        cmpQLossChart.data.datasets[0].data = (ml.Q_loss || []).slice(0, 15);
        cmpQLossChart.data.datasets[1].data = (nr.Q_loss || []).slice(0, 15);
        cmpQLossChart.resize();
        cmpQLossChart.update();
    }

    if (cmpLossChart) {
        cmpLossChart.data.datasets[0].data = ml.P_loss.slice(0, 15);
        cmpLossChart.data.datasets[1].data = nr.P_loss.slice(0, 15);
        cmpLossChart.resize();
        cmpLossChart.update();
    }

    if (cmpErrorChart) {
        cmpErrorChart.data.datasets[0].data = errors.voltage.per_bus;
        cmpErrorChart.resize();
        cmpErrorChart.update();
    }

    // ── Line Currents table ──
    const ctbody = document.getElementById('cmp-current-table-body');
    if (ctbody && ml.Line_Currents && nr.Line_Currents) {
        ctbody.innerHTML = '';
        for (let i = 0; i < 15; i++) {
            const mc = ml.Line_Currents[i] ?? 0;
            const nc = nr.Line_Currents[i] ?? 0;
            const err = Math.abs(mc - nc);
            const errCls = err > 0.05 ? 'text-danger' : err > 0.01 ? 'text-warning' : 'text-success';
            const isOut  = (mc === 0 && nc === 0);
            ctbody.innerHTML += `<tr ${isOut ? 'style="opacity:0.4"' : ''}>
                <td class="text-muted" style="font-family:monospace">${LINE_LABELS[i]}
                    ${isOut ? ' <span class="badge badge-type-line" style="font-size:0.6rem">OUT</span>' : ''}</td>
                <td style="font-family:monospace;color:#06b6d4">${Math.abs(mc).toFixed(4)}</td>
                <td style="font-family:monospace;color:#f59e0b">${Math.abs(nc).toFixed(4)}</td>
                <td class="${errCls}" style="font-family:monospace">${err.toFixed(5)}</td>
            </tr>`;
        }
    }

    // ── Per-bus voltage table ──
    const tbody = document.getElementById('cmp-voltage-table-body');
    tbody.innerHTML = '';
    for (let i = 0; i < 14; i++) {
        const mv = mlV[i], nv = nrV[i], err = Math.abs(mv - nv);
        const errCls = err > 0.005 ? 'text-danger' : err > 0.001 ? 'text-warning' : 'text-success';
        tbody.innerHTML += `<tr>
            <td class="text-muted" style="font-family:monospace">Bus ${i+1}
                ${i===0 ? ' <span class="badge badge-type-base" style="font-size:0.6rem">Slack</span>' : ''}
            </td>
            <td style="font-family:monospace;color:#06b6d4">${mv.toFixed(5)}</td>
            <td style="font-family:monospace;color:#f59e0b">${nv.toFixed(5)}</td>
            <td class="${errCls}" style="font-family:monospace">${err.toFixed(6)}</td>
        </tr>`;
    }
}

// =============================================================
//  COMPARE CHARTS — ML-only fallback (NR diverged)
// =============================================================
function renderCompareChartsMLOnly(ml) {
    if (!cmpChartsInitialised) { initCompareCharts(); cmpChartsInitialised = true; }
    const mlV = [1.06, ...ml.V2_V14];
    const zeros14 = new Array(14).fill(null);
    const zeros15 = new Array(15).fill(null);

    if (cmpVoltageChart) {
        cmpVoltageChart.data.datasets[0].data = mlV;
        cmpVoltageChart.data.datasets[1].data = zeros14;
        cmpVoltageChart.resize();
        cmpVoltageChart.update();
    }
    if (cmpQLossChart) {
        cmpQLossChart.data.datasets[0].data = (ml.Q_loss || []).slice(0, 15);
        cmpQLossChart.data.datasets[1].data = zeros15;
        cmpQLossChart.resize();
        cmpQLossChart.update();
    }
    if (cmpLossChart) {
        cmpLossChart.data.datasets[0].data = ml.P_loss.slice(0, 15);
        cmpLossChart.data.datasets[1].data = zeros15;
        cmpLossChart.resize();
        cmpLossChart.update();
    }
    if (cmpErrorChart) {
        cmpErrorChart.data.datasets[0].data = zeros14;
        cmpErrorChart.resize();
        cmpErrorChart.update();
    }
}

// =============================================================
//  NR DIVERGED — ML-ONLY PANEL
// =============================================================
function renderNRDivergedPanel(data) {
    const {ml, nr_error, topology} = data;

    document.getElementById('nr-diverged-error-msg').textContent = nr_error || 'Unknown solver error';
    document.getElementById('nd-ml-p-loss').textContent = ml.Total_P_Loss.toFixed(4) + ' MW';
    document.getElementById('nd-topo-label').innerHTML = getTypeBadgeHTML(topology) +
        `<span class="text-info ms-1">${topoLabel[topology] || `Cat. ${topology}`}</span>`;

    const viol = ml.voltage_violations || [];
    const violEl = document.getElementById('nd-violations');
    if (viol.length === 0) {
        violEl.innerHTML = '<span class="text-success"><i class="fas fa-check-circle me-1"></i>None</span>';
    } else {
        violEl.innerHTML = `<span class="text-danger"><i class="fas fa-exclamation-triangle me-1"></i>${viol.length} bus(es)</span>`;
    }

    // Per-bus voltage + angle table
    const mlV = [1.06, ...ml.V2_V14];
    const mlA = [0.0,  ...ml.Angle_2_14];
    const tbody = document.getElementById('nd-voltage-table-body');
    tbody.innerHTML = '';
    for (let i = 0; i < 14; i++) {
        const v = mlV[i], a = mlA[i];
        const viol_flag = (v < 0.95 || v > 1.05);
        const vCls = viol_flag ? 'text-danger' : 'text-success';
        const status = i === 0 ? '<span class="badge badge-type-base" style="font-size:0.6rem">Slack</span>'
                     : viol_flag ? '<span class="badge badge-violation-low" style="font-size:0.6rem">⚠ Violation</span>'
                                 : '<span style="color:#22c55e;font-size:0.75rem">✓ OK</span>';
        tbody.innerHTML += `<tr>
            <td class="text-muted" style="font-family:monospace">Bus ${i+1}</td>
            <td class="${vCls}" style="font-family:monospace">${v.toFixed(5)}</td>
            <td style="font-family:monospace;color:#8b5cf6">${a.toFixed(4)}°</td>
            <td>${status}</td>
        </tr>`;
    }
}

// =============================================================
//  RESULTS PROCESSING
// =============================================================
function processResults(data) {
    globalResults = data.data;
    const total   = data.total_hours;

    // Ensure dashboard charts are initialised before we push data into them
    if (!chartsInitialised) { initDashboardCharts(); chartsInitialised = true; }

    bootstrap.Tab.getOrCreateInstance(document.querySelector('#dashboard-tab')).show();

    const slider = document.getElementById('hour-slider');
    const tsCtrl = document.getElementById('ts-controller');
    if (total > 1) {
        tsCtrl.classList.remove('d-none');
        slider.max = total;
        document.getElementById('total-hours-display').textContent = total;
    } else {
        tsCtrl.classList.add('d-none');
    }

    if (total > 1) renderBatchSummary(globalResults);
    else           document.getElementById('batch-summary').classList.add('d-none');

    document.querySelectorAll('.export-btn').forEach(b => b.classList.remove('d-none'));
    updateDashboardForHour(1);

    const viol = globalResults.filter(r => r.has_violations).length;
    if (viol > 0) showToast(`⚠️ Voltage violations in ${viol}/${total} hour(s).`, 'warning', 6000);
    else          showToast(`✅ Done — ${total} hour(s) processed. All voltages nominal.`, 'success', 4000);
}

// =============================================================
//  BATCH SUMMARY
// =============================================================
function renderBatchSummary(results) {
    document.getElementById('batch-summary').classList.remove('d-none');
    const allP  = results.map(r => r.Total_P_Loss);
    const viol  = results.filter(r => r.has_violations).length;
    const worst = results.reduce((a, b) => a.Total_P_Loss > b.Total_P_Loss ? a : b);
    const best  = results.reduce((a, b) => a.Total_P_Loss < b.Total_P_Loss ? a : b);
    const avgP  = allP.reduce((a, b) => a + b, 0) / allP.length;

    document.getElementById('bs-avg-p').textContent = avgP.toFixed(3);

    const violEl = document.getElementById('bs-violations');
    violEl.textContent = viol;
    violEl.className   = viol > 0 ? 'stat-value text-danger' : 'stat-value text-success';

    document.getElementById('bs-worst-hour').textContent = `Hour ${worst.hour}`;
    document.getElementById('bs-worst-val').textContent  = worst.Total_P_Loss.toFixed(3) + ' MW';
    document.getElementById('bs-best-hour').textContent  = `Hour ${best.hour}`;
    document.getElementById('bs-best-val').textContent   = best.Total_P_Loss.toFixed(3) + ' MW';

    const worstCard = document.getElementById('stat-worst-card');
    const bestCard  = document.getElementById('stat-best-card');
    if (worstCard) { worstCard.style.cursor='pointer'; worstCard.title=`Jump to Hour ${worst.hour}`; worstCard.onclick=()=>jumpToHour(worst.hour); }
    if (bestCard)  { bestCard.style.cursor='pointer';  bestCard.title=`Jump to Hour ${best.hour}`;  bestCard.onclick=()=>jumpToHour(best.hour); }
}

// =============================================================
//  HOUR NAVIGATION
// =============================================================
function jumpToHour(hour) {
    const slider = document.getElementById('hour-slider');
    if (!slider) return;
    slider.value = hour;
    updateDashboardForHour(hour);
    bootstrap.Tab.getOrCreateInstance(document.querySelector('#dashboard-tab')).show();
    showToast(`⏩ Jumped to Hour ${hour}`, 'info', 2000);
}

function jumpToHourInput() {
    const inp = document.getElementById('jump-hour-input');
    if (!inp || !globalResults.length) return;
    const h = parseInt(inp.value), max = globalResults.length;
    if (isNaN(h) || h < 1 || h > max) { showToast(`Enter a valid hour (1–${max})`, 'warning', 2500); return; }
    jumpToHour(h);
    inp.value = '';
}

function changeHour(dir) {
    const slider = document.getElementById('hour-slider');
    if (!slider || slider.classList.contains('d-none')) return;
    const next = Math.max(1, Math.min(parseInt(slider.max), parseInt(slider.value) + dir));
    slider.value = next;
    updateDashboardForHour(next);
}

function updateDashboardForHour(hour) {
    const idx = parseInt(hour) - 1;
    const d   = globalResults[idx];
    if (!d) return;

    document.getElementById('hour-slider').value = hour;
    document.getElementById('current-hour-display').textContent = hour;
    document.getElementById('sum-hour').textContent = hour;

    document.getElementById('topology-img').src = `/static/images/${d.topology_category}.png`;
    document.getElementById('topo-label').innerHTML =
        getTypeBadgeHTML(d.topology_category) +
        `<span class="text-info">${topoLabel[d.topology_category] || `Cat. ${d.topology_category}`}</span>`;

    document.getElementById('sum-p-loss').textContent = d.Total_P_Loss.toFixed(4);
    const qEl = document.getElementById('sum-q-loss');
    if (qEl) qEl.textContent = (d.Total_Q_Loss ?? 0).toFixed(4);

    renderViolations(d.voltage_violations || []);

    if (voltageChart) {
        voltageChart.data.datasets[0].data = [1.06, ...d.V2_V14];
        voltageChart.update('active');
    }
    if (angleChart) {
        angleChart.data.datasets[0].data = [0.0, ...d.Angle_2_14];
        angleChart.update('active');
    }
    if (lossChart) {
        lossChart.data.datasets[0].data = d.P_loss.slice(0, 15);
        lossChart.update('active');
    }
    if (currentChart && d.Line_Currents) {
        currentChart.data.datasets[0].data = d.Line_Currents.slice(0, 15).map(v => Math.abs(v));
        currentChart.update('active');
    }

    // Highest loss line annotation
    const losses = d.P_loss.slice(0, 15);
    const maxIdx = losses.indexOf(Math.max(...losses));
    const mlEl   = document.getElementById('most-loaded-line');
    if (mlEl && maxIdx >= 0) {
        mlEl.innerHTML = `<i class="fas fa-exclamation-circle text-warning me-1"></i>
            Highest loss: <strong class="text-warning">${LINE_LABELS[maxIdx]}</strong>
            <span class="loss-mw-value ms-2">${losses[maxIdx].toFixed(4)} MW</span>`;
    }

    // Highest current line
    const currents = d.Line_Currents ? d.Line_Currents.slice(0,15).map(v=>Math.abs(v)) : [];
    const maxCurr  = currents.indexOf(Math.max(...currents));
    const clEl     = document.getElementById('most-loaded-current');
    if (clEl && maxCurr >= 0) {
        clEl.innerHTML = `<i class="fas fa-bolt text-info me-1"></i>
            Highest current: <strong class="text-info">${LINE_LABELS[maxCurr]}</strong>
            <span class="ms-2" style="font-family:monospace;color:#94a3b8">${currents[maxCurr].toFixed(4)} kA</span>`;
    }
}

// =============================================================
//  VIOLATIONS
// =============================================================
function renderViolations(violations) {
    const box = document.getElementById('violation-box');
    if (!violations.length) {
        box.innerHTML = `<span class="text-success"><i class="fas fa-check-circle me-1"></i>All buses within ANSI (0.95–1.05 p.u.)</span>`;
        return;
    }
    const items = violations.map(v => {
        const isLow = v.type === 'low';
        return `<span class="badge ${isLow?'badge-violation-low':'badge-violation-high'} me-1 mb-1">
            <i class="fas ${isLow?'fa-arrow-down':'fa-arrow-up'} me-1"></i>${v.bus}: ${v.value}
        </span>`;
    }).join('');
    box.innerHTML = `<div class="text-danger fw-bold mb-1"><i class="fas fa-exclamation-triangle me-1"></i>${violations.length} violation(s)</div><div>${items}</div>`;
}

// =============================================================
//  AUTO-PLAY
// =============================================================
function startAutoPlay() {
    autoPlayInterval = setInterval(() => {
        const slider = document.getElementById('hour-slider');
        let next = parseInt(slider.value) + 1;
        if (next > parseInt(slider.max)) next = 1;
        updateDashboardForHour(next);
    }, autoPlaySpeed);
}

function toggleAutoPlay() {
    const btn = document.getElementById('autoplay-btn');
    if (autoPlayInterval) {
        clearInterval(autoPlayInterval); autoPlayInterval = null;
        btn.innerHTML = '<i class="fas fa-play me-1"></i>Auto';
        btn.classList.replace('btn-warning', 'btn-outline-warning');
    } else {
        btn.innerHTML = '<i class="fas fa-pause me-1"></i>Pause';
        btn.classList.replace('btn-outline-warning', 'btn-warning');
        startAutoPlay();
    }
}

// =============================================================
//  EXPORT CSV
// =============================================================
function exportResults() {
    if (!globalResults.length) return;
    const header = [
        'Hour','Topology_Code','Topology_Label','Contingency_Type',
        'Total_P_Loss_MW','Has_Violations','Violation_Details',
        'V1_pu', ...Array.from({length:13}, (_,i) => `V${i+2}_pu`),
        'Angle1_deg', ...Array.from({length:13}, (_,i) => `Angle${i+2}_deg`),
        ...LINE_LABELS.map(l => `PLoss_${l.replace(/[\s()]/g,'_')}_MW`),
        ...LINE_LABELS.map(l => `ICurrent_${l.replace(/[\s()]/g,'_')}_kA`),
    ];
    const rows = [header];
    globalResults.forEach(r => {
        const viols = (r.voltage_violations||[]).map(v=>`${v.bus}=${v.value}`).join(';') || 'None';
        rows.push([
            r.hour, r.topology_category,
            `"${topoLabel[r.topology_category]||r.topology_category}"`,
            topoType[r.topology_category]||'unknown',
            r.Total_P_Loss.toFixed(4),
            r.has_violations ? 'YES' : 'NO', `"${viols}"`,
            '1.06000', ...r.V2_V14.map(v => v.toFixed(5)),
            '0.00000', ...r.Angle_2_14.map(a => a.toFixed(5)),
            ...r.P_loss.slice(0,15).map(l => l.toFixed(5)),
            ...(r.Line_Currents||[]).slice(0,15).map(c => Math.abs(c).toFixed(5)),
        ]);
    });
    const csv  = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv'});
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `ieee14_loadflow_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    showToast('📥 Results exported to CSV (+ line currents added)!', 'success');
}

// =============================================================
//  COMPARE FILE UPLOAD
// =============================================================
function handleCmpDrop(e) {
    e.preventDefault();
    document.getElementById('cmp-drop-zone').style.borderColor = 'rgba(139,92,246,0.35)';
    const file = e.dataTransfer.files[0];
    if (file) { document.getElementById('cmp-file-upload').files = e.dataTransfer.files; setCmpFileName(file); }
}
function setCmpFileName(file) {
    const el = document.getElementById('cmp-file-name');
    if (!el || !file) return;
    el.textContent = `${file.name}  (${(file.size/1024).toFixed(1)} KB)`;
}

async function runBatchCompare() {
    const fi = document.getElementById('cmp-file-upload');
    if (!fi || !fi.files[0]) { showToast('Please select a file first.', 'warning'); return; }
    const statusEl  = document.getElementById('cmp-batch-status');
    const resultsEl = document.getElementById('cmp-batch-results');
    statusEl.innerHTML = '<i class="fas fa-circle-notch fa-spin me-1 text-info"></i>Running NR + ML on up to 10 rows…';
    resultsEl.classList.add('d-none');
    const fd = new FormData(); fd.append('file', fi.files[0]);
    try {
        const res = await fetch('/compare_batch', {method:'POST', body:fd});
        if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Server error'); }
        const data = await res.json();
        renderBatchCompareTable(data);
        statusEl.innerHTML = `<i class="fas fa-check-circle me-1 text-success"></i>Compared ${data.rows_used} / ${data.total_rows_in_file} rows.`;
        resultsEl.classList.remove('d-none');
    } catch(e) {
        statusEl.innerHTML = `<i class="fas fa-times-circle me-1 text-danger"></i>${e.message}`;
        showToast('❌ ' + e.message, 'danger');
    }
}

function renderBatchCompareTable(data) {
    const tbody = document.getElementById('cmp-batch-tbody');
    tbody.innerHTML = '';

    let convergedCount = 0, divergedCount = 0;
    const divergedRows = [];
    let firstConvergedRow = null;
    let firstConvergedIdx = -1;

    data.data.forEach((row, i) => {
        if (!row.nr_converged) {
            divergedCount++;
            divergedRows.push({row, idx: i});
            // Diverged row — show ML result + NR failure indicator
            tbody.innerHTML += `<tr style="background:rgba(245,158,11,0.04);cursor:pointer"
                                    data-row-idx="${i}" data-converged="0">
                <td class="text-muted">${i+1}</td>
                <td>${getTypeBadgeHTML(row.topology)}</td>
                <td style="font-family:monospace;color:#06b6d4">${row.ml.Total_P_Loss.toFixed(4)}</td>
                <td style="font-family:monospace">
                    <span class="badge" style="background:rgba(245,158,11,0.2);color:#fcd34d;border:1px solid rgba(245,158,11,0.35);font-size:0.7rem">
                        <i class="fas fa-exclamation-triangle me-1"></i>Diverged
                    </span>
                </td>
                <td class="text-muted" style="font-family:monospace">—</td>
                <td style="font-family:monospace;color:#8b5cf6">${(row.ml.Total_Q_Loss ?? 0).toFixed(4)}</td>
                <td class="text-muted" style="font-family:monospace">—</td>
                <td class="text-muted" style="font-family:monospace">—</td>
                <td class="text-muted" style="font-family:monospace">—</td>
            </tr>`;
            return;
        }
        convergedCount++;
        if (firstConvergedRow === null) { firstConvergedRow = row; firstConvergedIdx = i; }
        const {ml, nr, errors, topology} = row;
        const pErr = errors.total_p_loss_err;
        const qErr = errors.total_q_loss_err ?? 0;
        const pCls = pErr > 1 ? 'text-danger' : pErr > 0.1 ? 'text-warning' : 'text-success';
        const qCls = qErr > 1 ? 'text-danger' : qErr > 0.1 ? 'text-warning' : 'text-success';
        const vCls = errors.voltage.mae > 0.005 ? 'text-danger' : errors.voltage.mae > 0.001 ? 'text-warning' : 'text-success';
        tbody.innerHTML += `<tr style="cursor:pointer" data-row-idx="${i}" data-converged="1">
            <td class="text-muted">${i+1}</td>
            <td>${getTypeBadgeHTML(topology)}</td>
            <td style="font-family:monospace;color:#06b6d4">${ml.Total_P_Loss.toFixed(4)}</td>
            <td style="font-family:monospace;color:#f59e0b">${nr.Total_P_Loss.toFixed(4)}</td>
            <td class="${pCls}" style="font-family:monospace">${pErr.toFixed(4)}</td>
            <td style="font-family:monospace;color:#8b5cf6">${(ml.Total_Q_Loss ?? 0).toFixed(4)}</td>
            <td style="font-family:monospace;color:#f59e0b">${(nr.Total_Q_Loss ?? 0).toFixed(4)}</td>
            <td class="${qCls}" style="font-family:monospace">${qErr.toFixed(4)}</td>
            <td class="${vCls}" style="font-family:monospace">${errors.voltage.mae.toFixed(5)}</td>
        </tr>`;
    });

    // Wire row clicks so the user can pivot the comparison charts to any row.
    tbody.querySelectorAll('tr[data-row-idx]').forEach(tr => {
        tr.addEventListener('click', () => {
            const idx = parseInt(tr.getAttribute('data-row-idx'), 10);
            const r = data.data[idx];
            if (!r) return;
            tbody.querySelectorAll('tr').forEach(x => x.classList.remove('table-active'));
            tr.classList.add('table-active');
            if (r.nr_converged) {
                renderCompareResults(r);
                document.getElementById('compare-results-panel').classList.remove('d-none');
                document.getElementById('cmp-tables-panel').classList.remove('d-none');
                document.getElementById('nr-diverged-panel').classList.add('d-none');
            } else {
                renderCompareChartsMLOnly(r.ml);
                renderNRDivergedPanel({ml: r.ml, nr_error: r.nr_error, topology: r.topology});
                document.getElementById('compare-results-panel').classList.add('d-none');
                document.getElementById('cmp-tables-panel').classList.add('d-none');
                document.getElementById('nr-diverged-panel').classList.remove('d-none');
            }
        });
    });

    // Auto-populate the always-visible chart placeholders with the first
    // converged row (or fall back to ML-only on the first row when all diverged).
    const hint = document.getElementById('cmp-charts-hint');
    if (hint) hint.style.display = 'none';
    if (firstConvergedRow) {
        renderCompareResults(firstConvergedRow);
        document.getElementById('compare-results-panel').classList.remove('d-none');
        document.getElementById('cmp-tables-panel').classList.remove('d-none');
        document.getElementById('nr-diverged-panel').classList.add('d-none');
        const tr = tbody.querySelector(`tr[data-row-idx="${firstConvergedIdx}"]`);
        if (tr) tr.classList.add('table-active');
    } else if (data.data.length > 0) {
        const r0 = data.data[0];
        renderCompareChartsMLOnly(r0.ml);
        renderNRDivergedPanel({ml: r0.ml, nr_error: r0.nr_error, topology: r0.topology});
        document.getElementById('nr-diverged-panel').classList.remove('d-none');
    }

    // If any NR divergences, show the ML-advantage callout section
    renderDivergenceCallout(divergedRows, convergedCount, divergedCount);
}

function renderDivergenceCallout(divergedRows, convergedCount, divergedCount) {
    // Remove old callout if any
    const existing = document.getElementById('cmp-divergence-callout');
    if (existing) existing.remove();
    if (divergedCount === 0) return;

    const container = document.getElementById('cmp-batch-results');
    const callout = document.createElement('div');
    callout.id = 'cmp-divergence-callout';
    callout.className = 'mt-4';
    callout.innerHTML = `
        <div class="glass-card p-4" style="border-left:4px solid #f59e0b">
            <div class="d-flex align-items-start gap-3 mb-3">
                <div class="flex-shrink-0" style="width:44px;height:44px;border-radius:10px;background:rgba(245,158,11,0.15);display:flex;align-items:center;justify-content:center">
                    <i class="fas fa-shield-alt text-warning fa-lg"></i>
                </div>
                <div class="flex-grow-1">
                    <h6 class="text-warning mb-1" style="font-weight:800">
                        ML Model Advantage — NR Divergence Analysis
                    </h6>
                    <p class="mb-0" style="color:#94a3b8;font-size:0.85rem">
                        Newton-Raphson failed to converge for <strong class="text-warning">${divergedCount}</strong> of ${convergedCount + divergedCount} scenarios
                        in this batch. The ML ensemble produced valid predictions for <strong class="text-info">all ${convergedCount + divergedCount} scenarios</strong>
                        — demonstrating a key advantage of data-driven approaches over traditional iterative solvers
                        under extreme or ill-conditioned operating conditions.
                    </p>
                </div>
                <div class="text-end flex-shrink-0">
                    <div style="font-size:0.68rem;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">ML Coverage</div>
                    <div class="fw-bold text-info" style="font-family:'JetBrains Mono',monospace;font-size:1.4rem">100%</div>
                    <div style="font-size:0.68rem;color:#64748b">NR Coverage: ${Math.round(convergedCount/(convergedCount+divergedCount)*100)}%</div>
                </div>
            </div>

            <div style="font-size:0.72rem;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.75rem">
                <i class="fas fa-robot me-1 text-info"></i>ML Predictions for Diverged NR Scenarios
            </div>
            <div class="table-responsive">
                <table class="table table-dark compare-table table-hover mb-0">
                    <thead>
                        <tr>
                            <th>Row</th>
                            <th>Topology</th>
                            <th style="color:#06b6d4">ML Total P Loss (MW)</th>
                            <th style="color:#06b6d4">ML V2 (p.u.)</th>
                            <th style="color:#06b6d4">ML V14 (p.u.)</th>
                            <th style="color:#94a3b8">Voltage Violations</th>
                            <th style="color:#f43f5e">NR Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${divergedRows.map(({row, idx}) => {
                            const ml = row.ml;
                            const viol = (ml.voltage_violations||[]).length;
                            const v2   = ml.V2_V14[0]?.toFixed(5) ?? '—';
                            const v14  = ml.V2_V14[12]?.toFixed(5) ?? '—';
                            const violHtml = viol === 0
                                ? '<span class="text-success" style="font-size:0.8rem">✓ None</span>'
                                : `<span class="text-danger" style="font-size:0.8rem">⚠ ${viol} bus(es)</span>`;
                            const errTip = row.nr_error ? row.nr_error.replace(/"/g,"'").substring(0,80) : 'Solver diverged';
                            return `<tr style="background:rgba(245,158,11,0.03)">
                                <td class="text-muted">${idx+1}</td>
                                <td>${getTypeBadgeHTML(row.topology)}</td>
                                <td style="font-family:monospace;color:#06b6d4">${ml.Total_P_Loss.toFixed(4)}</td>
                                <td style="font-family:monospace;color:#06b6d4">${v2}</td>
                                <td style="font-family:monospace;color:#06b6d4">${v14}</td>
                                <td>${violHtml}</td>
                                <td><span class="badge" style="background:rgba(244,63,94,0.2);color:#fca5a5;border:1px solid rgba(244,63,94,0.35);font-size:0.7rem" title="${errTip}">
                                    <i class="fas fa-times me-1"></i>Diverged
                                </span></td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
    container.appendChild(callout);
}

// =============================================================
//  TOAST
// =============================================================
function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    const colorMap  = {success:'bg-success', danger:'bg-danger', warning:'bg-warning text-dark', info:'bg-info text-dark'};
    const el = document.createElement('div');
    el.className = `toast align-items-center text-white border-0 ${colorMap[type]||'bg-secondary'}`;
    el.setAttribute('role', 'alert');
    el.innerHTML = `<div class="d-flex"><div class="toast-body fw-semibold">${message}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
    container.appendChild(el);
    new bootstrap.Toast(el, {delay: duration}).show();
    el.addEventListener('hidden.bs.toast', () => el.remove());
}