// JS/charts/bottomChart.js
import { escapeHtml } from "../utils/security.js";

let bottomChartEnabled = false;

let chartVisibleTypes = new Set();
let chartCacheKey = "";
let chartGlobalDays = [];
let chartGlobalMaxDay = null;
let chartRangeKey = "";

let lastSeriesMasked = null;
let lastCursorTs = null;
let animRaf = null;

let chartMaxY = 1;
let chartMaxKey = "";

let hoverModel = null;
let hoverBound = false;

let scrubBound = false;
let isScrubbing = false;
let rangeScrubMode = null;

const DAY_MS = 24 * 3600 * 1000;
const TIMELINE_UNIT_YEAR = "year";
const TIMELINE_UNIT_DAY = "day";
let timelineSelectedYear = null;
let timelineActions = {};
let zoomButtonEl = null;
let zoomButtonTargetYear = null;
let zoomButtonLang = "fr";



function chartTheme() {
  return document.body.classList.contains("theme-dark")
    ? { background: "#101014", text: "#d9dbe2", strongText: "#f5f5f7", grid: "rgba(255,255,255,0.18)" }
    : { background: "#fff", text: "#666", strongText: "#16161b", grid: "rgba(0,0,0,0.14)" };
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function getTimelineBucketUnit() {
  return timelineSelectedYear == null ? TIMELINE_UNIT_YEAR : TIMELINE_UNIT_DAY;
}

function startOfTimelineUnit(ts, unit) {
  const d = new Date(ts);
  if (unit === TIMELINE_UNIT_YEAR) return Date.UTC(d.getUTCFullYear(), 0, 1);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function addTimelineUnit(ts, unit, amount = 1) {
  const d = new Date(ts);
  if (unit === TIMELINE_UNIT_YEAR) return Date.UTC(d.getUTCFullYear() + amount, 0, 1);
  return ts + (amount * DAY_MS);
}

function getYearRangeUTC(year) {
  return {
    startTime: Date.UTC(year, 0, 1),
    endTime: Date.UTC(year, 11, 31, 23, 59, 59, 999)
  };
}

function buildDaysBetween(startTime, endTime) {
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return [];
  const days = [];
  for (let d = startOfTimelineUnit(startTime, TIMELINE_UNIT_DAY); d <= endTime; d += DAY_MS) {
    days.push(d);
  }
  return days;
}

function getTimelineSourceDays() {
  if (timelineSelectedYear != null) {
    const { startTime, endTime } = getYearRangeUTC(timelineSelectedYear);
    return buildDaysBetween(startTime, endTime);
  }
  return chartGlobalDays;
}

function buildTimelineBuckets(days, unit = getTimelineBucketUnit()) {
  if (!Array.isArray(days) || !days.length) return [];

  const domainStart = days[0];
  const domainEnd = days[days.length - 1] + DAY_MS - 1;
  const buckets = [];

  if (unit === TIMELINE_UNIT_DAY) {
    for (const day of days) {
      buckets.push({
        startTs: day,
        endTs: day + DAY_MS - 1,
        unitStartTs: day,
        unit
      });
    }
    return buckets;
  }

  for (
    let unitStart = startOfTimelineUnit(domainStart, unit);
    unitStart <= domainEnd;
    unitStart = addTimelineUnit(unitStart, unit)
  ) {
    const unitEnd = addTimelineUnit(unitStart, unit) - 1;
    const startTs = Math.max(unitStart, domainStart);
    const endTs = Math.min(unitEnd, domainEnd);
    if (endTs < domainStart || startTs > domainEnd) continue;
    buckets.push({ startTs, endTs, unitStartTs: unitStart, unit });
  }

  return buckets;
}

function getTimelineDomain(buckets) {
  if (!Array.isArray(buckets) || !buckets.length) return { startTs: null, endTs: null };
  return {
    startTs: buckets[0].startTs,
    endTs: buckets[buckets.length - 1].endTs
  };
}

function getTimelineXForTs(ts, domainStartTs, domainEndTs, padL, plotW) {
  if (!Number.isFinite(ts) || !Number.isFinite(domainStartTs) || !Number.isFinite(domainEndTs)) return null;
  if (domainEndTs <= domainStartTs) return padL + plotW / 2;
  const ratio = (ts - domainStartTs) / Math.max(1, domainEndTs - domainStartTs);
  return padL + clamp(ratio, 0, 1) * plotW;
}

function formatTimelineBucketLabel(bucket, unit, formatDayLabelUTC) {
  if (!bucket) return "";
  const d = new Date(bucket.unitStartTs ?? bucket.startTs);
  const yyyy = d.getUTCFullYear();
  if (unit === TIMELINE_UNIT_YEAR) return String(yyyy);
  return formatDayLabelUTC(bucket.startTs);
}

function cancelTimelineAnimation() {
  if (animRaf && typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(animRaf);
  }
  animRaf = null;
}

function invalidateTimelineRender({ resetSeries = false } = {}) {
  chartCacheKey = "";
  if (resetSeries) {
    cancelTimelineAnimation();
    lastSeriesMasked = null;
    lastCursorTs = null;
  }
}

function resetChartRenderState() {
  chartCacheKey = "";
  chartMaxKey = "";
  chartMaxY = 1;
  lastSeriesMasked = null;
  lastCursorTs = null;
  cancelTimelineAnimation();
}

function setChartDaysRange(startTime, maxTime, startOfDayUTC, key, { preserveTimelineZoom = false } = {}) {
  if (!Number.isFinite(startTime) || !Number.isFinite(maxTime)) return null;

  const startDay = startOfDayUTC(startTime);
  const maxDay = Math.max(startDay, startOfDayUTC(maxTime));
  if (!Number.isFinite(startDay) || !Number.isFinite(maxDay) || maxDay - startDay > 100 * 366 * DAY_MS) {
    throw new Error("Période de chronologie invalide ou supérieure à 100 ans.");
  }
  const days = [];
  for (let d = startDay; d <= maxDay; d += 24 * 3600 * 1000) days.push(d);

  chartGlobalMaxDay = maxDay;
  chartGlobalDays = days;
  chartRangeKey = key || `${startDay}:${maxDay}`;
  if (!preserveTimelineZoom) {
    timelineSelectedYear = null;
  }
  resetChartRenderState();
  return { days, maxDay };
}

function normalizeVisibleChartTypes(typeConfigKeys = []) {
  const keys = Array.isArray(typeConfigKeys) ? typeConfigKeys.filter(Boolean) : [];
  const allowed = new Set(keys);

  chartVisibleTypes = new Set(
    Array.from(chartVisibleTypes).filter(type => allowed.has(type))
  );

  if (chartVisibleTypes.size === 0) {
    keys.forEach(type => chartVisibleTypes.add(type));
  }

  return keys;
}

function getNearestTimelineBucketIndex(mx, buckets, barRects = []) {
  if (!buckets?.length) return 0;
  let bestIndex = 0;
  let bestDist = Infinity;

  for (let i = 0; i < buckets.length; i++) {
    const rect = barRects[i];
    const center = rect ? rect.x + rect.w / 2 : 0;
    const dist = Math.abs(mx - center);
    if (dist < bestDist) {
      bestIndex = i;
      bestDist = dist;
    }
  }

  return bestIndex;
}

function getTimelinePlotTarget(canvas, event) {
  if (!hoverModel?.buckets?.length) return null;

  const rect = canvas.getBoundingClientRect();
  const mx = event.clientX - rect.left;
  const my = event.clientY - rect.top;
  const { padL, padT, plotW, plotH, buckets, barRects } = hoverModel;

  if (mx < padL || mx > padL + plotW || my < padT || my > padT + plotH) return null;

  const idx = getNearestTimelineBucketIndex(mx, buckets, barRects);
  const bucket = buckets?.[idx];
  const barRect = barRects?.[idx];

  return {
    year: bucket ? new Date(bucket.unitStartTs ?? bucket.startTs).getUTCFullYear() : null,
    bucket,
    x: barRect ? barRect.x + barRect.w / 2 : mx,
    y: my
  };
}

function getTimelineRangeHandleTarget(clientX, clientY) {
  if (!hoverModel?.buckets?.length) return null;

  const canvas = document.getElementById("bottom-chart-canvas");
  if (!canvas) return null;

  const rect = canvas.getBoundingClientRect();
  const mx = clientX - rect.left;
  const my = clientY - rect.top;
  const { padL, padT, plotW, plotH, windowStartTs, cursorTs } = hoverModel;
  const activeDomain = timelineSelectedYear != null && getTimelineBucketUnit() === TIMELINE_UNIT_DAY
    ? getYearRangeUTC(timelineSelectedYear)
    : { startTime: hoverModel.domainStartTs, endTime: hoverModel.domainEndTs };
  const domainStartTs = activeDomain.startTime;
  const domainEndTs = activeDomain.endTime;

  if (mx < padL - 28 || mx > padL + plotW + 28 || my < padT - 20 || my > padT + plotH + 28) return null;
  if (!Number.isFinite(domainStartTs) || !Number.isFinite(domainEndTs)) return null;

  const handles = [];
  const startDay = Number.isFinite(windowStartTs) ? windowStartTs : domainStartTs;
  const endDay = Number.isFinite(cursorTs) ? cursorTs : domainEndTs;
  const startX = getTimelineXForTs(startDay, domainStartTs, domainEndTs, padL, plotW);
  const endX = getTimelineXForTs(endDay, domainStartTs, domainEndTs, padL, plotW);
  if (startX != null && startDay >= domainStartTs && startDay <= domainEndTs) handles.push({ mode: "start", x: startX });
  if (endX != null && endDay >= domainStartTs && endDay <= domainEndTs) handles.push({ mode: "end", x: endX });

  if (!handles.length) return null;

  const hitRadius = 24;
  let best = null;
  for (const handle of handles) {
    const dist = Math.abs(mx - handle.x);
    if (dist <= hitRadius && (!best || dist < best.dist)) {
      best = { ...handle, dist };
    }
  }

  if (best && handles.length === 2 && Math.abs(handles[0].x - handles[1].x) < hitRadius * 1.25) {
    const midpoint = (handles[0].x + handles[1].x) / 2;
    const preferred = mx >= midpoint ? handles.find(h => h.mode === "end") : handles.find(h => h.mode === "start");
    if (preferred) best = { ...preferred, dist: Math.abs(mx - preferred.x) };
  }

  return best;
}

function setTimelineActions(actions = {}) {
  timelineActions = actions || {};
}

function applyTimelineYearZoom(year) {
  const y = Number(year);
  if (!Number.isInteger(y) || y < 1900 || y > 2200) return false;

  const { startTime, endTime } = getYearRangeUTC(y);
  timelineActions.pausePlayback?.();

  timelineSelectedYear = y;
  hideTimelineZoomButton({ force: true });
  invalidateTimelineRender({ resetSeries: true });

  timelineActions.setPlaybackWindowStartTime?.(startTime, {
    allowBeforeMin: true,
    allowBeyondMax: true,
    ignoreCurrentEnd: true
  });
  timelineActions.setPlaybackCutoffTime?.(endTime, {
    allowBeforeMin: true,
    allowBeyondMax: true
  });
  timelineActions.render?.();
  timelineActions.redraw?.();
  return true;
}

function resetTimelineZoom({ resetPlaybackWindow = false } = {}) {
  const wasZoomed = timelineSelectedYear != null;
  timelineSelectedYear = null;
  hideTimelineZoomButton({ force: true });
  invalidateTimelineRender({ resetSeries: true });

  if (resetPlaybackWindow) {
    const resetStart = Number.isFinite(timelineActions.playbackStartTime)
      ? timelineActions.playbackStartTime
      : chartGlobalDays[0];
    const resetEnd = Number.isFinite(timelineActions.playbackMaxTime)
      ? timelineActions.playbackMaxTime
      : (Number.isFinite(chartGlobalMaxDay) ? chartGlobalMaxDay + DAY_MS - 1 : null);

    if (Number.isFinite(resetStart)) timelineActions.setPlaybackWindowStartTime?.(resetStart);
    if (Number.isFinite(resetEnd)) timelineActions.setPlaybackCutoffTime?.(resetEnd);
    timelineActions.render?.();
  }

  if (wasZoomed || resetPlaybackWindow) timelineActions.redraw?.();
}

function getTimelineZoomButtonLabel() {
  return zoomButtonLang === "en"
    ? "Zoom into this year"
    : (zoomButtonLang === "es" ? "Acercar este ano" : "Zoomer sur cette annee");
}

function hideTimelineZoomButton({ force = false } = {}) {
  if (!zoomButtonEl) {
    zoomButtonTargetYear = null;
    return;
  }
  if (force) zoomButtonEl.style.transition = "none";
  zoomButtonEl.classList.remove("is-visible");
  zoomButtonEl.setAttribute("aria-hidden", "true");
  zoomButtonEl.disabled = true;
  zoomButtonTargetYear = null;
  if (force && typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => {
      if (zoomButtonEl) zoomButtonEl.style.transition = "";
    });
  }
}

function ensureTimelineZoomButton(canvas) {
  if (zoomButtonEl) return zoomButtonEl;

  const wrap = canvas.parentElement;
  if (!wrap) return null;
  wrap.classList.add("has-timeline-zoom-button");

  zoomButtonEl = document.createElement("button");
  zoomButtonEl.className = "timeline-zoom-button";
  zoomButtonEl.type = "button";
  zoomButtonEl.textContent = "+";
  zoomButtonEl.setAttribute("aria-hidden", "true");
  zoomButtonEl.disabled = true;

  zoomButtonEl.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  zoomButtonEl.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (zoomButtonTargetYear == null) return;
    applyTimelineYearZoom(zoomButtonTargetYear);
  });

  wrap.appendChild(zoomButtonEl);
  return zoomButtonEl;
}

