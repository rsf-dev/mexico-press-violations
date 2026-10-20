// JS/main.js

window.addEventListener("error", (e) => console.error("window.error", e.error || e.message));
window.addEventListener("unhandledrejection", (e) => console.error("unhandledrejection", e.reason));


const ASSET_VERSION = new URL(import.meta.url).searchParams.get("v") || "dev";
const V = `?v=${encodeURIComponent(ASSET_VERSION)}`;

// Ajoute ?v=... (ou &v=... si l'URL a déjà des params)
function withV(url) {
  return url.includes("?") ? `${url}&v=${encodeURIComponent(ASSET_VERSION)}` : `${url}${V}`;
}



async function importV(path) {
  return import(`${path}?v=${encodeURIComponent(ASSET_VERSION)}`);
}

const { REGLAGES, validerReglages } = await importV("./reglages.js");
validerReglages(REGLAGES);
const MODULES = REGLAGES.fichiers.modules;

const [
  dates,
  strings,
  security,
  bottomChart,
  eventsRenderer,
  oblastFilters,
  playback,
  i18n,
  tutorial,
  panelScroll,
  geojsonLevels,
  mapRendering
] = await Promise.all([
  importV(MODULES.dates),
  importV(MODULES.strings),
  importV(MODULES.security),
  importV(MODULES.bottomChart),
  importV(MODULES.eventsRenderer),
  importV(MODULES.oblastFilters),
  importV(MODULES.playback),
  importV(MODULES.i18n),
  importV(MODULES.tutorial),
  importV(MODULES.panelScroll),
  importV(MODULES.geojsonLevels),
  importV(MODULES.mapRendering)
]);


const {
  parseDateFlexible,
  getEventTime,
  formatDateFR,
  startOfDayUTC,
  startOfDay,
  endOfDay
} = dates;

const { normalizeType } = strings;
const { escapeHtml, getSafeHttpUrls } = security;

const { BottomChart } = bottomChart;
const { EventsRenderer } = eventsRenderer;
const { OblastFilters } = oblastFilters;

const { createPlayback } = playback;
const { UI_STRINGS, applyStaticTextsForLang, getDisplayLabelForType } = i18n;

const { createTutorial } = tutorial;
const { createGeojsonLevelsController } = geojsonLevels;
const { createBasemapLayer, createGeojsonRenderer, waitForBasemapReady } = mapRendering;
const { initPanelScrollProgress } = panelScroll;



// map.setView pour éviter le scroll en mode embed

/// === CONSTANTES ===

const FILES = REGLAGES.fichiers;
const DATA_FIELDS = REGLAGES.champsDonnees;
const FEATURES = REGLAGES.fonctionnalites;
const MAP_SETTINGS = REGLAGES.carte;
const MAP_CRS = { mercator: L.CRS.EPSG3857 }[MAP_SETTINGS.projection];
if (!MAP_CRS) throw new Error(`Projection non prise en charge : ${MAP_SETTINGS.projection}`);
const CHOROPLETH_SETTINGS = REGLAGES.choropleth;
const SUPPLEMENT_SETTINGS = (REGLAGES.filtresAdditionnels || []).filter(filter => filter.enabled !== false);
const featureEnabled = name => FEATURES?.[name]?.enabled !== false;
const REGIONS_GEOJSON_URL = FILES.geojson.regions;
const ICON_BASE_URL = FILES.assets.dossierIcones;
const iconUrl = (file) => withV(`${ICON_BASE_URL}${file}`);
const DEFAULT_ICON_URL = iconUrl(FILES.assets.iconeParDefaut);
const INITIAL_CENTER = MAP_SETTINGS.centreInitial;
const INITIAL_ZOOM = MAP_SETTINGS.zoomInitial;
const MIN_ZOOM = MAP_SETTINGS.zoomMinimum;
const MAX_ZOOM = MAP_SETTINGS.zoomMaximum;
const ENABLED_CATEGORIES = (REGLAGES.categories || []).filter(category => category.enabled !== false);
const TYPE_COLORS = Object.fromEntries(ENABLED_CATEGORIES.map(category => [category.cle, category.couleur]));
const TYPE_CONFIG = Object.fromEntries(ENABLED_CATEGORIES.map(category => [category.cle, { slug: category.slug, file: category.icone }]));
const TYPE_MAP_TO_CANONICAL = Object.fromEntries(ENABLED_CATEGORIES.flatMap(category => [
  category.cle,
  ...Object.values(category.labels || {}),
  ...(category.valeursEntree || [])
].filter(Boolean).map(value => [normalizeFilterValue(value), category.cle])));
const DEFAULT_EVENT_TYPE = REGLAGES.categorieParDefaut;
const SUPPLEMENT_FILTERS = Object.fromEntries(SUPPLEMENT_SETTINGS.map(filter => [filter.id, {
  field: filter.field,
  fields: filter.fields,
  values: filter.values,
  labels: filter.labels,
  showBadge: filter.showBadge
}]));
const FILTERABLE_SUPPLEMENT_KEYS = SUPPLEMENT_SETTINGS.filter(filter => filter.filterable !== false).map(filter => filter.id);
const SUPPLEMENT_FILTER_GROUPS = SUPPLEMENT_SETTINGS.filter(filter => filter.groupExclusive).reduce((groups, filter) => {
  (groups[filter.group] ||= []).push(filter.id);
  return groups;
}, {});
const GENDER_FIELDS = SUPPLEMENT_FILTERS.homme?.fields || [];
const SUPPLEMENT_SUMMARY_ORDER = FILTERABLE_SUPPLEMENT_KEYS;


/// === ÉTAT GLOBAL ===

let map;
let activeBasemap = null;
let geojsonRenderer = null;
let basemapControl = null;
let basemapEntries = [];
let geojsonLevelsController = null;
let allEvents = [];
let selectedTypes = new Set();
let activeSupplementFilters = new Set();



let selectedOblast = null;
let selectedVille = null;
let oblastsDisponibles = [];
let villesDisponibles = [];
let statsSelectedOblast = null;
let statsSelectedVille = null;

let currentLang = REGLAGES.projet.langueParDefaut;

// GeoJSON / layers
let provinceBoundariesLayer = null;
let provinceBoundariesSeq = 0;
let provinceBoundariesFitDone = false;
let regionsGeojsonData = null;
let regionsGeojsonPromise = null;
let currentOblastLayer = null;
let lastHighlightedOblast = null;

let regionsModeActive = featureEnabled("choropleth") && Boolean(FEATURES.choropleth?.actifParDefaut);
let regionsChoroplethLayer = null;
let regionsChoroplethSeq = 0;
let regionsChoroplethCounts = new Map();
let regionsChoroplethMaxCount = 1;

// Graphs panel droit
let overviewMode = REGLAGES.controles.statistiques.vueParDefaut === "emplacements" ? "villes" : "oblasts";
let rightChartRowsByContainer = new Map(); // containerId -> Map(name -> row parts)

// Cache datas par langue
const dataByLang = Object.fromEntries(REGLAGES.projet.langues.map(lang => [lang, null]));
const SUPPORTED_LANGS = new Set(REGLAGES.projet.langues);


/// === HELPERS ===

function setupCollapse({ btnId, bodyId, storageKey = null, defaultCollapsed = false }) {
  const btn = document.getElementById(btnId);
  const body = document.getElementById(bodyId);
  if (!btn || !body) return;

  const load = () => {
    if (!storageKey) return defaultCollapsed;
    const v = localStorage.getItem(storageKey);
    if (v === null) return defaultCollapsed;
    return v === "1";
  };

  const save = (isCollapsed) => {
    if (!storageKey) return;
    localStorage.setItem(storageKey, isCollapsed ? "1" : "0");
  };

  const apply = (isCollapsed) => {
    body.classList.toggle("is-collapsed", isCollapsed);
    btn.textContent = isCollapsed ? "▸" : "▾";
    btn.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
    save(isCollapsed);
  };

  let collapsed = load();
  apply(collapsed);

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    collapsed = !collapsed;
    apply(collapsed);
  });
}


function getTypeSlugFromCategory(category) {
  const cfg = TYPE_CONFIG[category];
  return (cfg && cfg.slug) ? cfg.slug : normalizeType(category);
}

function buildEventId(ev) {
  const d = (getFirstConfiguredValue(ev, "date") || "").toString();
  return `event-${normalizeType(ev.lieu)}-${normalizeType(ev.journaliste)}-${normalizeType(d)}-${ev.compteur_evenements}`;
}

function getFirstConfiguredValue(event, fieldName) {
  for (const field of DATA_FIELDS[fieldName] || []) {
    if (event?.[field] !== undefined && event[field] !== null && event[field] !== "") return event[field];
  }
  return undefined;
}

function getEventOblast(ev) {
  return getFirstConfiguredValue(ev, "zone") || ev.pays || ev.Pays || null;
}

function getEventGeojsonName(ev) {
  return getFirstConfiguredValue(ev, "nomGeojson") || getEventOblast(ev);
}

function isTruthyValue(value) {
  if (value === true) return true;
  if (value === false || value == null) return false;
  const s = String(value).trim().toLowerCase();
  return ["oui", "yes", "true", "1", "si", "sí"].includes(s);
}

function normalizeFilterValue(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getConfiguredEventValue(ev, cfg) {
  if (!ev || !cfg) return undefined;

  const fields = [
    cfg.field,
    ...(Array.isArray(cfg.fields) ? cfg.fields : [])
  ].filter(Boolean);

  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(ev, field)) return ev[field];
  }

  const lowered = new Set(fields.map(field => String(field).toLowerCase()));
  const key = Object.keys(ev).find(name => lowered.has(String(name).toLowerCase()));
  return key ? ev[key] : undefined;
}

function normalizeCrimeElucideStatus(value) {
  const s = String(value ?? "").trim().toLowerCase();
  if (!s) return null;
  if (["oui", "yes", "true", "1", "si", "sí"].includes(s)) return "oui";
  if (["non", "no", "false", "0"].includes(s)) return "non";
  if (["partiellement", "partiel", "partial", "partly", "parcial", "parcialmente"].includes(s)) return "partiellement";
  return null;
}

function eventHasSupplement(ev, key) {
  const cfg = SUPPLEMENT_FILTERS[key];
  if (!cfg) return false;
  const value = getConfiguredEventValue(ev, cfg);

  if (Array.isArray(cfg.values)) {
    const normalized = normalizeFilterValue(value);
    return cfg.values.some(item => normalizeFilterValue(item) === normalized);
  }

  return isTruthyValue(value);
}

function getEventGenderInitial(ev) {
  const value = getConfiguredEventValue(ev, { fields: GENDER_FIELDS });
  const normalized = normalizeFilterValue(value);
  if (!normalized) return "";

  if ((SUPPLEMENT_FILTERS.homme?.values || []).some(item => normalizeFilterValue(item) === normalized)) return "M";
  if ((SUPPLEMENT_FILTERS.femme?.values || []).some(item => normalizeFilterValue(item) === normalized)) return "F";
  return "";
}

function eventMatchesSupplementFilters(ev) {
  if (activeSupplementFilters.size === 0) return true;
  return Array.from(activeSupplementFilters).every(key => eventHasSupplement(ev, key));
}

