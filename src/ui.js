import { getOrbitalShell } from './orbital.js';

// ── DOM element cache ────────────────────────────────────────────────────────
const el = {
  selectA: document.getElementById('select-object-a'),
  selectB: document.getElementById('select-object-b'),
  triggerBtn: document.getElementById('trigger-btn'),
  resetBtn: document.getElementById('reset-btn'),
  statTotal: document.getElementById('stat-total'),
  statDebris: document.getElementById('stat-debris'),
  statCascades: document.getElementById('stat-cascades'),
  statTime: document.getElementById('stat-time'),
  cascadeLog: document.getElementById('cascade-log'),
  logEntries: document.getElementById('log-entries'),
  loading: document.getElementById('loading'),
  loadingText: document.getElementById('loading-text'),
  tooltip: document.getElementById('tooltip'),
  instructions: document.getElementById('instructions'),
  warning: document.getElementById('warning'),
};

/**
 * Populate the two object-selection dropdowns.
 */
export function populateDropdowns(satellites) {
  el.selectA.innerHTML = '';
  el.selectB.innerHTML = '';
  satellites.forEach((sat, i) => {
    const optA = document.createElement('option');
    optA.value = i;
    optA.textContent = sat.name;
    el.selectA.appendChild(optA);

    const optB = document.createElement('option');
    optB.value = i;
    optB.textContent = sat.name;
    el.selectB.appendChild(optB);
  });
  if (satellites.length > 1) el.selectB.selectedIndex = 1;
}

/**
 * Update the statistics panel.
 */
export function updateStats(stats) {
  el.statTotal.textContent = stats.totalSatellites;
  el.statDebris.textContent = stats.totalDebris;
  el.statCascades.textContent = stats.cascadeCount;
  el.statTime.textContent = stats.simTime.toFixed(0) + 's';
}

/**
 * Add a message to the cascade log.
 */
export function addLog(msg, isWarning = false) {
  const div = document.createElement('div');
  div.style.color = isWarning ? '#ff4' : '#f88';
  div.textContent = `${new Date().toLocaleTimeString()} \u2014 ${msg}`;
  el.logEntries.appendChild(div);
  el.logEntries.scrollTop = el.logEntries.scrollHeight;
  el.cascadeLog.style.display = 'block';
}

/**
 * Show the hover tooltip for a satellite.
 */
export function showTooltip(sat) {
  const altKm = sat.pos ? sat.pos.alt.toFixed(0) : '\u2014';
  const shell = sat.pos ? getOrbitalShell(sat.pos.alt) : '\u2014';
  el.tooltip.innerHTML = `
    <div style="color:#0ff;font-size:12px;font-weight:bold;margin-bottom:4px">${sat.name}</div>
    <div style="color:#aaa;font-size:10px;margin-bottom:6px">${sat.desc || ''}</div>
    <div style="font-size:10px;color:#888">Type: <span style="color:#fff">${sat.type}</span></div>
    <div style="font-size:10px;color:#888">Altitude: <span style="color:#fff">${altKm} km</span></div>
    <div style="font-size:10px;color:#888">Shell: <span style="color:#fff">${shell}</span></div>
  `;
  el.tooltip.style.display = 'block';
}

/**
 * Position the tooltip near the cursor.
 */
export function moveTooltip(clientX, clientY) {
  el.tooltip.style.left = clientX + 15 + 'px';
  el.tooltip.style.top = clientY + 15 + 'px';
}

/**
 * Hide the tooltip.
 */
export function hideTooltip() {
  el.tooltip.style.display = 'none';
}

/**
 * Get currently selected object indices.
 */
export function getSelectedIndices() {
  return {
    a: parseInt(el.selectA.value),
    b: parseInt(el.selectB.value),
  };
}

/**
 * Transition from loading screen to the simulation UI.
 */
export function showSimulation() {
  el.loading.style.display = 'none';
  el.instructions.style.display = 'block';
  el.triggerBtn.disabled = false;
}

/**
 * Update the loading screen text.
 */
export function setLoadingText(msg) {
  el.loadingText.textContent = msg;
}

/**
 * Disable the trigger button and hide instructions after collision.
 */
export function onCollisionTriggered() {
  el.triggerBtn.disabled = true;
  el.instructions.style.display = 'none';
}

/**
 * Bind UI event listeners.
 */
export function setupControls(onTrigger, onReset) {
  el.triggerBtn.addEventListener('click', onTrigger);
  el.resetBtn.addEventListener('click', onReset);
}