function showTimelineZoomButton(canvas, target) {
  if (timelineSelectedYear != null || target?.year == null) {
    hideTimelineZoomButton({ force: true });
    return;
  }

  const button = ensureTimelineZoomButton(canvas);
  const wrap = canvas.parentElement;
  if (!button || !wrap) return;

  const canvasRect = canvas.getBoundingClientRect();
  const wrapRect = wrap.getBoundingClientRect();
  const x = canvasRect.left - wrapRect.left + target.x;
  const y = canvasRect.top - wrapRect.top + target.y;

  zoomButtonTargetYear = target.year;
  button.style.left = `${x}px`;
  button.style.top = `${Math.max(12, y - 6)}px`;
  button.title = getTimelineZoomButtonLabel();
  button.setAttribute("aria-label", button.title);
  button.setAttribute("aria-hidden", "false");
  button.disabled = false;
  button.classList.add("is-visible");
}

function bindBottomChartScrub(canvas, { onScrubStart, onScrubStartDate, onScrubEndDate, onScrubEnd } = {}) {
  if (scrubBound) return;
  scrubBound = true;
  canvas.style.touchAction = "none";

  let pendingYearClick = null;
  let pendingScrubDate = null;
  let scrubRaf = 0;
  let lastQueuedScrubKey = "";

  const getScrubDomain = () => {
    if (timelineSelectedYear != null) {
      return getYearRangeUTC(timelineSelectedYear);
    }
    return {
      startTime: hoverModel?.domainStartTs,
      endTime: hoverModel?.domainEndTs
    };
  };

  const getBucketFromClientX = (clientX) => {
    if (!hoverModel) return null;

    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;

    const { padL, plotW, buckets, barRects } = hoverModel;

    const x = Math.max(padL, Math.min(padL + plotW, mx));

    if (timelineSelectedYear != null) {
      const { startTime, endTime } = getScrubDomain();
      if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return null;
      const ratio = clamp((x - padL) / Math.max(1, plotW), 0, 1);
      const rawTs = startTime + ratio * Math.max(1, endTime - startTime);
      const startTs = startOfTimelineUnit(rawTs, "day");
      return {
        startTs,
        endTs: Math.min(startTs + DAY_MS - 1, endTime)
      };
    }

    if (!buckets?.length) return null;
    const idx = getNearestTimelineBucketIndex(x, buckets, barRects);
    return buckets[Math.max(0, Math.min(buckets.length - 1, idx))];
  };

  const insideTimelineHitArea = (clientX, clientY) => {
    if (!hoverModel) return false;
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const { padL, padT, plotW, plotH } = hoverModel;
    return mx >= padL - 28 && mx <= padL + plotW + 28 && my >= padT - 20 && my <= padT + plotH + 28;
  };

  const applyScrubDate = (pending) => {
    if (!pending) return;
    if (pending.mode === "start") onScrubStartDate?.(pending.ts);
    else onScrubEndDate?.(pending.ts);
  };

  const flushScrubDate = () => {
    if (scrubRaf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(scrubRaf);
    scrubRaf = 0;
    const pending = pendingScrubDate;
    pendingScrubDate = null;
    if (pending) applyScrubDate(pending);
  };

  const queueScrubDate = (mode, ts) => {
    if (!mode || !Number.isFinite(ts)) return;

    const key = `${mode}:${ts}`;
    if (key === lastQueuedScrubKey) return;

    lastQueuedScrubKey = key;
    pendingScrubDate = { mode, ts };

    if (scrubRaf) return;
    if (typeof requestAnimationFrame !== "function") {
      flushScrubDate();
      return;
    }

    scrubRaf = requestAnimationFrame(() => {
      scrubRaf = 0;
      const pending = pendingScrubDate;
      pendingScrubDate = null;
      if (pending) applyScrubDate(pending);
    });
  };

  const updateScrubDateFromClientX = (clientX) => {
    const bucket = getBucketFromClientX(clientX);
    if (!bucket || !rangeScrubMode) return;

    const ts = rangeScrubMode === "start" ? bucket.startTs : bucket.endTs;
    queueScrubDate(rangeScrubMode, ts);
  };

  const releasePointerCapture = (event) => {
    try {
      canvas.releasePointerCapture?.(event.pointerId);
    } catch (_) { }
  };

  canvas.addEventListener("pointerdown", (e) => {
    if (!hoverModel) return;

    const handle = getTimelineRangeHandleTarget(e.clientX, e.clientY);
    if (handle) {
      pendingYearClick = null;
      rangeScrubMode = handle.mode;
      isScrubbing = true;
      lastQueuedScrubKey = "";
      canvas.setPointerCapture?.(e.pointerId);

      onScrubStart?.(rangeScrubMode);
      updateScrubDateFromClientX(e.clientX);
      e.preventDefault();
      return;
    }

    if (!insideTimelineHitArea(e.clientX, e.clientY)) return;

    if (timelineSelectedYear == null) {
      const target = getTimelinePlotTarget(canvas, e);
      if (target?.year != null) {
        pendingYearClick = {
          pointerId: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          target
        };
        canvas.setPointerCapture?.(e.pointerId);
        e.preventDefault();
      }
    }
  });

  canvas.addEventListener("pointermove", (e) => {
    if (pendingYearClick && e.pointerId === pendingYearClick.pointerId) {
      const dx = e.clientX - pendingYearClick.x;
      const dy = e.clientY - pendingYearClick.y;
      if (Math.hypot(dx, dy) > 8) {
        pendingYearClick = null;
        releasePointerCapture(e);
      }
    }

    if (!isScrubbing) {
      const handle = getTimelineRangeHandleTarget(e.clientX, e.clientY);
      const target = timelineSelectedYear == null ? getTimelinePlotTarget(canvas, e) : null;
      canvas.style.cursor = handle ? "ew-resize" : (target ? "pointer" : "default");
      return;
    }

    updateScrubDateFromClientX(e.clientX);
    e.preventDefault();
  });

  const endScrub = (e) => {
    if (pendingYearClick && e?.pointerId === pendingYearClick.pointerId) {
      const dx = e.clientX - pendingYearClick.x;
      const dy = e.clientY - pendingYearClick.y;
      const target = Math.hypot(dx, dy) <= 8
        ? (getTimelinePlotTarget(canvas, e) || pendingYearClick.target)
        : null;

      pendingYearClick = null;
      releasePointerCapture(e);

      if (target?.year != null) {
        showTimelineZoomButton(canvas, target);
        e.preventDefault();
        return;
      }
    }

    if (!isScrubbing) return;
    flushScrubDate();
    isScrubbing = false;
    rangeScrubMode = null;
    onScrubEnd?.();
    if (e) releasePointerCapture(e);
  };

  canvas.addEventListener("pointerup", endScrub);
  canvas.addEventListener("pointercancel", endScrub);
  window.addEventListener("pointerup", endScrub);
  window.addEventListener("pointercancel", endScrub);
  canvas.addEventListener("mouseleave", () => {
    if (!isScrubbing) canvas.style.cursor = "default";
  });
}

function bindBottomChartStackedHover(canvas, { getDisplayLabelForType, formatDayLabelUTC, typeColors }) {
  if (hoverBound) return;
  hoverBound = true;

  canvas.addEventListener("mouseleave", () => hideBottomTooltip());

  canvas.addEventListener("mousemove", (e) => {
    if (isScrubbing) return;
    if (!hoverModel) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { padL, padT, plotW, plotH, buckets, seriesByType, types, barRects, timelineUnit } = hoverModel;

    if (mx < padL || mx > padL + plotW || my < padT || my > padT + plotH) {
      hideBottomTooltip();
      return;
    }

    const idx = getNearestTimelineBucketIndex(mx, buckets, barRects);
    const bucket = buckets?.[idx];
    const rows = types
      .map(type => ({
        type,
        value: seriesByType[type]?.[idx] || 0
      }))
      .filter(row => row.value > 0);
    const total = rows.reduce((sum, row) => sum + row.value, 0);

    if (total <= 0) {
      hideBottomTooltip();
      return;
    }

    const ttW = 260;
    const ttH = 90;
    const x = clamp(e.clientX + 12, 8, window.innerWidth - ttW - 8);
    const y = clamp(e.clientY - 12, 8, window.innerHeight - ttH - 8);

    showBottomTooltip({
      x,
      y,
      html: `
        <div class="bottom-tooltip-date">${escapeHtml(formatTimelineBucketLabel(bucket, timelineUnit, formatDayLabelUTC))}</div>
        ${rows.map(row => `
          <div class="bottom-tooltip-row">
            <span class="bottom-tooltip-type">
              <span class="bottom-tooltip-swatch" style="background:${typeColors?.[row.type] || "#999"}"></span>
              ${escapeHtml(getDisplayLabelForType(row.type))}
            </span>
            <span class="bottom-tooltip-val">${Math.round(row.value)}</span>
          </div>
        `).join("")}
        <div class="bottom-tooltip-row bottom-tooltip-total">
          <span class="bottom-tooltip-type">Total</span>
          <span class="bottom-tooltip-val">${Math.round(total)}</span>
        </div>
      `
    });
  });
}


function lerp(a, b, t) { return a + (b - a) * t; }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function interpolateSeries(a, b, t) {
  const out = {};
  for (const type of Object.keys(b)) {
    const A = (a && a[type]) ? a[type] : null;
    const B = b[type];
    out[type] = B.map((vb, i) => {
      const va = (A && A[i] != null) ? A[i] : vb;
      if (vb == null) return null;
      return lerp(va, vb, t);
    });
  }
  return out;
}

function resizeCanvasToDisplaySize(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.round(rect.width * dpr);
  const h = Math.round(rect.height * dpr);

  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function drawTimelineWindowBackground(ctx, { buckets, padL, padT, plotW, plotH, windowStartTs, cursorTs, startOfDayUTC }) {
  if (!buckets?.length) return;

  ctx.fillStyle = chartTheme().background;
  ctx.fillRect(padL, padT, plotW, plotH);

  const { startTs: domainStartTs, endTs: domainEndTs } = getTimelineDomain(buckets);
  const startDay = Number.isFinite(windowStartTs) ? startOfDayUTC(windowStartTs) : domainStartTs;
  const endDay = Number.isFinite(cursorTs) ? cursorTs : domainEndTs;

  if (endDay < domainStartTs || startDay > domainEndTs || endDay < startDay) return;

  const startX = getTimelineXForTs(Math.max(startDay, domainStartTs), domainStartTs, domainEndTs, padL, plotW);
  const endX = getTimelineXForTs(Math.min(endDay, domainEndTs), domainStartTs, domainEndTs, padL, plotW);
  if (startX == null || endX == null) return;

  ctx.fillStyle = "rgba(228, 0, 70, 0.075)";
  ctx.fillRect(startX, padT, Math.max(1, endX - startX), plotH);
}

function drawTimelineWindowHandles(ctx, { buckets, padL, padT, plotW, plotH, windowStartTs, cursorTs, currentLang, formatDayLabelUTC, startOfDayUTC }) {
  if (!buckets?.length) return;

  const handles = [];
  const { startTs: domainStartTs, endTs: domainEndTs } = getTimelineDomain(buckets);
  const startDay = Number.isFinite(windowStartTs) ? startOfDayUTC(windowStartTs) : domainStartTs;
  const endDay = Number.isFinite(cursorTs) ? cursorTs : domainEndTs;

  const startX = getTimelineXForTs(startDay, domainStartTs, domainEndTs, padL, plotW);
  const endX = getTimelineXForTs(endDay, domainStartTs, domainEndTs, padL, plotW);

  if (startX != null && startDay >= domainStartTs && startDay <= domainEndTs) {
    handles.push({
      x: startX,
      label: formatDayLabelUTC(Math.max(startDay, domainStartTs)),
      side: "start"
    });
  }

  if (endX != null && endDay >= domainStartTs && endDay <= domainEndTs) {
    handles.push({
      x: endX,
      label: formatDayLabelUTC(Math.min(endDay, domainEndTs)),
      side: "end"
    });
  }

  const labelsOverlap = handles.length === 2 && Math.abs(handles[0].x - handles[1].x) < 92;

  handles.forEach((handle, index) => {
    const x = handle.x;

    ctx.save();
    ctx.strokeStyle = handle.side === "start" ? "rgba(138, 0, 35, 0.8)" : "rgba(228, 0, 70, 0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, padT - 2);
    ctx.lineTo(x, padT + plotH + 4);
    ctx.stroke();

    ctx.fillStyle = handle.side === "start" ? "rgba(138, 0, 35, 0.95)" : "rgba(228, 0, 70, 0.95)";
    ctx.beginPath();
    ctx.arc(x, padT + plotH + 4, 4, 0, Math.PI * 2);
    ctx.fill();

    const labelPrefix = currentLang === "en"
      ? (handle.side === "start" ? "Start " : "End ")
      : (currentLang === "es" ? (handle.side === "start" ? "Inicio " : "Fin ") : (handle.side === "start" ? "Debut " : "Fin "));
    const label = `${labelPrefix}${handle.label}`;

    ctx.font = "10px Electrolize, sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    const padX = 7;
    const tw = ctx.measureText(label).width;
    const boxW = tw + padX * 2;
    const boxH = 16;
    const yOffset = labelsOverlap && index === 1 ? 18 : 0;
    let bx = Math.max(padL + boxW / 2, Math.min(padL + plotW - boxW / 2, x));
    const by = Math.max(9, padT - 2 + yOffset);

    ctx.fillStyle = "rgba(0,0,0,0.68)";
    ctx.beginPath();
    roundedRect(ctx, bx - boxW / 2, by - boxH / 2, boxW, boxH, 8);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.fillText(label, bx, by);
    ctx.restore();
  });

  function roundedRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
}

function drawTimelineYearTicks(ctx, { padL, padT, plotW, plotH, domainStartTs, domainEndTs }) {
  if (!Number.isFinite(domainStartTs) || !Number.isFinite(domainEndTs)) return;

  const startYear = new Date(domainStartTs).getUTCFullYear();
  const endYear = new Date(domainEndTs).getUTCFullYear();
  if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) return;

  ctx.save();
  ctx.font = "10px Electrolize, sans-serif";
  ctx.fillStyle = chartTheme().text;
  ctx.strokeStyle = chartTheme().grid;
  ctx.lineWidth = 1;
  ctx.textBaseline = "top";
  ctx.textAlign = "center";

  const sampleWidth = Math.max(ctx.measureText(String(startYear)).width, ctx.measureText(String(endYear)).width);
  const minGap = Math.max(40, sampleWidth + 12);
  const years = [];
  for (let year = startYear; year <= endYear; year++) years.push(year);
  const maxLabels = Math.max(1, Math.floor(plotW / minGap) + 1);
  const step = Math.max(1, Math.ceil(years.length / maxLabels));
  let lastLabelX = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < years.length; i++) {
    if (i % step !== 0 && years.length > maxLabels) continue;

    const year = years[i];
    let tickTs = Date.UTC(year, 0, 1);
    if (tickTs < domainStartTs) tickTs = domainStartTs;
    if (tickTs > domainEndTs) tickTs = domainEndTs;

    const tickX = getTimelineXForTs(tickTs, domainStartTs, domainEndTs, padL, plotW);
    if (tickX == null) continue;

    const label = String(year);
    const labelW = ctx.measureText(label).width;
    const labelX = clamp(tickX, padL + labelW / 2, padL + plotW - labelW / 2);
    if (labelX - lastLabelX < minGap) continue;

    ctx.beginPath();
    ctx.moveTo(tickX, padT + plotH + 2);
    ctx.lineTo(tickX, padT + plotH + 7);
    ctx.stroke();
    ctx.fillText(label, labelX, padT + plotH + 8);
    lastLabelX = labelX;
  }

  ctx.restore();
}