function getEventHighlightState(ev) {
  if (activeSupplementFilters.size === 0) return "neutral";
  return eventMatchesSupplementFilters(ev) ? "highlighted" : "dimmed";
}

function eventPassesPanelFilters(ev) {
  return eventMatchesSupplementFilters(ev);
}

function getPlaybackWindowStartTime() {
  return Number.isFinite(playbackWindowStartTime) ? playbackWindowStartTime : PLAYBACK_START_TIME;
}

function eventPassesPlaybackWindow(ev, { startTime = getPlaybackWindowStartTime(), cutoffTime = playbackCutoffTime } = {}) {
  const t = getEventTime(ev);
  if (!Number.isFinite(t)) return false;
  if (Number.isFinite(startTime) && t < startTime) return false;
  if (cutoffTime !== null && Number.isFinite(cutoffTime) && t > cutoffTime) return false;
  return true;
}

function eventPassesRegionsChoroplethFilters(ev) {
  const typeOK = selectedTypes.size === 0 || selectedTypes.has(ev.type_violence);
  const playbackOK = eventPassesPlaybackWindow(ev);
  return typeOK && playbackOK && eventPassesOptionFilters(ev, ["oblast", "ville"]);
}

function getFeatureShapeName(feature) {
  return feature?.properties?.shapeName ||
    feature?.properties?.name ||
    feature?.properties?.region ||
    feature?.properties?.shapeName_fr ||
    "";
}

function getOblastDisplayNameForShape(shapeName) {
  if (!shapeName) return null;
  const ev = (allEvents || []).find(item => getEventGeojsonName(item) === shapeName);
  return ev ? getEventOblast(ev) : shapeName;
}