function drawStackedColumnChart({ canvas, days, seriesByType, cursorTs, windowStartTs, maxY, typeColors, chartVisibleTypes, currentLang, formatDayLabelUTC }) {
  const ctx = resizeCanvasToDisplaySize(canvas);
  const rect = canvas.getBoundingClientRect();
  const W = rect.width;
  const H = rect.height;

  ctx.clearRect(0, 0, W, H);

  const padL = 34, padR = 24, padT = 10, padB = 18;
  const plotW = Math.max(1, W - padL - padR);
  const plotH = Math.max(1, H - padT - padB);
  const timelineUnit = getTimelineBucketUnit();
  const allBuckets = days?.[0]?.startTs != null ? days : buildTimelineBuckets(days, timelineUnit);
  const visibleBuckets = Array.isArray(allBuckets) ? allBuckets : [];
  const visibleSeriesByType = seriesByType || {};
  const types = Object.keys(visibleSeriesByType).filter(t => chartVisibleTypes.has(t));

  if (!visibleBuckets.length || types.length === 0) {
    ctx.font = "12px Electrolize, sans-serif";
    ctx.fillStyle = chartTheme().strongText;
    ctx.fillText(currentLang === "en" ? "No data" : "Aucune donnee", padL, padT + 16);
    hoverModel = null;
    return;
  }

  const { startTs: domainStartTs, endTs: domainEndTs } = getTimelineDomain(visibleBuckets);
  drawTimelineWindowBackground(ctx, {
    buckets: visibleBuckets,
    padL,
    padT,
    plotW,
    plotH,
    windowStartTs,
    cursorTs,
    startOfDayUTC
  });

  ctx.strokeStyle = chartTheme().grid;
  ctx.fillStyle = chartTheme().text;
  ctx.font = "10px Electrolize, sans-serif";
  for (let i = 0; i <= 2; i++) {
    const yVal = Math.round((maxY * i) / 2);
    const y = padT + plotH - (plotH * i) / 2;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + plotW, y);
    ctx.stroke();
    ctx.fillText(String(yVal), 6, y + 3);
  }

  const yAt = (val) => padT + plotH - (val / maxY) * plotH;
  const barRects = [];

  for (let i = 0; i < visibleBuckets.length; i++) {
    const bucket = visibleBuckets[i];
    const x0 = getTimelineXForTs(bucket.startTs, domainStartTs, domainEndTs, padL, plotW);
    const x1 = getTimelineXForTs(bucket.endTs, domainStartTs, domainEndTs, padL, plotW);
    if (x0 == null || x1 == null) {
      barRects.push(null);
      continue;
    }

    const rawW = Math.max(1, x1 - x0);
    const gap = timelineUnit === TIMELINE_UNIT_DAY ? 0.2 : 2;
    const minW = timelineUnit === TIMELINE_UNIT_DAY ? 1 : 3;
    const barW = clamp(rawW * 0.86, minW, Math.max(minW, rawW - gap));
    const x = ((x0 + x1) / 2) - (barW / 2);
    barRects.push({ x, w: barW });

    let acc = 0;

    for (const type of types) {
      const value = visibleSeriesByType[type]?.[i];
      if (value == null) break;
      if (value <= 0) continue;

      const y0 = yAt(acc);
      acc += value;
      const y1 = yAt(acc);
      const h = Math.max(1, y0 - y1);

      ctx.fillStyle = typeColors[type] || "#666";
      ctx.fillRect(x, y1, barW, h);
    }
  }

  drawTimelineYearTicks(ctx, {
    padL,
    padT,
    plotW,
    plotH,
    domainStartTs,
    domainEndTs
  });

  drawTimelineWindowHandles(ctx, {
    buckets: visibleBuckets,
    padL,
    padT,
    plotW,
    plotH,
    windowStartTs,
    cursorTs,
    currentLang,
    formatDayLabelUTC,
    startOfDayUTC
  });

  hoverModel = {
    padL, padT, plotW, plotH,
    days: visibleBuckets,
    buckets: visibleBuckets,
    seriesByType: visibleSeriesByType,
    maxY,
    types,
    timelineUnit,
    currentLang,
    barRects,
    domainStartTs,
    domainEndTs,
    windowStartTs: Number.isFinite(windowStartTs) ? startOfDayUTC(windowStartTs) : null,
    cursorTs: Number.isFinite(cursorTs) ? cursorTs : null
  };

  function startOfDayUTC(ts) {
    const d = new Date(ts);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
}

function maskSeriesOutsideTimeRange(series, buckets, startTime, endTime) {
  const rangeStart = Number.isFinite(startTime) ? startTime : Number.NEGATIVE_INFINITY;
  const rangeEnd = Number.isFinite(endTime) ? endTime : Number.POSITIVE_INFINITY;
  const out = {};

  for (const [type, arr] of Object.entries(series || {})) {
    out[type] = arr.map((value, index) => {
      const bucket = buckets?.[index];
      if (!bucket) return null;
      const intersects = bucket.endTs >= rangeStart && bucket.startTs <= rangeEnd;
      return intersects ? value : null;
    });
  }

  return out;
}

function buildDailySeries(events, days, getEventTime, startOfDayUTC, typeConfigKeys) {
  const buckets = days?.[0]?.startTs != null
    ? days
    : buildTimelineBuckets(days, getTimelineBucketUnit());

  const byBucket = new Map();
  for (const ev of events) {
    const ts = getEventTime(ev);
    if (!ts) continue;

    let bucketIndex = -1;
    for (let i = 0; i < buckets.length; i++) {
      if (ts >= buckets[i].startTs && ts <= buckets[i].endTs) {
        bucketIndex = i;
        break;
      }
    }
    if (bucketIndex < 0) continue;

    if (!byBucket.has(bucketIndex)) byBucket.set(bucketIndex, Object.create(null));
    const bucket = byBucket.get(bucketIndex);
    const type = ev.type_violence;
    bucket[type] = (bucket[type] || 0) + 1;
  }

  const series = Object.create(null);
  for (const type of typeConfigKeys) {
    series[type] = buckets.map((bucket, index) => byBucket.get(index)?.[type] || 0);
  }

  return { days: buckets, series };
}