function hexToRgb(hex) {
  const clean = String(hex).replace("#", "");
  const value = parseInt(clean, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function mixHexColor(from, to, t) {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const x = Math.max(0, Math.min(1, t));
  const c = {
    r: Math.round(a.r + (b.r - a.r) * x),
    g: Math.round(a.g + (b.g - a.g) * x),
    b: Math.round(a.b + (b.b - a.b) * x)
  };
  return `rgb(${c.r}, ${c.g}, ${c.b})`;
}

function getRegionCountColor(count, maxCount) {
  if (!count) return CHOROPLETH_SETTINGS.couleurSansCas;
  const t = Math.log1p(count) / Math.log1p(Math.max(1, maxCount));
  return mixHexColor(CHOROPLETH_SETTINGS.couleurMinimum, CHOROPLETH_SETTINGS.couleurMaximum, t);
}

function eventPassesOptionFilters(ev, ignore = []) {
  const ignored = new Set(Array.isArray(ignore) ? ignore : [ignore]);

  if (!ignored.has("oblast") && selectedOblast && getEventOblast(ev) !== selectedOblast) return false;
  if (!ignored.has("ville") && selectedVille && ev.lieu !== selectedVille) return false;
  if (!ignored.has("supplements") && !eventMatchesSupplementFilters(ev)) return false;
  if (!ignored.has("timeline") && !eventPassesPlaybackWindow(ev)) return false;
  return true;
}

function getEventsForOptions(ignore = []) {
  return (allEvents || []).filter(ev => eventPassesOptionFilters(ev, ignore));
}

function getSupplementLabel(key) {
  const cfg = SUPPLEMENT_FILTERS[key];
  return cfg?.labels?.[currentLang] || cfg?.labels?.fr || key;
}

function getEventSupplementBadges(ev) {
  return Object.keys(SUPPLEMENT_FILTERS)
    .filter(key => key !== "crime_elucide")
    .filter(key => SUPPLEMENT_FILTERS[key]?.showBadge !== false)
    .filter(key => eventHasSupplement(ev, key))
    .map(key => getSupplementLabel(key));
}

function getCrimeElucideBadge(ev) {
  const status = normalizeCrimeElucideStatus(ev?.crime_elucide ?? ev?.Crime_elucide ?? ev?.["crime élucidé"]);
  if (!status) return null;

  const labels = {
    non: {
      fr: "Crime non élucidé",
      en: "Unsolved crime",
      es: "Crimen no esclarecido"
    },
    oui: {
      fr: "Crime élucidé",
      en: "Solved crime",
      es: "Crimen esclarecido"
    },
    partiellement: {
      fr: "Crime partiellement élucidé",
      en: "Partly solved crime",
      es: "Crimen parcialmente esclarecido"
    }
  };

  return {
    status,
    label: labels[status]?.[currentLang] || labels[status]?.fr || status
  };
}

function getNumberLocale() {
  if (currentLang === "en") return "en-US";
  if (currentLang === "es") return "es-ES";
  return "fr-FR";
}

function formatSummaryNumber(value) {
  return new Intl.NumberFormat(getNumberLocale()).format(value);
}

function formatSummaryPercent(count, total) {
  const value = total ? (count / total) * 100 : 0;
  return new Intl.NumberFormat(getNumberLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function getFloatingSummaryEvents() {
  return (allEvents || []).filter(ev => eventPassesPlaybackWindow(ev));
}

function getFloatingSummaryRangeLabels(summaryEvents) {
  const startTime = getPlaybackWindowStartTime();
  const endTime = getPlaybackWindowEndTime();

  return {
    startDate: Number.isFinite(startTime) ? formatDateFR(startTime) : "",
    endDate: Number.isFinite(endTime) ? formatDateFR(endTime) : ""
  };
}

function updateFloatingSubtitle() {
  const subtitleEl = document.getElementById("floating-subtitle");
  if (!subtitleEl) return;

  const ui = UI_STRINGS[currentLang]?.ui || UI_STRINGS.fr.ui;
  const summaryEvents = getFloatingSummaryEvents();
  const totalRaw = summaryEvents.length;
  const { startDate, endDate } = getFloatingSummaryRangeLabels(summaryEvents);
  const total = formatSummaryNumber(totalRaw);

  const base = typeof ui.floatingSubtitleBase === "function"
    ? ui.floatingSubtitleBase({ startDate, endDate, total, totalRaw })
    : (ui.floatingSubtitle || "");

  const supplementParts = SUPPLEMENT_SUMMARY_ORDER
    .filter(key => activeSupplementFilters.has(key))
    .map(key => {
      const countRaw = summaryEvents.filter(ev => eventHasSupplement(ev, key)).length;
      const count = formatSummaryNumber(countRaw);
      const percent = formatSummaryPercent(countRaw, totalRaw);
      const builder = ui.supplementSummaries?.[key];
      return (typeof builder === "function") ? builder({ count, countRaw, percent, totalRaw }) : "";
    })
    .filter(Boolean);

  subtitleEl.textContent = [base, ...supplementParts].filter(Boolean).join(" ");
}

function getShapeNameForSelectedOblast(oblastName) {
  if (!oblastName) return null;
  const ev0 = allEvents.find(ev => (getEventOblast(ev) || "") === oblastName);
  return ev0 ? getEventGeojsonName(ev0) : oblastName;
}


/// === BOTTOM CHART ===

function formatDayLabelUTC(dayTs) {
  return formatDateFR(dayTs);
}

function formatDateInputValue(ts) {
  if (!Number.isFinite(ts)) return "";
  const d = new Date(ts);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseDateInputValue(value, { endOfDayValue = false } = {}) {
  const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const ts = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return endOfDayValue ? endOfDay(ts) : ts;
}

function getPlaybackTimelineMaxTime() {
  const eventTimes = (allEvents || [])
    .map(ev => getEventTime(ev))
    .filter(Number.isFinite);
  const maxTime = eventTimes.length ? Math.max(...eventTimes) : PLAYBACK_START_TIME;
  return endOfDay(maxTime);
}

function getPlaybackWindowEndTime() {
  return Number.isFinite(playbackCutoffTime) ? playbackCutoffTime : getPlaybackTimelineMaxTime();
}

function updatePlaybackDateUI() {
  const el = document.querySelector(".playback-date");
  if (!el) return;

  if (playbackCutoffTime == null) {
    el.textContent = "";
    return;
  }

  const startTime = getPlaybackWindowStartTime();
  el.textContent = Number.isFinite(startTime)
    ? `${formatDateFR(startTime)} - ${formatDateFR(playbackCutoffTime)}`
    : formatDateFR(playbackCutoffTime);
}

function setPlaybackWindowStartFromTimeline(ts, { allowBeforeMin = false, allowBeyondMax = false, ignoreCurrentEnd = false } = {}) {
  Playback.pause?.();

  const dayStart = startOfDayUTC(ts);
  if (!Number.isFinite(dayStart)) return;

  const defaultMinStart = startOfDayUTC(PLAYBACK_START_TIME);
  const minStart = allowBeforeMin ? Math.min(defaultMinStart, dayStart) : defaultMinStart;
  const timelineMaxStart = startOfDayUTC(getPlaybackTimelineMaxTime());
  const maxStart = allowBeyondMax ? Math.max(timelineMaxStart, dayStart) : timelineMaxStart;
  const endDay = !ignoreCurrentEnd && Number.isFinite(playbackCutoffTime) ? startOfDayUTC(playbackCutoffTime) : null;
  const upperBound = Number.isFinite(endDay) ? Math.min(endDay, maxStart) : maxStart;
  const nextStart = Math.min(Math.max(dayStart, minStart), upperBound);

  playbackWindowStartTime = nextStart;
  updatePlaybackDateUI?.();
}

function setPlaybackCutoffFromTimeline(ts, { allowBeforeMin = false, allowBeyondMax = false } = {}) {
  Playback.pause?.();

  const startTime = getPlaybackWindowStartTime();
  const minEnd = Number.isFinite(startTime)
    ? startOfDayUTC(startTime) + (24 * 3600 * 1000) - 1
    : null;
  const maxEnd = allowBeyondMax ? Math.max(getPlaybackTimelineMaxTime(), endOfDay(ts)) : getPlaybackTimelineMaxTime();
  const defaultMinBound = PLAYBACK_START_TIME;
  const minBound = Number.isFinite(minEnd)
    ? minEnd
    : (allowBeforeMin ? Math.min(defaultMinBound, ts) : defaultMinBound);
  const nextCutoff = Math.min(Math.max(ts, minBound), maxEnd);

  let idx = -1;
  for (let i = 0; i < playbackSequence.length; i++) {
    const t = getEventTime(playbackSequence[i]);
    if (!Number.isFinite(t)) continue;
    if (t <= nextCutoff) idx = i;
    else break;
  }

  setPlaybackState({
    playbackCutoffTime: nextCutoff,
    playbackIndex: idx
  });

  updatePlaybackDateUI?.();
}

function updateBottomChart(force = false) {
  BottomChart.update({
    force,

    getState: () => ({
      allEvents,
      selectedTypes,
      selectedOblast: statsSelectedOblast,
      selectedVille: statsSelectedVille,
      supplementFilterKey: Array.from(activeSupplementFilters).sort().join("|"),
      playbackWindowStartTime: getPlaybackWindowStartTime(),
      playbackCutoffTime,
      currentLang,
      getEventOblast,
      eventPassesPanelFilters
    }),

    pausePlayback: Playback.pause,
    render: afficherEvenements,

    setPlaybackWindowStartTime: setPlaybackWindowStartFromTimeline,
    setPlaybackCutoffTime: setPlaybackCutoffFromTimeline,

    getDisplayLabelForType: (type) => getDisplayLabelForType(type, currentLang),
    typeConfigKeys: Object.keys(TYPE_CONFIG),
    typeColors: TYPE_COLORS,
    formatDayLabelUTC,
    getEventTime,
    startOfDayUTC,
    playbackStartTime: PLAYBACK_START_TIME
  });
}


/// === ICÔNES ===

function createMarkerIcon(type) {
  const cfg = TYPE_CONFIG[type];
  if (!cfg) return L.icon({ iconUrl: DEFAULT_ICON_URL, iconSize: [24, 24] });

  return L.divIcon({
    html: `<div class="marker-icon marker-${cfg.slug}" style="background-image:url('${iconUrl(cfg.file)}')"></div>`,
    className: "",
    iconSize: [36, 36],
    popupAnchor: [0, -12]
  });
}

function createLegendIcon(type) {
  const cfg = TYPE_CONFIG[type];
  const url = cfg ? iconUrl(cfg.file) : DEFAULT_ICON_URL;
  return L.icon({ iconUrl: url, iconSize: [36, 36] });
}


function getLegendIconUrl(type) {
  return createLegendIcon(type).options.iconUrl;
}



/// === PANELS (gauche/droite) ===

function syncUtilityMenuState() {
  const eventPanelOpen = document.getElementById("event-panel")?.classList.contains("expanded");
  const countryPanelOpen = document.getElementById("country-panel")?.classList.contains("expanded");
  const chartOpen = document.getElementById("bottom-chart-panel")?.classList.contains("open");

  document.getElementById("utility-events-toggle")?.classList.toggle("active", !!eventPanelOpen);
  const regionsBtn = document.getElementById("utility-regions-mode-toggle");
  regionsBtn?.classList.toggle("active", regionsModeActive);
  regionsBtn?.setAttribute("aria-pressed", regionsModeActive ? "true" : "false");
  document.getElementById("utility-country-toggle")?.classList.toggle("active", !!countryPanelOpen);
  document.getElementById("utility-chart-toggle")?.classList.toggle("active", !!chartOpen);
}

function setPanelExpanded(expanded) {
  const panel = document.getElementById("event-panel");
  if (!panel) return;

  const shouldExpand = expanded === "toggle"
    ? !panel.classList.contains("expanded")
    : !!expanded;
  const countryPanel = document.getElementById("country-panel");

  panel.classList.toggle("expanded", shouldExpand);
  panel.classList.toggle("collapsed", !shouldExpand);

  if (shouldExpand) {
    countryPanel?.classList.remove("expanded");
    countryPanel?.classList.add("collapsed");
  }

  syncUtilityMenuState();
}

function setRightPanelExpanded(expanded) {
  const panel = document.getElementById("country-panel");
  if (!panel) return;

  const shouldExpand = expanded === "toggle"
    ? !panel.classList.contains("expanded")
    : !!expanded;
  const eventPanel = document.getElementById("event-panel");

  panel.classList.toggle("expanded", shouldExpand);
  panel.classList.toggle("collapsed", !shouldExpand);

  if (shouldExpand) {
    eventPanel?.classList.remove("expanded");
    eventPanel?.classList.add("collapsed");
  }

  syncUtilityMenuState();
}

function openRegionsPanelFromMenu() {
  const panel = document.getElementById("country-panel");
  const isSameViewOpen = panel?.classList.contains("expanded");
  if (isSameViewOpen) {
    setRightPanelExpanded(false);
    return;
  }
  updateOblastPanel(selectedOblast);
  setRightPanelExpanded(true);
}


/// === LISTE : focus event ===

function highlightEventInList(ev) {
  const targetId = buildEventId(ev);
  const target = document.getElementById(targetId);
  const list = document.getElementById("event-list");
  if (!target || !list) return;

  const EMBED_MODE = window.self !== window.top;

  setTimeout(() => {
    if (!EMBED_MODE) {
      target.scrollIntoView({ behavior: "auto", block: "start" });
    } else {
      const listRect = list.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();

      const top =
        list.scrollTop +
        (targetRect.top - listRect.top) -
        12; // petit padding visuel

      list.scrollTo({ top, behavior: "auto" });
    }

    target.classList.add("highlighted");
    setTimeout(() => target.classList.remove("highlighted"), 1500);
  }, 150);
}


function spiderfyIfClustered(clusterGroup, marker, { zoom = null } = {}) {
  if (!clusterGroup || !marker) return;

  if (Number.isFinite(zoom) && map.getZoom() < zoom) {
    map.setZoom(zoom, { animate: true });
  }

  clusterGroup.zoomToShowLayer(marker, () => {
    const parent = clusterGroup.getVisibleParent(marker);
    if (parent && parent !== marker && typeof parent.spiderfy === "function") parent.spiderfy();
    if (marker.getLatLng) map.panTo(marker.getLatLng(), { animate: true });
  });
}

function focusEvent(ev, marker = null) {
  setPanelExpanded(true);
  highlightEventInList(ev);

  if (marker?.getLatLng) map.setView(marker.getLatLng(), map.getZoom(), { animate: true });
  else if (Number.isFinite(ev?.lat) && Number.isFinite(ev?.lng)) map.setView([ev.lat, ev.lng], map.getZoom(), { animate: true });

  spiderfyIfClustered(EventsRenderer.getClusterGroup(), marker, { zoom: null });
}


async function loadOblastsGeojson() {
  if (regionsGeojsonData) return regionsGeojsonData;
  if (!regionsGeojsonPromise) {
    regionsGeojsonPromise = (async () => {
      const resp = await fetch(withV(REGIONS_GEOJSON_URL));
      if (!resp.ok) throw new Error(`GeoJSON ${REGIONS_GEOJSON_URL}: HTTP ${resp.status}`);
      regionsGeojsonData = await resp.json();
      return regionsGeojsonData;
    })().catch(error => {
      regionsGeojsonPromise = null;
      throw error;
    });
  }
  return regionsGeojsonPromise;
}

/// === OBLAST HIGHLIGHT ===

function clearOblastHighlight() {
  if (currentOblastLayer && map) {
    map.removeLayer(currentOblastLayer);
    currentOblastLayer = null;
  }
}

async function highlightOblastByShapeName(shapeName) {
  if (!shapeName || !map) return;
  if (regionsModeActive) return;
  if (lastHighlightedOblast === shapeName) return;

  lastHighlightedOblast = shapeName;
  clearOblastHighlight();

  const data = await loadOblastsGeojson();
  if (!data) return;

  const feature = (data.features || []).find(f => (
    f?.properties?.shapeName ||
    f?.properties?.name ||
    f?.properties?.region ||
    ""
  ) === shapeName);
  if (!feature) return;

  currentOblastLayer = geojsonRenderer.createLayer(feature, {
    style: REGLAGES.stylesGeojson.selection,
    interactive: false,
    className: "oblast-highlight"
  }).addTo(map);
}

async function highlightOblastForEvent(ev) {
  const shapeName = getEventGeojsonName(ev);
  if (!shapeName) return;
  return highlightOblastByShapeName(shapeName);
}


/// === CONTOUR / EMPRISE GEOGRAPHIQUE ===

function removeProvinceBoundariesLayer({ cancelPending = false } = {}) {
  if (cancelPending) provinceBoundariesSeq++;
  if (provinceBoundariesLayer && map) {
    map.removeLayer(provinceBoundariesLayer);
  }
  provinceBoundariesLayer = null;
}

async function renderProvinceBoundariesLayer() {
  if (!map || regionsModeActive || !featureEnabled("contour")) {
    removeProvinceBoundariesLayer({ cancelPending: true });
    return;
  }

  if (provinceBoundariesLayer) {
    return;
  }

  const seq = ++provinceBoundariesSeq;
  const data = await loadOblastsGeojson();
  if (!data || seq !== provinceBoundariesSeq || !map || regionsModeActive) return;

  provinceBoundariesLayer = geojsonRenderer.createLayer(data, {
    pane: "overlayPane",
    interactive: false,
    className: "province-boundaries-layer",
    style: REGLAGES.stylesGeojson.contour
  }).addTo(map);

  provinceBoundariesLayer.bringToBack?.();

  const bounds = provinceBoundariesLayer.getBounds();
  if (!provinceBoundariesFitDone && bounds?.isValid?.() && bounds.isValid()) {
      provinceBoundariesFitDone = true;
      if (MAP_SETTINGS.ajusterVueAuContour !== false) {
        map.fitBounds(bounds, { maxZoom: MAP_SETTINGS.zoomMaximumContour });
      }
  }
}

function clearRegionsChoroplethLayer({ cancelPending = false } = {}) {
  if (cancelPending) regionsChoroplethSeq++;
  if (regionsChoroplethLayer && map) {
    map.removeLayer(regionsChoroplethLayer);
  }
  regionsChoroplethLayer = null;
}

function getRegionCountLabel(count) {
  if (currentLang === "en") return count === 1 ? "1 case" : `${count} cases`;
  if (currentLang === "es") return count === 1 ? "1 caso" : `${count} casos`;
  return count === 1 ? "1 cas" : `${count} cas`;
}

function getRegionTooltipContent(shapeName) {
  const label = getOblastDisplayNameForShape(shapeName) || shapeName;
  const count = regionsChoroplethCounts.get(shapeName) || 0;
  return `${escapeHtml(label)} · ${escapeHtml(getRegionCountLabel(count))}`;
}

function getRegionChoroplethStyle(feature) {
  const shapeName = getFeatureShapeName(feature);
  const count = regionsChoroplethCounts.get(shapeName) || 0;
  const opacity = count ? CHOROPLETH_SETTINGS.opaciteAvecCas : CHOROPLETH_SETTINGS.opaciteSansCas;
  return {
    stroke: true,
    fill: true,
    color: CHOROPLETH_SETTINGS.contour,
    weight: CHOROPLETH_SETTINGS.epaisseurContour,
    opacity: 1,
    fillColor: getRegionCountColor(count, regionsChoroplethMaxCount),
    fillOpacity: opacity
  };
}

async function renderRegionsChoroplethLayer() {
  if (!map || !regionsModeActive) {
    clearRegionsChoroplethLayer({ cancelPending: true });
    return;
  }

  const seq = ++regionsChoroplethSeq;
  const data = await loadOblastsGeojson();
  if (!data || seq !== regionsChoroplethSeq || !regionsModeActive) return;

  const countsByShape = new Map();
  for (const ev of (allEvents || []).filter(eventPassesRegionsChoroplethFilters)) {
    const shapeName = getEventGeojsonName(ev);
    if (!shapeName) continue;
    countsByShape.set(shapeName, (countsByShape.get(shapeName) || 0) + 1);
  }

  regionsChoroplethCounts = countsByShape;
  regionsChoroplethMaxCount = Math.max(1, ...countsByShape.values());

  // Les filtres changent les couleurs et les compteurs, pas les geometries.
  if (regionsChoroplethLayer) {
    regionsChoroplethLayer.setStyle(getRegionChoroplethStyle);
    regionsChoroplethLayer.eachLayer(layer => {
      layer.getTooltip()?.setContent(getRegionTooltipContent(getFeatureShapeName(layer.feature)));
    });
    return;
  }

  regionsChoroplethLayer = geojsonRenderer.createLayer(data, {
    pane: "overlayPane",
    className: "regions-choropleth-layer",
    style: getRegionChoroplethStyle,
    onEachFeature: (feature, layer) => {
      const shapeName = getFeatureShapeName(feature);
      layer.bindTooltip(getRegionTooltipContent(shapeName), {
        sticky: true,
        direction: "top",
        className: "regions-choropleth-tooltip"
      });

      layer.on({
        tooltipopen: event => {
          event.tooltip.setContent(getRegionTooltipContent(shapeName));
        },
        click: (e) => {
          L.DomEvent.stop(e);
          e?.originalEvent?.target?.blur?.();
          if (!regionsChoroplethCounts.get(shapeName)) return;
          const nextOblast = getOblastDisplayNameForShape(shapeName);
          if (nextOblast) applyTitleOblastFilter(nextOblast);
        }
      });
    }
  }).addTo(map);
}

function setRegionsMode(active) {
  if (active && !featureEnabled("choropleth")) return;
  const next = Boolean(active);
  if (regionsModeActive === next) return;

  regionsModeActive = next;
  clearOblastHighlight();

  if (regionsModeActive) {
    removeProvinceBoundariesLayer({ cancelPending: true });
  } else {
    clearRegionsChoroplethLayer({ cancelPending: true });
    renderProvinceBoundariesLayer();
  }

  afficherEvenements();
  syncUtilityMenuState();
}


/// === PANEL DROIT (stats) ===

async function updateOblastPanel(oblastName) {
  const nameEl = document.getElementById("country-name");
  const chartTabsEl = document.getElementById("country-chart-tabs");
  if (!nameEl) return;

  if (!oblastName) {
    nameEl.textContent = UI_STRINGS[currentLang].ui.selectOblast;
    if (chartTabsEl) chartTabsEl.innerHTML = "";
    renderRightPanelBody();
    return;
  }

  nameEl.innerHTML = `
    <span class="country-title-text">${escapeHtml(oblastName)}</span>
    <button id="country-clear-filter" class="country-clear-btn" title="Supprimer le filtre">✕</button>
  `;

  const clearBtn = document.getElementById("country-clear-filter");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      Playback.pause();
      OblastFilters.clearFiltersPreservePlayback({ resetZoom: false });
      setRightPanelExpanded(true);
    });
  }

  if (chartTabsEl) chartTabsEl.innerHTML = "";

  renderRightPanelBody();
}


/// === PANEL DROIT : construction + rendu ===

function renderRightPanelBody() {
  renderOverviewStackedChart(overviewMode, {
    containerId: "country-chart-container",
    showTabs: true
  });
}

function buildStackedCountsByGroup({ groupBy, onlyOblast = null, startTime = null, cutoffTime = null }) {
  const allCats = Object.keys(TYPE_CONFIG);
  const keyFn = (ev) => {
    if (groupBy === "villes") return ev.lieu || null;
    return getEventOblast(ev) || null;
  };

  const counts = {};
  for (const ev of allEvents) {
    if (!eventMatchesSupplementFilters(ev)) continue;
    if (onlyOblast && getEventOblast(ev) !== onlyOblast) continue;

    if (!eventPassesPlaybackWindow(ev, { startTime, cutoffTime })) continue;

    const g = keyFn(ev);
    if (!g) continue;

    const type = ev.type_violence;
    if (!TYPE_CONFIG[type]) continue;

    if (!counts[g]) {
      counts[g] = {};
      for (const cat of allCats) counts[g][cat] = 0;
    }
    counts[g][type] += 1;
  }

  const rows = Object.entries(counts).map(([name, byType]) => {
    const total = allCats.reduce((acc, cat) => acc + (byType[cat] || 0), 0);
    return { name, byType, total };
  });

  rows.sort((a, b) => b.total - a.total);
  return { rows, allCats };
}

function getOrCreateRightChartWrapper(container) {
  let chartWrapper = container.querySelector(".chart-bars");
  if (!chartWrapper) {
    container.innerHTML = "";
    chartWrapper = document.createElement("div");
    chartWrapper.className = "chart-bars";
    container.appendChild(chartWrapper);
  }
  return chartWrapper;
}

function getRightChartRowsMap(containerId) {
  if (!rightChartRowsByContainer.has(containerId)) {
    rightChartRowsByContainer.set(containerId, new Map());
  }
  return rightChartRowsByContainer.get(containerId);
}

function upsertRightChartRow({ chartWrapper, containerId, name, allCats }) {
  const rowsMap = getRightChartRowsMap(containerId);
  let entry = rowsMap.get(name);
  if (entry && entry.rowEl?.isConnected) return entry;

  const row = document.createElement("div");
  row.className = "chart-bar-row";
  row.style.willChange = "transform";

  const label = document.createElement("span");
  label.className = "chart-bar-label";
  label.textContent = name;

  const bar = document.createElement("div");
  bar.className = "chart-bar";

  const value = document.createElement("span");
  value.className = "chart-bar-value";
  value.textContent = "0";

  row.appendChild(label);
  row.appendChild(bar);
  row.appendChild(value);
  chartWrapper.appendChild(row);

  const segElsByType = new Map();
  for (const cat of allCats) {
    const seg = document.createElement("div");
    seg.className = `chart-bar-segment chart-bar-fill chart-bar-fill-${getTypeSlugFromCategory(cat)}`;
    seg.style.width = "0%";
    seg.style.transition = "width 220ms ease";
    bar.appendChild(seg);
    segElsByType.set(cat, seg);
  }

  entry = { rowEl: row, labelEl: label, barEl: bar, valueEl: value, segElsByType };
  rowsMap.set(name, entry);
  return entry;
}

function animateReorderFLIPWithFirst(items, firstTopByEl) {
  requestAnimationFrame(() => {
    for (const it of items) {
      const row = it.rowEl;
      const firstTop = firstTopByEl.get(row);
      if (firstTop == null) continue;

      const lastTop = row.getBoundingClientRect().top;
      const dy = firstTop - lastTop;
      if (!dy) continue;

      row.style.transition = "none";
      row.style.transform = `translateY(${dy}px)`;

      requestAnimationFrame(() => {
        row.style.transition = "transform 220ms ease";
        row.style.transform = "translateY(0)";
      });
    }
  });
}

function renderOverviewStackedChart(groupBy, { containerId = "country-chart-container", showTabs = true } = {}) {
  const container = document.getElementById(containerId);
  const tabsEl = document.getElementById("country-chart-tabs");
  if (!container) return;

  const ui = UI_STRINGS[currentLang]?.ui;

  // boutons toggle "Oblasts / Villes"
  if (tabsEl && showTabs) {
    tabsEl.innerHTML = "";
    const configuredViews = new Set(REGLAGES.controles.statistiques.vues || ["zones", "emplacements"]);

    if (configuredViews.has("zones")) {
      const btnOb = document.createElement("button");
      btnOb.className = "chart-tab-btn";
      btnOb.type = "button";
      btnOb.textContent = ui?.oblastsBtn ?? "Oblasts";
      btnOb.setAttribute("aria-pressed", groupBy === "oblasts" ? "true" : "false");
      if (groupBy === "oblasts") btnOb.classList.add("active");
      btnOb.addEventListener("click", () => {
        overviewMode = "oblasts";
        renderOverviewStackedChart("oblasts");
      });
      tabsEl.appendChild(btnOb);
    }

    if (configuredViews.has("emplacements")) {
      const btnVi = document.createElement("button");
      btnVi.className = "chart-tab-btn";
      btnVi.type = "button";
      btnVi.textContent = ui?.villesBtn ?? "Villes";
      btnVi.setAttribute("aria-pressed", groupBy === "villes" ? "true" : "false");
      if (groupBy === "villes") btnVi.classList.add("active");
      btnVi.addEventListener("click", () => {
        overviewMode = "villes";
        renderOverviewStackedChart("villes");
      });
      tabsEl.appendChild(btnVi);
    }
  } else if (tabsEl && !showTabs) {
    tabsEl.innerHTML = "";
  }

  // cutoff à date + filtre villes si oblast filtré
  const startTime = getPlaybackWindowStartTime();
  const cutoffTime = playbackCutoffTime;
  const onlyOblast = (groupBy === "villes") ? statsSelectedOblast : null;


  const { rows, allCats } = buildStackedCountsByGroup({
    groupBy,
    onlyOblast,
    startTime,
    cutoffTime
  });

  if (!rows.length) {
    container.innerHTML = `<p class="chart-placeholder">${ui?.chartNoEvents ?? "Aucune donnée"}</p>`;
    return;
  }

  const MAX_ROWS = groupBy === "villes"
    ? REGLAGES.controles.statistiques.lignesMaximumEmplacements
    : REGLAGES.controles.statistiques.lignesMaximumZones;
  const shown = rows.slice(0, MAX_ROWS);
  const maxTotal = shown[0]?.total || 1;
  const chartWrapper = getOrCreateRightChartWrapper(container);
  const rowsMap = getRightChartRowsMap(containerId);
  const usedNames = new Set();
  const rowEntries = [];
  const firstTopByEl = new Map();


  for (const { name } of shown) {
    const entry = upsertRightChartRow({ chartWrapper, containerId, name, allCats });
    entry.rowEl.style.display = ""; // visible
    usedNames.add(name);
    rowEntries.push(entry);
    firstTopByEl.set(entry.rowEl, entry.rowEl.getBoundingClientRect().top);
  }

  for (const [name, entry] of rowsMap.entries()) {
    if (!entry?.rowEl?.isConnected) continue;
    if (!usedNames.has(name)) {
      entry.rowEl.style.display = "none";
      entry.rowEl.style.order = "9999";
    }
  }

  shown.forEach(({ name, byType, total }, idx) => {
    const entry = rowsMap.get(name);
    if (!entry) return;

    entry.rowEl.style.order = String(idx);

    entry.rowEl.classList.toggle(
      "is-current-country",
      (groupBy === "oblasts" && statsSelectedOblast && name === statsSelectedOblast) ||
      (groupBy === "villes" && statsSelectedVille && name === statsSelectedVille)
    );

    entry.valueEl.textContent = String(total);

    entry.labelEl.style.cursor = "pointer";
    entry.labelEl.title = (currentLang === "en") ? "Filter" : "Filtrer";
    entry.labelEl.onclick = () => {
      Playback.pause?.();

      if (groupBy === "oblasts") {
        selectedOblast = name;
        selectedVille = null;
        statsSelectedOblast = name;
        statsSelectedVille = null;


        villesDisponibles = getAvailableVilles(name);

        syncTitleFilterControls();
        updateOblastPanel(name);
        setRightPanelExpanded(true);

        const ev0 = allEvents.find(ev => getEventOblast(ev) === name);
        if (ev0) highlightOblastForEvent?.(ev0);

        zoomToOblast(name);
        setPanelExpanded(true);
        afficherEvenements();
      } else if (groupBy === "villes") {
        const ville = name;

        const ev0 = allEvents.find(ev =>
          ev.lieu === ville && (!selectedOblast || getEventOblast(ev) === selectedOblast)
        );
        const ob = ev0 ? getEventOblast(ev0) : null;

        if (!ob) {
          selectedVille = ville;
          afficherEvenements();
          return;
        }

        selectedOblast = ob;
        selectedVille = ville;
        statsSelectedOblast = ob;
        statsSelectedVille = ville;


        villesDisponibles = getAvailableVilles(ob);

        const select = document.getElementById("ville-select");
        if (select) select.value = ville;
        syncTitleFilterControls();

        setPanelExpanded(true);
        updateOblastPanel(ob);
        setRightPanelExpanded(true);

        if (ev0) highlightOblastForEvent?.(ev0);
        afficherEvenements();

        if (Number.isFinite(ev0?.lat) && Number.isFinite(ev0?.lng) && map) {
          map.setView([ev0.lat, ev0.lng], MAP_SETTINGS.zoomSurEmplacement, { animate: true });
        }
      }
    };

    const totalWidthPct = (total / maxTotal) * 100;
    for (const cat of allCats) {
      const v = byType[cat] || 0;
      const seg = entry.segElsByType.get(cat);
      if (!seg) continue;

      const segPct = (total > 0) ? (v / total) * totalWidthPct : 0;
      seg.style.width = `${segPct}%`;
      seg.style.display = v > 0 ? "block" : "none";
    }
  });

  animateReorderFLIPWithFirst(rowEntries, firstTopByEl);
}

/// === RENDU ÉVÉNEMENTS ===

function getTitleFilterLabel(key) {
  const labels = {
    allRegions: { fr: "Toutes les regions", en: "All regions", es: "Todos los estados" },
    allCities: { fr: "Toutes les villes", en: "All cities", es: "Todas las ciudades" },
    calendarStart: { fr: "Début", en: "Start", es: "Inicio" },
    calendarEnd: { fr: "Fin", en: "End", es: "Fin" },
    selectRegionFirst: {
      fr: "Selectionnez d'abord une region",
      en: "Select a region first",
      es: "Seleccione primero un estado"
    }
  };
  return labels[key]?.[currentLang] || labels[key]?.fr || key;
}

function getAvailableOblasts() {
  return Array.from(new Set(getEventsForOptions(["oblast"]).map(ev => getEventOblast(ev))))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
}

function getAvailableVilles(oblast = selectedOblast) {
  return Array.from(new Set(
    getEventsForOptions(["ville"])
      .filter(ev => !oblast || getEventOblast(ev) === oblast)
      .map(ev => ev.lieu)
  ))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
}

function reconcileTitleFilterSelections() {
  let changed = false;

  for (let i = 0; i < 4; i++) {
    let changedThisPass = false;

    const availableOblasts = getAvailableOblasts();
    if (selectedOblast && !availableOblasts.includes(selectedOblast)) {
      selectedOblast = null;
      selectedVille = null;
      statsSelectedOblast = null;
      statsSelectedVille = null;
      villesDisponibles = [];
      clearOblastHighlight?.();
      lastHighlightedOblast = null;
      changed = true;
      changedThisPass = true;
    }

    const availableVilles = selectedOblast ? getAvailableVilles(selectedOblast) : getAvailableVilles(null);
    if ((!selectedOblast && selectedVille) || (selectedVille && !availableVilles.includes(selectedVille))) {
      selectedVille = null;
      statsSelectedVille = null;
      changed = true;
      changedThisPass = true;
    }

    if (!changedThisPass) break;
  }

  villesDisponibles = selectedOblast ? getAvailableVilles(selectedOblast) : [];
  return changed;
}

function populateTitleOblastSelect(oblasts = getAvailableOblasts()) {
  const select = document.getElementById("title-oblast-select");
  if (!select) return;

  const previous = selectedOblast || "";
  select.innerHTML = "";

  const optAll = document.createElement("option");
  optAll.value = "";
  optAll.textContent = getTitleFilterLabel("allRegions");
  select.appendChild(optAll);

  (oblasts || []).forEach(oblast => {
    const opt = document.createElement("option");
    opt.value = oblast;
    opt.textContent = oblast;
    select.appendChild(opt);
  });

  select.value = (oblasts || []).includes(previous) ? previous : "";
}

function isPlaybackWindowDefault() {
  const startTime = getPlaybackWindowStartTime();
  const endTime = getPlaybackWindowEndTime();
  return Number.isFinite(startTime) &&
    Number.isFinite(endTime) &&
    startOfDayUTC(startTime) === startOfDayUTC(PLAYBACK_START_TIME) &&
    startOfDayUTC(endTime) >= startOfDayUTC(getPlaybackTimelineMaxTime());
}

function syncTitleCalendarControls() {
  const startInput = document.getElementById("title-calendar-start");
  const endInput = document.getElementById("title-calendar-end");
  const startControl = document.getElementById("title-calendar-start-button");
  const endControl = document.getElementById("title-calendar-end-button");
  const startLabel = document.getElementById("title-calendar-start-label");
  const endLabel = document.getElementById("title-calendar-end-label");
  if (!startInput && !endInput && !startControl && !endControl) return;

  const startTime = getPlaybackWindowStartTime();
  const endTime = getPlaybackWindowEndTime();
  const minValue = formatDateInputValue(PLAYBACK_START_TIME);
  const maxValue = formatDateInputValue(getPlaybackTimelineMaxTime());
  const startValue = formatDateInputValue(startTime);
  const endValue = formatDateInputValue(endTime);
  const startIsDefault = startOfDayUTC(startTime) === startOfDayUTC(PLAYBACK_START_TIME);
  const endIsDefault = startOfDayUTC(endTime) >= startOfDayUTC(getPlaybackTimelineMaxTime());

  if (startLabel) startLabel.textContent = getTitleFilterLabel("calendarStart");
  if (endLabel) endLabel.textContent = getTitleFilterLabel("calendarEnd");

  if (startInput) {
    startInput.min = minValue;
    startInput.max = endValue || maxValue;
    startInput.value = startValue;
    startInput.title = formatDateFR(startTime);
  }

  if (startControl) {
    startControl.title = formatDateFR(startTime);
    startControl.setAttribute("aria-label", `${getTitleFilterLabel("calendarStart")} ${formatDateFR(startTime)}`);
  }

  if (endInput) {
    endInput.min = startValue || minValue;
    endInput.max = maxValue;
    endInput.value = endValue;
    endInput.title = formatDateFR(endTime);
  }

  if (endControl) {
    endControl.title = formatDateFR(endTime);
    endControl.setAttribute("aria-label", `${getTitleFilterLabel("calendarEnd")} ${formatDateFR(endTime)}`);
  }

  startControl?.classList.toggle("active", !startIsDefault);
  endControl?.classList.toggle("active", !endIsDefault);
}

function openTitleDateInput(input) {
  if (!input) return;

  if (input.type !== "date") input.type = "date";
  input.focus({ preventScroll: true });

  if (typeof input.showPicker === "function") {
    try {
      input.showPicker();
      return;
    } catch (err) {
      // Some browsers reject showPicker for visually hidden inputs; click fallback below.
    }
  }

  input.click();
}

function applyTitleCalendarInputs() {
  const startInput = document.getElementById("title-calendar-start");
  const endInput = document.getElementById("title-calendar-end");

  const nextStart = parseDateInputValue(startInput?.value);
  const nextEnd = parseDateInputValue(endInput?.value, { endOfDayValue: true });

  if (Number.isFinite(nextStart)) setPlaybackWindowStartFromTimeline(nextStart);
  if (Number.isFinite(nextEnd)) setPlaybackCutoffFromTimeline(nextEnd);

  afficherEvenements();
  renderRightPanelBody();
  updateBottomChart(true);
}

function resetPlaybackWindowToDefault() {
  playbackWindowStartTime = PLAYBACK_START_TIME;
  setPlaybackCutoffFromTimeline(getPlaybackTimelineMaxTime());
}

function syncSupplementFilterButtons() {
  FILTERABLE_SUPPLEMENT_KEYS.forEach(key => {
    const btn = document.querySelector(`[data-supplement-filter="${key}"]`);
    if (!btn) return;
    const active = activeSupplementFilters.has(key);
    btn.textContent = getSupplementLabel(key);
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function syncTitleFilterControls() {
  const changed = reconcileTitleFilterSelections();
  const availableOblasts = getAvailableOblasts();
  const availableVilles = selectedOblast ? getAvailableVilles(selectedOblast) : getAvailableVilles(null);

  populateTitleOblastSelect(availableOblasts);

  const oblastSelect = document.getElementById("title-oblast-select");
  if (oblastSelect && oblastSelect.value !== (selectedOblast || "")) {
    oblastSelect.value = selectedOblast || "";
  }

  syncTitleCalendarControls();
  syncSupplementFilterButtons();
  updateFloatingSubtitle();

  const villeSelect = document.getElementById("ville-select");
  syncTitleClearButton();
  if (!villeSelect) return changed;

  const hasOblast = Boolean(selectedOblast);
  if (!hasOblast && selectedVille) {
    selectedVille = null;
    statsSelectedVille = null;
  }

  villesDisponibles = hasOblast ? availableVilles : [];
  populateTitleVilleSelect(availableVilles);
  villeSelect.classList.remove("hidden");
  villeSelect.disabled = !hasOblast;
  villeSelect.classList.toggle("is-muted", !hasOblast);
  villeSelect.setAttribute("aria-disabled", hasOblast ? "false" : "true");
  villeSelect.title = hasOblast
    ? ""
    : getTitleFilterLabel("selectRegionFirst");
  syncTitleClearButton();
  return changed;
}

function populateTitleVilleSelect(villes) {
  const select = document.getElementById("ville-select");
  if (!select) return;

  const previous = selectedVille || "";
  select.innerHTML = "";

  const optAll = document.createElement("option");
  optAll.value = "";
  optAll.textContent = getTitleFilterLabel("allCities");
  select.appendChild(optAll);

  (villes || []).forEach(ville => {
    const opt = document.createElement("option");
    opt.value = ville;
    opt.textContent = ville;
    select.appendChild(opt);
  });

  select.value = (villes || []).includes(previous) ? previous : "";
  select.onchange = () => {
    Playback.pause?.();
    selectedVille = select.value || null;
    statsSelectedVille = selectedVille;

    syncTitleFilterControls();
    afficherEvenements();

    if (!selectedVille || !map) return;
    const ev0 = allEvents.find(ev =>
      ev.lieu === selectedVille &&
      (!selectedOblast || getEventOblast(ev) === selectedOblast) &&
      eventPassesOptionFilters(ev)
    );
    if (ev0 && Number.isFinite(ev0.lat) && Number.isFinite(ev0.lng)) {
      map.setView([ev0.lat, ev0.lng], MAP_SETTINGS.zoomSurEmplacement, { animate: true });
    }
  };
}

function hasActiveTitleFilters() {
  return Boolean(selectedOblast || selectedVille || activeSupplementFilters.size || !isPlaybackWindowDefault());
}

function syncTitleClearButton() {
  const clearBtn = document.getElementById("title-clear-filters");
  if (clearBtn) clearBtn.hidden = !hasActiveTitleFilters();
}

function applyTitleOblastFilter(oblast) {
  Playback.pause?.();

  selectedOblast = oblast || null;
  selectedVille = null;
  statsSelectedOblast = selectedOblast;
  statsSelectedVille = null;
  villesDisponibles = selectedOblast ? getAvailableVilles(selectedOblast) : [];
  syncTitleFilterControls();

  if (selectedOblast) {
    updateOblastPanel(selectedOblast);
    setRightPanelExpanded(true);
    const ev0 = allEvents.find(ev => getEventOblast(ev) === selectedOblast);
    if (ev0) highlightOblastForEvent(ev0);
    zoomToOblast(selectedOblast);
  } else {
    OblastFilters.clearFiltersPreservePlayback({ resetZoom: false });
  }

  afficherEvenements();
}

function clearTitleFilters({ resetZoom = false } = {}) {
  Playback.pause?.();

  selectedOblast = null;
  selectedVille = null;
  statsSelectedOblast = null;
  statsSelectedVille = null;
  villesDisponibles = [];
  selectedTypes = new Set(allEvents.map(ev => ev.type_violence));
  activeSupplementFilters.clear();
  resetPlaybackWindowToDefault();
  BottomChart.resetZoom?.();

  OblastFilters.clearFiltersPreservePlayback({ resetZoom });
  clearOblastHighlight();
  lastHighlightedOblast = null;
  updateOblastPanel(null);

  afficherEvenements();
  syncTitleFilterControls();
}

function toggleSupplementFilter(key) {
  if (!FILTERABLE_SUPPLEMENT_KEYS.includes(key)) return;
  Playback.pause?.();

  if (activeSupplementFilters.has(key)) {
    activeSupplementFilters.delete(key);
  } else {
    const group = Object.values(SUPPLEMENT_FILTER_GROUPS).find(keys => keys.includes(key)) || [];
    group.forEach(groupKey => activeSupplementFilters.delete(groupKey));
    activeSupplementFilters.add(key);
  }

  syncTitleFilterControls();
  afficherEvenements();
  renderRightPanelBody();
  updateBottomChart(true);
}

function initRsfCartographyModal() {
  const trigger = document.getElementById("rsf-cartography-toggle");
  const modal = document.getElementById("rsf-cartography-modal");
  const closeButton = document.getElementById("rsf-cartography-close");
  if (!trigger || !modal) return;

  const closeModal = () => {
    modal.hidden = true;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  };

  const openModal = () => {
    const utilityMenu = document.getElementById("utility-menu");
    const utilityPanel = document.getElementById("utility-menu-panel");
    const utilityToggle = document.getElementById("utility-menu-toggle");
    utilityMenu?.classList.remove("open");
    if (utilityPanel) utilityPanel.hidden = true;
    utilityToggle?.setAttribute("aria-expanded", "false");

    modal.hidden = false;
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    closeButton?.focus();
  };

  trigger.addEventListener("click", openModal);
  modal.querySelectorAll("[data-close-rsf-cartography]").forEach(button => {
    button.addEventListener("click", closeModal);
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !modal.hidden) closeModal();
  });
}

function initHarmonizedShell() {
  initPanelScrollProgress({ getLanguage: () => currentLang });
  applyConfiguredControls();
  const titlePanel = document.getElementById("floating-controls");
  const titleToggle = document.getElementById("map-title-toggle");
  const oblastSelect = document.getElementById("title-oblast-select");
  const calendarStartButton = document.getElementById("title-calendar-start-button");
  const calendarEndButton = document.getElementById("title-calendar-end-button");
  const calendarStart = document.getElementById("title-calendar-start");
  const calendarEnd = document.getElementById("title-calendar-end");
  const clearBtn = document.getElementById("title-clear-filters");
  const utilityMenu = document.getElementById("utility-menu");
  const utilityToggle = document.getElementById("utility-menu-toggle");
  const utilityPanel = document.getElementById("utility-menu-panel");

  const toggleTitle = () => {
    if (!titlePanel || !titleToggle) return;
    titlePanel.classList.toggle("collapsed");
    titleToggle.setAttribute("aria-expanded", titlePanel.classList.contains("collapsed") ? "false" : "true");
  };

  titleToggle?.addEventListener("click", toggleTitle);
  titleToggle?.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleTitle();
    }
  });

  oblastSelect?.addEventListener("change", () => applyTitleOblastFilter(oblastSelect.value));
  calendarStartButton?.addEventListener("click", (event) => {
    event.preventDefault();
    openTitleDateInput(calendarStart);
  });
  calendarEndButton?.addEventListener("click", (event) => {
    event.preventDefault();
    openTitleDateInput(calendarEnd);
  });
  calendarStartButton?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openTitleDateInput(calendarStart);
  });
  calendarEndButton?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openTitleDateInput(calendarEnd);
  });
  calendarStart?.addEventListener("change", applyTitleCalendarInputs);
  calendarEnd?.addEventListener("change", applyTitleCalendarInputs);
  document.querySelectorAll("[data-supplement-filter]").forEach(btn => {
    btn.addEventListener("click", () => toggleSupplementFilter(btn.dataset.supplementFilter));
  });
  clearBtn?.addEventListener("click", () => clearTitleFilters({ resetZoom: false }));

  utilityToggle?.addEventListener("click", () => {
    const isOpen = utilityMenu?.classList.toggle("open");
    if (utilityPanel) utilityPanel.hidden = !isOpen;
    utilityToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  document.getElementById("utility-events-toggle")?.addEventListener("click", () => setPanelExpanded("toggle"));
  document.getElementById("utility-regions-mode-toggle")?.addEventListener("click", () => setRegionsMode(!regionsModeActive));
  document.getElementById("utility-country-toggle")?.addEventListener("click", openRegionsPanelFromMenu);
  document.getElementById("utility-chart-toggle")?.addEventListener("click", () => {
    BottomChart.toggle(updateBottomChart);
    syncUtilityMenuState();
  });
  document.getElementById("close-event-panel")?.addEventListener("click", () => setPanelExpanded(false));
  document.getElementById("close-country-panel")?.addEventListener("click", () => setRightPanelExpanded(false));
  document.getElementById("close-bottom-chart")?.addEventListener("click", () => {
    BottomChart.hide();
    syncUtilityMenuState();
  });
  initRsfCartographyModal();
  syncUtilityMenuState();
}

function applyConfiguredControls() {
  const controls = REGLAGES.controles;
  const panelControls = controls.panneauTitre;
  document.title = REGLAGES.projet.titreHtml;
  const robots = document.querySelector('meta[name="robots"]');
  if (robots) robots.content = REGLAGES.projet.indexationMoteurs ? "index, follow" : "noindex, nofollow";
  const stylesheet = document.getElementById("app-stylesheet");
  if (stylesheet) stylesheet.href = withV(FILES.assets.feuilleDeStyle);
  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon) favicon.href = withV(FILES.assets.favicon || FILES.assets.logo);
  const logo = document.querySelector(".floating-logo img");
  if (logo) logo.src = withV(FILES.assets.logo);

  const featureElements = {
    listeCas: ["utility-events-toggle", "event-panel"],
    statistiques: ["utility-country-toggle", "country-panel"],
    chronologie: ["utility-chart-toggle", "bottom-chart-panel"],
    tutoriel: ["tutorial-replay-btn", "tutorial-overlay"],
    choropleth: ["utility-regions-mode-toggle"],
    rsfCartographie: ["rsf-cartography-toggle"]
  };
  for (const [feature, ids] of Object.entries(featureElements)) {
    ids.forEach(id => {
      const element = document.getElementById(id);
      if (element) element.hidden = !featureEnabled(feature);
    });
  }

  const languageField = document.querySelector("#utility-menu-panel .utility-menu-field");
  if (languageField) languageField.hidden = !featureEnabled("langues");
  document.querySelectorAll(".lang-btn").forEach(button => {
    button.hidden = !REGLAGES.projet.langues.includes(button.dataset.lang);
  });
  document.querySelectorAll("[data-supplement-filter]").forEach(button => {
    button.hidden = !FILTERABLE_SUPPLEMENT_KEYS.includes(button.dataset.supplementFilter) || !featureEnabled("filtresAdditionnels");
  });
  const supplementSection = document.getElementById("title-supplement-section");
  if (supplementSection) supplementSection.hidden = !featureEnabled("filtresAdditionnels");

  const menuPanel = document.getElementById("utility-menu-panel");
  const menuIds = {
    tutoriel: "tutorial-replay-btn",
    listeCas: "utility-events-toggle",
    choropleth: "utility-regions-mode-toggle",
    statistiques: "utility-country-toggle",
    chronologie: "utility-chart-toggle",
    rsfCartographie: "rsf-cartography-toggle"
  };
  if (menuPanel) {
    (controls.menu?.ordre || []).map(key => document.getElementById(menuIds[key])).filter(Boolean)
      .forEach(button => menuPanel.appendChild(button));
  }

  const titlePanel = document.getElementById("floating-controls");
  titlePanel?.classList.toggle("collapsed", !panelControls.ouvertParDefaut);
  [
    ["title-date-filters", panelControls.afficherDates !== false],
    ["header-legend", panelControls.afficherCategories !== false],
    ["title-clear-filters", panelControls.afficherEffacerFiltres !== false]
  ].forEach(([id, visible]) => {
    const element = document.getElementById(id);
    if (element) element.hidden = !visible;
  });
  const zoneSelect = document.getElementById("title-oblast-select");
  const locationSelect = document.getElementById("ville-select");
  if (zoneSelect) zoneSelect.hidden = panelControls.afficherZone === false;
  if (locationSelect) locationSelect.hidden = panelControls.afficherEmplacement === false;

  const playbackControls = controls.lecture;
  [
    ["playback-prev", playbackControls.afficherPrecedent],
    ["playback-toggle", playbackControls.afficherLecturePause],
    ["playback-next", playbackControls.afficherSuivant],
    ["playback-end", playbackControls.afficherFin]
  ].forEach(([id, visible]) => {
    const button = document.getElementById(id);
    if (button) button.hidden = visible === false || !featureEnabled("lecture");
  });
  const playbackRow = document.getElementById("title-playback-controls");
  if (playbackRow) playbackRow.hidden = !featureEnabled("lecture");

  const speedSelect = document.getElementById("playback-speed");
  if (speedSelect) {
    speedSelect.replaceChildren(...(playbackControls.vitesses || [1]).map(speed => {
      const option = document.createElement("option");
      option.value = String(speed);
      option.textContent = `${speed}x`;
      return option;
    }));
    speedSelect.value = String(playbackControls.vitesseParDefaut || 1);
  }

  const relatedLinks = [...document.querySelectorAll("#rsf-cartography-modal .rsf-cartography-link")];
  relatedLinks.forEach((link, index) => {
    const config = REGLAGES.cartesLiees[index];
    if (!config) {
      link.hidden = true;
      return;
    }
    link.href = config.href;
    const image = link.querySelector("img");
    if (image) image.src = withV(config.image);
  });
}