function syncVisibleChartTypes(typeConfigKeys) {
  normalizeVisibleChartTypes(typeConfigKeys);
}

function showBottomChartPanel(update) {
  const panel = document.getElementById("bottom-chart-panel");
  if (!panel) return;
  panel.classList.add("open");
  panel.setAttribute("aria-hidden", "false");
  bottomChartEnabled = true;
  update(true);
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => update(true));
  }
}

function hideBottomChartPanel() {
  const panel = document.getElementById("bottom-chart-panel");
  if (!panel) return;
  panel.classList.remove("open");
  panel.setAttribute("aria-hidden", "true");
  bottomChartEnabled = false;
}

function toggleBottomChartPanel(update) {
  const panel = document.getElementById("bottom-chart-panel");
  if (!panel) return;
  const isOpen = panel.classList.contains("open");
  if (isOpen) hideBottomChartPanel();
  else showBottomChartPanel(update);
}

function computeGlobalChartDays(allEvents, PLAYBACK_START_TIME, getEventTime, startOfDayUTC, maxTime = null) {
  const startDay = startOfDayUTC(PLAYBACK_START_TIME);

  let maxDay = null;
  for (const ev of allEvents) {
    const t = getEventTime(ev);
    if (!Number.isFinite(t)) continue;
    const d = startOfDayUTC(t);
    if (maxDay === null || d > maxDay) maxDay = d;
  }
  if (maxDay === null) maxDay = startDay;

  if (Number.isFinite(maxTime)) {
    const maxDayExternal = startOfDayUTC(maxTime);
    if (maxDay === null || maxDayExternal > maxDay) maxDay = maxDayExternal;
  }

  return setChartDaysRange(
    PLAYBACK_START_TIME,
    maxDay,
    startOfDayUTC,
    `all:${startOfDayUTC(PLAYBACK_START_TIME)}:${maxDay}`
  );
}

function getDesiredTimelineRange({ s, playbackStartTime, playbackMaxTime, getEventTime, startOfDayUTC }) {
  const eventTimes = (s.allEvents || [])
    .map(ev => getEventTime(ev))
    .filter(Number.isFinite);

  const startTime = Number.isFinite(playbackStartTime)
    ? playbackStartTime
    : (eventTimes.length ? Math.min(...eventTimes) : null);

  const dataMax = eventTimes.length ? Math.max(...eventTimes) : null;
  const maxTime = Number.isFinite(playbackMaxTime)
    ? playbackMaxTime
    : dataMax;

  return {
    key: `all:${Number.isFinite(startTime) ? startOfDayUTC(startTime) : ""}:${Number.isFinite(maxTime) ? startOfDayUTC(maxTime) : ""}`,
    startTime,
    maxTime
  };
}

function updateBottomChart(opts = {}) {
  const {
    force = false,
    getState,
    getDisplayLabelForType,
    typeConfigKeys,
    typeColors,
    formatDayLabelUTC,
    getEventTime,
    startOfDayUTC,
    playbackStartTime,
    playbackMaxTime,
    pausePlayback,
    setPlaybackWindowStartTime,
    setPlaybackCutoffTime,
    render
  } = opts;

  if (!bottomChartEnabled) return;
  if (!getState) return;

  syncVisibleChartTypes(typeConfigKeys);

  const canvas = document.getElementById("bottom-chart-canvas");
  if (!canvas) return;

  bindBottomChartScrub(canvas, {
    onScrubStart: () => {
      pausePlayback?.();
    },
    onScrubStartDate: (ts) => {
      pausePlayback?.();
      setPlaybackWindowStartTime?.(ts, {
        allowBeforeMin: timelineSelectedYear != null,
        allowBeyondMax: timelineSelectedYear != null
      });
      render?.();
      updateBottomChart({ ...opts, force: true });
    },
    onScrubEndDate: (ts) => {
      pausePlayback?.();
      setPlaybackCutoffTime?.(ts, {
        allowBeforeMin: timelineSelectedYear != null,
        allowBeyondMax: timelineSelectedYear != null
      });
      render?.();
      updateBottomChart({ ...opts, force: true });
    },
    onScrubEnd: () => { }
  });

  const panel = document.getElementById("bottom-chart-panel");
  bindBottomChartResize(panel, () => updateBottomChart({ ...opts, force: true }));

  bindBottomChartStackedHover(canvas, {
    getDisplayLabelForType,
    formatDayLabelUTC,
    typeColors
  });

  const s = getState();
  zoomButtonLang = s.currentLang;
  setTimelineActions({
    pausePlayback,
    setPlaybackWindowStartTime,
    setPlaybackCutoffTime,
    render,
    redraw: () => updateBottomChart({ ...opts, force: true }),
    playbackStartTime,
    playbackMaxTime: Number.isFinite(playbackMaxTime)
      ? playbackMaxTime
      : (Number.isFinite(chartGlobalMaxDay) ? chartGlobalMaxDay + DAY_MS - 1 : null)
  });

  const desiredRange = getDesiredTimelineRange({
    s,
    playbackStartTime,
    playbackMaxTime,
    getEventTime,
    startOfDayUTC
  });

  if ((!chartGlobalDays.length || desiredRange.key !== chartRangeKey) && Number.isFinite(desiredRange.startTime)) {
      const preserveTimelineZoom = timelineSelectedYear != null && getTimelineBucketUnit() === TIMELINE_UNIT_DAY;
    setChartDaysRange(
      desiredRange.startTime,
      desiredRange.maxTime,
      startOfDayUTC,
      desiredRange.key,
      { preserveTimelineZoom }
    );
  }

  const timelineUnit = getTimelineBucketUnit();
  const timelineSourceDays = getTimelineSourceDays();
  const timelineBuckets = buildTimelineBuckets(timelineSourceDays, timelineUnit);

  // --- subtitle filtres actifs ---
  const subtitleEl = document.getElementById("bottom-chart-subtitle");
  if (subtitleEl) {
    const labels = {
      city: s.currentLang === "en" ? "City: " : (s.currentLang === "es" ? "Ciudad: " : "Ville : "),
      region: s.currentLang === "en" ? "Region: " : (s.currentLang === "es" ? "Estado: " : "Region : ")
    };
    const parts = [];
    if (s.selectedVille) parts.push(labels.city + s.selectedVille);
    if (s.selectedOblast) parts.push(labels.region + s.selectedOblast);

    if (parts.length) {
      subtitleEl.textContent = parts.join(" | ");
      subtitleEl.classList.remove("hidden");
    } else {
      subtitleEl.textContent = s.currentLang === "en"
        ? "No filter selected (region, city)"
        : "Pas de filtre selectionne (region, ville)";
      subtitleEl.classList.add("hidden");
    }
  }


  // recalcul maxY (dépend filtres mais pas cutoff)
  const maxKey = [
    s.currentLang,
    s.selectedOblast || "",
    s.selectedVille || "",
    s.supplementFilterKey || "",
    timelineUnit,
    Array.from(s.selectedTypes || []).sort().join("|"),
    Array.from(chartVisibleTypes).sort().join("|")
  ].join("::");

  if (maxKey !== chartMaxKey) {
    chartMaxKey = maxKey;

    const evsNoCutoff = s.allEvents.filter(ev => {
      const typeOK = (s.selectedTypes.size === 0) || s.selectedTypes.has(ev.type_violence);
      const oblastOK = !s.selectedOblast || (s.getEventOblast(ev) === s.selectedOblast);
      const villeOK = !s.selectedVille || ev.lieu === s.selectedVille;
      const panelFilter = s.eventPassesPanelFilters || s.eventMatchesSupplementFilters;
      const panelOK = !panelFilter || panelFilter(ev);
      return typeOK && oblastOK && villeOK && panelOK;
    });

    const { series: seriesFull } = buildDailySeries(
      evsNoCutoff,
      timelineBuckets,
      getEventTime,
      startOfDayUTC,
      typeConfigKeys
    );

    let m = 0;
    for (let i = 0; i < timelineBuckets.length; i++) {
      let total = 0;
      for (const [t, arr] of Object.entries(seriesFull)) {
        if (!chartVisibleTypes.has(t)) continue;
        total += arr[i] || 0;
      }
      if (total > m) m = total;
    }
    chartMaxY = Math.max(1, m);
  }

  const key = [
    s.currentLang,
    s.selectedOblast || "",
    s.selectedVille || "",
    s.supplementFilterKey || "",
    Array.from(s.selectedTypes).sort().join("|"),
    s.playbackWindowStartTime == null ? "START" : String(startOfDayUTC(s.playbackWindowStartTime)),
    s.playbackCutoffTime == null ? "ALL" : String(startOfDayUTC(s.playbackCutoffTime)),
    timelineUnit,
    timelineSelectedYear || ""
  ].join("::");

  if (!force && key === chartCacheKey) return;
  chartCacheKey = key;

  const evs = s.allEvents.filter(ev => {
    const typeOK = s.selectedTypes.size === 0 || s.selectedTypes.has(ev.type_violence);
    const oblastOK = !s.selectedOblast || (s.getEventOblast(ev) === s.selectedOblast);
    const villeOK = !s.selectedVille || ev.lieu === s.selectedVille;
    const panelFilter = s.eventPassesPanelFilters || s.eventMatchesSupplementFilters;
    const panelOK = !panelFilter || panelFilter(ev);
    const t = getEventTime(ev);
    const playbackStartOK = !Number.isFinite(s.playbackWindowStartTime) || (Number.isFinite(t) && t >= s.playbackWindowStartTime);
    const playbackEndOK = (s.playbackCutoffTime === null) ? true : (Number.isFinite(t) && t <= s.playbackCutoffTime);
    const playbackOK = playbackStartOK && playbackEndOK;
    return typeOK && oblastOK && villeOK && panelOK && playbackOK;
  });

  const { series } = buildDailySeries(evs, timelineBuckets, getEventTime, startOfDayUTC, typeConfigKeys);

  const nextSeries = maskSeriesOutsideTimeRange(
    series,
    timelineBuckets,
    s.playbackWindowStartTime,
    s.playbackCutoffTime
  );

  const prevSeries = lastSeriesMasked;
  const prevCursor = lastCursorTs;

  lastSeriesMasked = nextSeries;
  lastCursorTs = s.playbackCutoffTime;

  if (!prevSeries) {
    drawStackedColumnChart({
      canvas,
      days: timelineBuckets,
      seriesByType: nextSeries,
      cursorTs: s.playbackCutoffTime,
      windowStartTs: s.playbackWindowStartTime,
      maxY: chartMaxY,
      typeColors,
      chartVisibleTypes,
      currentLang: s.currentLang,
      formatDayLabelUTC
    });
    return;
  }

  if (animRaf) cancelAnimationFrame(animRaf);

  const start = performance.now();
  const duration = 280;

  const tick = (now) => {
    const t0 = Math.min(1, (now - start) / duration);
    const t = easeOutCubic(t0);

    const interp = interpolateSeries(prevSeries, nextSeries, t);
    const cursor = (prevCursor == null || s.playbackCutoffTime == null)
      ? s.playbackCutoffTime
      : lerp(prevCursor, s.playbackCutoffTime, t);

    drawStackedColumnChart({
      canvas,
      days: timelineBuckets,
      seriesByType: interp,
      cursorTs: cursor,
      windowStartTs: s.playbackWindowStartTime,
      maxY: chartMaxY,
      typeColors,
      chartVisibleTypes,
      currentLang: s.currentLang,
      formatDayLabelUTC
    });

    if (t0 < 1) animRaf = requestAnimationFrame(tick);
  };

  animRaf = requestAnimationFrame(tick);
}