function afficherEvenements({ renderGeography = true } = {}) {
  reconcileTitleFilterSelections();

  EventsRenderer.render({
    allEvents,
    selectedTypes,
    selectedOblast,
    selectedVille,
    playbackWindowStartTime: getPlaybackWindowStartTime(),
    playbackCutoffTime,
    currentLang,

    getEventTime,
    getEventOblast,
    getEventGenderInitial,
    getEventLinks: ev => getSafeHttpUrls(ev.lien),
    startOfDayUTC,
    formatDateFR,
    buildEventId,
    normalizeType,
    getEventHighlightState,
    getEventSupplementBadges,
    getCrimeElucideBadge,
    eventPassesPanelFilters,

    getDisplayLabelForType: (type) => getDisplayLabelForType(type, currentLang),

    createMarkerIcon,
    getLegendIconUrl,

    pausePlayback: Playback.pause,
    focusEvent,
    setRightPanelExpanded,
    updateBottomChart,
    caseFields: REGLAGES.listeCas?.champsSupplementaires || [],
    attachToMap: !regionsModeActive || Boolean(selectedOblast)


  });

  if (renderGeography && regionsModeActive) {
    removeProvinceBoundariesLayer({ cancelPending: true });
    renderRegionsChoroplethLayer();
  } else if (renderGeography) {
    clearRegionsChoroplethLayer({ cancelPending: true });
    renderProvinceBoundariesLayer();
  }

  if (document.getElementById("country-chart-container")) {
    renderRightPanelBody();
  }

  syncTitleFilterControls();
  updateFloatingSubtitle();
}

/// === PLAYBACK (state + module) ===

const PLAYBACK_START_DATE_STR = REGLAGES.lecture.dateDebut;
const PLAYBACK_END_DATE_STR = REGLAGES.lecture.dateFin;
const PLAYBACK_END_TIME = PLAYBACK_END_DATE_STR ? getEventTime({ date: PLAYBACK_END_DATE_STR }) : null;
const PLAYBACK_START_TIME = getEventTime({ date: PLAYBACK_START_DATE_STR });
const PLAYBACK_CUES = REGLAGES.lecture.reperes || [];

let playbackActive = false;
let playbackSpeed = Number(REGLAGES.controles.lecture.vitesseParDefaut) || 1;
let playbackTimer = null;
let playbackSequence = [];
let playbackIndex = -1;
let playbackWindowStartTime = PLAYBACK_START_TIME;
let playbackCutoffTime = null;

function getPlaybackState() {
  return {
    allEvents,
    playbackActive,
    playbackSpeed,
    playbackTimer,
    playbackSequence,
    playbackIndex,
    playbackWindowStartTime,
    playbackCutoffTime
  };
}

function setPlaybackState(patch) {
  if ("playbackActive" in patch) playbackActive = patch.playbackActive;
  if ("playbackSpeed" in patch) playbackSpeed = patch.playbackSpeed;
  if ("playbackTimer" in patch) playbackTimer = patch.playbackTimer;
  if ("playbackSequence" in patch) playbackSequence = patch.playbackSequence;
  if ("playbackIndex" in patch) playbackIndex = patch.playbackIndex;
  if ("playbackWindowStartTime" in patch) playbackWindowStartTime = patch.playbackWindowStartTime;
  if ("playbackCutoffTime" in patch) playbackCutoffTime = patch.playbackCutoffTime;
}