function ensureBottomTooltip() {
  let el = document.getElementById("bottom-tooltip");
  if (el) return el;

  el = document.createElement("div");
  el.id = "bottom-tooltip";
  el.className = "bottom-tooltip hidden";
  document.body.appendChild(el);
  return el;
}

function showBottomTooltip({ x, y, html }) {
  const tt = ensureBottomTooltip();
  tt.innerHTML = html;
  tt.style.left = `${x}px`;
  tt.style.top = `${y}px`;
  tt.classList.remove("hidden");
}

function hideBottomTooltip() {
  const tt = document.getElementById("bottom-tooltip");
  if (tt) tt.classList.add("hidden");
}

let resizeObs = null;

function bindBottomChartResize(containerEl, redraw) {
  if (resizeObs) return;
  let raf = 0;
  resizeObs = new ResizeObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => redraw?.());
  });
  resizeObs.observe(containerEl);
}



export const BottomChart = {
  // state read
  isOpen: () => bottomChartEnabled,

  // lifecycle
  computeGlobalDays: computeGlobalChartDays,

  // ui controls
  show: (updateFn) => showBottomChartPanel(updateFn),
  hide: () => hideBottomChartPanel(),
  toggle: (updateFn) => toggleBottomChartPanel(updateFn),
  resetZoom: (opts) => resetTimelineZoom(opts),

  // render
  update: (opts) => updateBottomChart(opts)
};