function ensurePlaybackToast() {
  let el = document.getElementById("playback-toast");
  if (el) return el;

  el = document.createElement("div");
  el.id = "playback-toast";
  el.className = "playback-toast hidden";
  el.innerHTML = `
    <div class="playback-toast-inner">
      <div class="playback-toast-header">
        <div class="playback-toast-title"></div>
        <div class="playback-toast-date"></div>
      </div>
      <div class="playback-toast-body"></div>
    </div>
  `;
  document.body.appendChild(el);
  return el;
}

let toastTimer = null;

function showPlaybackMessage({ title, dateLabel, body, durationMs = 7600 }) {
  const toast = ensurePlaybackToast();
  if (!toast) return;

  const tEl = toast.querySelector(".playback-toast-title");
  const dEl = toast.querySelector(".playback-toast-date");
  const bEl = toast.querySelector(".playback-toast-body");

  if (tEl) tEl.textContent = title || "";
  if (dEl) dEl.textContent = dateLabel ? `— ${dateLabel}` : "";
  if (bEl) bEl.textContent = body || "";

  toast.classList.remove("hidden");
  toast.classList.add("show");

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.classList.add("hidden"), 250);
  }, durationMs);
}

const Playback = createPlayback({
  getState: getPlaybackState,
  setState: setPlaybackState,
  PLAYBACK_START_TIME,
  PLAYBACK_START_DATE_STR,
  PLAYBACK_END_TIME,
  PLAYBACK_END_DATE_STR,
  getEventTime,
  startOfDay,
  endOfDay,
  formatDateFR,
  getWindowStartTime: getPlaybackWindowStartTime,
  buildEventId,
  render: afficherEvenements,

  contextCues: PLAYBACK_CUES,
  parseDateFlexible,
  onContextCue: ({ key, durationMs, ts }) => {
    const dict = UI_STRINGS[currentLang]?.playbackMessages || {};
    const title = dict[`${key}_title`] || "";
    const body = dict[`${key}_body`] || "";
    if (!title && !body) return;

    const dateLabel = ts ? formatDateFR(ts) : "";
    showPlaybackMessage({ title, dateLabel, body, durationMs });
  }
});


/// === TUTORIEL (module) ===

const Tutorial = createTutorial({
  getState: () => ({ currentLang, allEvents }),
  setPanelExpanded,
  setRightPanelExpanded,
  updateOblastPanel,
  highlightOblastForEvent,
  clearOblastHighlight,
  render: afficherEvenements,
  UI_STRINGS,

  showBottomChart: () => BottomChart.show(updateBottomChart),
  hideBottomChart: () => BottomChart.hide(),
  updateBottomChart: () => updateBottomChart(true)
});


/// === DATA LOADERS ===

async function loadEventsForLang(lang) {
  if (dataByLang[lang]) return dataByLang[lang];

  const dataUrl = FILES.donnees[lang] || FILES.donnees[REGLAGES.projet.langueParDefaut];
  const resp = await fetch(withV(dataUrl));
  const data = await resp.json();

  data.forEach((ev, index) => {
    const langSuffix = String(lang || "fr").toUpperCase();
    const localizedZone = ev[`Province_${langSuffix}`] || ev[`province_${langSuffix}`] || getFirstConfiguredValue(ev, "zone");
    const province = localizedZone || "";
    const description =
      ev[`description_${langSuffix}`] ||
      ev[`Description_${langSuffix}`] ||
      getFirstConfiguredValue(ev, "description") ||
      "";

    ev.lieu = getFirstConfiguredValue(ev, "emplacement") || "";
    ev.journaliste = getFirstConfiguredValue(ev, "personne") || `Cas ${index + 1}`;
    ev.description = description;
    ev.lien = getFirstConfiguredValue(ev, "lien") || "";
    const rawCategory = getFirstConfiguredValue(ev, "categorie");
    ev.type_violence = TYPE_MAP_TO_CANONICAL[normalizeFilterValue(rawCategory)] || DEFAULT_EVENT_TYPE;
    ev.compteur_evenements = ev.compteur_evenements || ev.id || ev.ID || index + 1;

    const lat = getFirstConfiguredValue(ev, "latitude");
    const lng = getFirstConfiguredValue(ev, "longitude");
    if (lat !== undefined) ev.lat = Number(lat);
    if (lng !== undefined) ev.lng = Number(lng);

    if (province) ev.Oblast = province;

    const shapeName = getEventGeojsonName(ev);
    if (shapeName && !ev.Geojson) ev.Geojson = shapeName;
  });

  dataByLang[lang] = data;
  return data;
}


/// === LANGUE ===

function normalizeLang(lang) {
  const raw = String(lang || "").trim().toLowerCase();
  const shortLang = raw.split(/[-_]/)[0];
  return SUPPORTED_LANGS.has(shortLang) ? shortLang : REGLAGES.projet.langueParDefaut;
}

function getInitialLang() {
  const params = new URLSearchParams(window.location.search);
  return normalizeLang(params.get("lang"));
}

function getNextTutorialLanguage(lang = currentLang) {
  const languages = REGLAGES.projet.langues;
  return languages[(languages.indexOf(lang) + 1) % languages.length];
}

function syncLanguageControls(lang) {
  const activeLang = normalizeLang(lang);
  document.documentElement.lang = activeLang;

  document.querySelectorAll(".lang-btn").forEach(btn => {
    const active = normalizeLang(btn.dataset.lang) === activeLang;
    btn.classList.toggle("lang-active", active);
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function updateLangUrl(lang) {
  if (!window.history?.replaceState) return;

  const activeLang = normalizeLang(lang);
  const url = new URL(window.location.href);
  url.searchParams.set("lang", activeLang);
  window.history.replaceState({}, "", url);
}

async function setLanguage(lang, { updateUrl = true } = {}) {
  const nextLang = normalizeLang(lang);
  if (nextLang === currentLang) {
    syncLanguageControls(nextLang);
    if (updateUrl) updateLangUrl(nextLang);
    return;
  }

  Playback.stop(true);

  currentLang = nextLang;
  geojsonLevelsController?.setLanguage(currentLang);
  refreshBasemapControl();
  allEvents = await loadEventsForLang(nextLang);

  selectedTypes = new Set(allEvents.map(ev => ev.type_violence));

  oblastsDisponibles = OblastFilters.buildOblastListFromEvents(allEvents);
  OblastFilters.setOblastsList(oblastsDisponibles);
  populateTitleOblastSelect();
  OblastFilters.clearFiltersPreservePlayback({ resetZoom: false });

  Playback.buildPlaybackSequence();
  updatePlaybackDateUI();

  afficherEvenements();
  applyStaticTextsForLang(nextLang, { tutorialNextLang: getNextTutorialLanguage(nextLang) });
  syncLanguageControls(nextLang);
  if (updateUrl) updateLangUrl(nextLang);
  updateOblastPanel(selectedOblast);
  updateFloatingSubtitle();
  syncTitleFilterControls();
}

/// === LOADING OVERLAY ===

let loadingProgress = 0;
let loadingOverlayDone = false;

function setLoadingProgress(pct) {
  const bar = document.getElementById("loading-bar-fill");
  if (!bar) return;
  loadingProgress = Math.max(loadingProgress, Math.min(100, pct));
  bar.style.width = loadingProgress + "%";
}

function hideLoadingOverlay() {
  if (loadingOverlayDone) return;
  loadingOverlayDone = true;
  const overlay = document.getElementById("loading-overlay");
  if (!overlay) return;
  // Laisse la barre atteindre 100 % avant le fondu de l'unique loader.
  setTimeout(() => {
    overlay.classList.add("is-complete");
    setTimeout(() => overlay.remove(), 400);
  }, 400);
}

function showLoadingError(error) {
  console.error("Impossible de terminer le chargement de la carte", error);
  const strings = UI_STRINGS[currentLang].loader;
  const subtext = document.querySelector(".loading-subtext");
  if (subtext) subtext.textContent = strings.error;
  const retry = document.getElementById("loading-retry");
  if (retry) retry.hidden = false;
}

function refreshBasemapControl() {
  if (!map || basemapEntries.length < 2) return;
  if (basemapControl) map.removeControl(basemapControl);
  const layers = Object.fromEntries(basemapEntries.map(({ config, layer }) => [
    config.labels?.[currentLang] || config.labels?.fr || config.id, layer
  ]));
  basemapControl = L.control.layers(layers, null, { position: "bottomright" }).addTo(map);
}

function setTheme(mode) {
  document.body.classList.toggle("theme-dark", mode === "dark");
  document.body.classList.toggle("theme-light", mode === "light");
}

async function zoomToOblast(oblastName) {
  if (!map || !oblastName) return;

  const data = await loadOblastsGeojson();
  if (!data) return;

  const shapeName = getShapeNameForSelectedOblast(oblastName);
  if (!shapeName) return;

  const feature = (data.features || []).find(f => (
    f?.properties?.shapeName ||
    f?.properties?.name ||
    f?.properties?.region ||
    ""
  ) === shapeName);
  if (!feature) return;

  const bounds = L.geoJSON(feature).getBounds();
  if (!bounds?.isValid?.() || !bounds.isValid()) return;

  map.fitBounds(bounds, { padding: [30, 30], maxZoom: MAP_SETTINGS.zoomMaximumContour, animate: true });
}

/// === INIT MAP ===

async function initMap() {
  setLoadingProgress(10);
  currentLang = getInitialLang();
  applyStaticTextsForLang(currentLang, { tutorialNextLang: getNextTutorialLanguage(currentLang) });
  syncLanguageControls(currentLang);

  map = L.map("map", {
    crs: MAP_CRS,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    zoomSnap: MAP_SETTINGS.zoomSnap,
    zoomDelta: MAP_SETTINGS.zoomDelta,
    wheelPxPerZoomLevel: MAP_SETTINGS.wheelPxPerZoomLevel,
    scrollWheelZoom: MAP_SETTINGS.scrollWheelZoom,
    zoomControl: false
  }).setView(INITIAL_CENTER, INITIAL_ZOOM);
  geojsonRenderer = createGeojsonRenderer({
    L,
    getMaplibreMap: () => activeBasemap?.getMaplibreMap?.() || null,
    defaultStyle: REGLAGES.stylesGeojson.defaut
  });
  geojsonLevelsController = createGeojsonLevelsController({ map, L, createGeojsonLayer: geojsonRenderer.createLayer, levels: FILES.geojson.niveauxAdministratifs, defaultStyle: REGLAGES.stylesGeojson?.niveauxAdministratifs, loadGeoJSON: async file => {
    const response = await fetch(withV(file));
    if (!response.ok) throw new Error(`GeoJSON ${file}: HTTP ${response.status}`);
    return response.json();
  }, lang: currentLang });
  L.control.zoom({ position: "topleft" }).addTo(map);

  // Panes Leaflet (ordre d'empilement)
  map.createPane("pane-events");
  map.getPane("pane-events").style.zIndex = 600;  // au-dessus de tout si tu veux


  EventsRenderer.init({ leafletMap: map });

  OblastFilters.init({
    map,
    INITIAL_CENTER,
    INITIAL_ZOOM,
    getState: () => ({
      allEvents,
      oblastsDisponibles,
      villesDisponibles,
      currentLang,
      selectedOblast
    }),

    setSelectedOblast: (v) => { selectedOblast = v; statsSelectedOblast = v; },
    setSelectedVille: (v) => { selectedVille = v; statsSelectedVille = v; },
    setVillesDisponibles: (v) => { villesDisponibles = v; },
    setOblastsDisponibles: (v) => { oblastsDisponibles = v; },

    pausePlayback: Playback.pause,
    afficherEvenements,
    highlightOblastForEvent,
    clearOblastHighlight,
    resetLastHighlightedOblast: () => { lastHighlightedOblast = null; },
    updateOblastPanel,
    setRightPanelExpanded,
    zoomToOblast,
    getEventOblast
  });

  setLoadingProgress(20);

  window.initialMapCenter = INITIAL_CENTER;
  window.initialMapZoom = INITIAL_ZOOM;
  window.minMapZoom = MIN_ZOOM;
  window.maxMapZoom = MAX_ZOOM;

  window.resetMapView = function () {
    activeSupplementFilters.clear();
    regionsModeActive = featureEnabled("choropleth") && Boolean(FEATURES.choropleth?.actifParDefaut);
    playbackWindowStartTime = PLAYBACK_START_TIME;
    clearRegionsChoroplethLayer({ cancelPending: true });
    removeProvinceBoundariesLayer({ cancelPending: true });
    Playback.stop(true);
    BottomChart.resetZoom?.();
    OblastFilters.clearFiltersPreservePlayback({ resetZoom: true });
    lastHighlightedOblast = null;
    updateOblastPanel(null);
    afficherEvenements();
    BottomChart.hide();
    syncUtilityMenuState();
  };

  const fonds = Object.fromEntries(MAP_SETTINGS.fonds.map(fond => [fond.id, createBasemapLayer(fond, { L, settings: MAP_SETTINGS })]));
  basemapEntries = MAP_SETTINGS.fonds.map(config => ({ config, layer: fonds[config.id] }));

  if (window.matchMedia("(prefers-color-scheme: light)").matches) setTheme("light");

  MAP_SETTINGS.fonds.forEach(fond => {
    const layer = fonds[fond.id];
    layer.on("add", () => {
      activeBasemap = layer;
      geojsonRenderer.refresh();
      setTheme(fond.theme || "light");
    });
    layer.on("remove", () => {
      if (activeBasemap === layer) {
        activeBasemap = null;
        geojsonRenderer.refresh();
      }
    });
  });
  const defaultBasemap = MAP_SETTINGS.fonds.find(fond => fond.actifParDefaut) || MAP_SETTINGS.fonds[0];
  const defaultLayer = fonds[defaultBasemap?.id];
  defaultLayer?.addTo(map);
  refreshBasemapControl();

  setLoadingProgress(50);

  // Données et géométries se chargent pendant que MapLibre prépare le fond.
  // Une seule attente du rendu final, après ajout de toutes les couches.
  [allEvents] = await Promise.all([
    loadEventsForLang(currentLang),
    regionsModeActive || featureEnabled("contour") ? loadOblastsGeojson() : Promise.resolve()
  ]);

  setLoadingProgress(65);

  selectedTypes = new Set(allEvents.map(ev => ev.type_violence));
  oblastsDisponibles = OblastFilters.buildOblastListFromEvents(allEvents);
  OblastFilters.setOblastsList(oblastsDisponibles);
  populateTitleOblastSelect();
  syncSupplementFilterButtons();

  updateOblastPanel(null);

  Playback.buildPlaybackSequence();
  const maxPlaybackCandidates = [
    ...allEvents.map(ev => getEventTime(ev)).filter(Number.isFinite)
  ];
  const maxPlaybackT = maxPlaybackCandidates.length ? Math.max(...maxPlaybackCandidates) : null;

  BottomChart.computeGlobalDays(
    allEvents,
    PLAYBACK_START_TIME,
    getEventTime,
    startOfDayUTC,
    maxPlaybackT
  );

  afficherEvenements({ renderGeography: false });

  if (regionsModeActive) await renderRegionsChoroplethLayer();
  else await renderProvinceBoundariesLayer();
  setLoadingProgress(90);
  await waitForBasemapReady(defaultLayer, { timeoutMs: MAP_SETTINGS.delaiChargementMaximum });
  setLoadingProgress(100);
  hideLoadingOverlay();

  if (featureEnabled("tutoriel") && FEATURES.tutoriel?.demarrageAutomatique && !Tutorial.hasSeen()) {
    setTimeout(() => Tutorial.start(), 900);
  }
}


/// === LANCEMENT GLOBAL ===

function onDomReady(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn, { once: true });
  } else {
    fn();
  }
}

let appBooted = false;
onDomReady(() => {
  if (appBooted) return;
  appBooted = true;
  initHarmonizedShell();

  // Tutorial UI
  const tutNext = document.getElementById("tutorial-next-btn");
  const tutSkip = document.getElementById("tutorial-skip-btn");
  const tutReplay = document.getElementById("tutorial-replay-btn");
  const tutLangBtn = document.getElementById("tutorial-lang-btn");

  if (tutNext) tutNext.addEventListener("click", () => Tutorial.next());
  if (tutSkip) tutSkip.addEventListener("click", () => Tutorial.skip());
  if (tutReplay) tutReplay.addEventListener("click", () => Tutorial.start());

  if (tutLangBtn) {
    tutLangBtn.addEventListener("click", async () => {
      const newLang = getNextTutorialLanguage();
      await setLanguage(newLang);
      if (Tutorial.isActive() && Tutorial.getStep() > 0) Tutorial.goToStep(Tutorial.getStep());
    });
  }

  // Lang buttons
  document.querySelectorAll(".lang-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      await setLanguage(btn.dataset.lang);
    });
  });

  // Playback controls
  const pbToggle = document.getElementById("playback-toggle");
  const pbPrev = document.getElementById("playback-prev");
  const pbNext = document.getElementById("playback-next");
  const pbSpeed = document.getElementById("playback-speed");
  const pbEnd = document.getElementById("playback-end");

  if (pbToggle) pbToggle.addEventListener("click", () => {
    Playback.toggle();
    if (!BottomChart.isOpen()) {
      BottomChart.show(updateBottomChart);
    }
    syncUtilityMenuState();
  });

  if (pbPrev) pbPrev.addEventListener("click", () => { Playback.pause(); Playback.stepPrev(); });
  if (pbNext) pbNext.addEventListener("click", () => { Playback.pause(); Playback.stepNext(); });
  if (pbEnd) pbEnd.addEventListener("click", () => Playback.goToEnd());

  if (pbSpeed) {
    pbSpeed.addEventListener("change", () => {
      const nextSpeed = parseFloat(pbSpeed.value) || 1;
      setPlaybackState({ playbackSpeed: nextSpeed });

      if (getPlaybackState().playbackActive) {
        Playback.stop(false);
        Playback.start();
      }
    });
  }

  // Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      Playback.pause();
      OblastFilters.clearFiltersPreservePlayback({ resetZoom: true });
      activeSupplementFilters.clear();
      updateFloatingSubtitle();
      BottomChart.hide();
      syncUtilityMenuState();
    }
  });

  // Floating controls (Leaflet)
  const floating = document.getElementById("floating-controls");
  if (floating && window.L && L.DomEvent) {
    L.DomEvent.disableClickPropagation(floating);
    L.DomEvent.disableScrollPropagation(floating);
  }

  setupCollapse({
    btnId: "collapse-notes",
    bodyId: "notes-body",
    storageKey: "collapse.notes.template",
    defaultCollapsed: false
  });

  document.getElementById("loading-retry")?.addEventListener("click", () => window.location.reload());
  initMap().catch(showLoadingError);
});
