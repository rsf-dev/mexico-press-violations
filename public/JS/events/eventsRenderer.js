// JS/events/eventsRenderer.js

import { escapeAttribute, escapeHtml } from "../utils/security.js";

export const EventsRenderer = (() => {
  let map = null;
  let clusterGroup = null;
  let eventMarkers = new Map();
  const CLUSTER_RADIUS_PX = 80;

  function createClusterGroup(L) {
    return L.markerClusterGroup({
      spiderfyDistanceMultiplier: 1,
      spiderfyOnEveryZoom: false,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: true,
      spiderfyOnClick: true,
      maxClusterRadius: CLUSTER_RADIUS_PX,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        const base = Math.min(20 + count, 60);
        const size = Math.round(base * 1.35);
        return L.divIcon({
          html: `<div class="custom-cluster" style="width:${size}px;height:${size}px;">${count}</div>`,
          className: "cluster-icon",
          iconSize: [size, size]
        });
      }
    });
  }
  function getClusterGroup() {
    return clusterGroup;
  }

  function init({ leafletMap }) {
    map = leafletMap;
  }

  function getMarkerByEventId(id) {
    return eventMarkers.get(id) || null;
  }

  function clear() {
    if (clusterGroup && map) map.removeLayer(clusterGroup);
    clusterGroup = null;
    eventMarkers.clear();
  }

  function render({
    // state
    allEvents,
    selectedTypes,
    selectedOblast,
    selectedVille,
    playbackWindowStartTime,
    playbackCutoffTime,
    currentLang,


    // helpers
    getEventTime,
    getEventOblast,
    getEventGenderInitial,
    getEventLinks,
    startOfDayUTC,
    formatDateFR,
    buildEventId,
    normalizeType,
    getEventHighlightState,
    getEventSupplementBadges,
    getCrimeElucideBadge,
    eventPassesPanelFilters,
    getDisplayLabelForType,
    createMarkerIcon,
    getLegendIconUrl,

    // callbacks UI
    pausePlayback,
    focusEvent,
    setRightPanelExpanded,
    updateHeaderLegendCounts,
    updateBottomChart,
    attachToMap = true,
    caseFields = []
  }) {
    if (!map) throw new Error("EventsRenderer.init({ leafletMap }) must be called before render().");

    // reset layers + markers
    clear();
    clusterGroup = attachToMap ? createClusterGroup(window.L) : null;

    const list = document.getElementById("event-list");
    if (list) list.replaceChildren();

    // filtre visible
    const visible = allEvents.filter(ev => {
      const typeOK = selectedTypes.size === 0 || selectedTypes.has(ev.type_violence);
      const oblastOK = !selectedOblast || getEventOblast(ev) === selectedOblast;
      const villeOK = !selectedVille || ev.lieu === selectedVille;
      const t = getEventTime(ev);
      const playbackStartOK = !Number.isFinite(playbackWindowStartTime) || (Number.isFinite(t) && t >= playbackWindowStartTime);
      const playbackEndOK = (playbackCutoffTime === null) ? true : (Number.isFinite(t) && t <= playbackCutoffTime);
      const playbackOK = playbackStartOK && playbackEndOK;
      const panelOK = !eventPassesPanelFilters || eventPassesPanelFilters(ev);
      return typeOK && oblastOK && villeOK && playbackOK && panelOK;
    });


    // tri antéchronologique
    visible.sort((a, b) => {
      const tb = getEventTime(b);
      const ta = getEventTime(a);
      if (tb !== ta) return tb - ta;
      return buildEventId(a).localeCompare(buildEventId(b));
    });

    const panelVisible = visible;

    // counts header
    if (typeof updateHeaderLegendCounts === "function") {
      updateHeaderLegendCounts(panelVisible);
    }

    let lastDayKey = null;

    visible.forEach(ev => {
      const ts = getEventTime(ev);
      const dayKey = ts ? startOfDayUTC(ts) : null;
      const includeInList = !eventPassesPanelFilters || eventPassesPanelFilters(ev);

      // séparateur jour
      if (list && includeInList && dayKey !== lastDayKey) {
        const sep = document.createElement("div");
        sep.className = "event-day-separator";
        sep.textContent = dayKey
          ? formatDateFR(dayKey)
          : (currentLang === "en" ? "Undated" : "Sans date");
        list.appendChild(sep);
        lastDayKey = dayKey;
      }

      const coordsValid = Number.isFinite(ev.lat) && Number.isFinite(ev.lng);
      let marker = null;

      if (coordsValid && attachToMap && clusterGroup) {
        const icon = createMarkerIcon(ev.type_violence);
        marker = window.L.marker([ev.lat, ev.lng], { icon });

        marker.on("add", () => {
          const el = marker._icon?.querySelector(".marker-icon");
          if (el) {
            const highlightState = (typeof getEventHighlightState === "function") ? getEventHighlightState(ev) : "neutral";
            el.classList.toggle("marker-highlighted", highlightState === "highlighted");
            el.classList.toggle("marker-dimmed", highlightState === "dimmed");
            el.classList.add("radar-once");
            setTimeout(() => el.classList.remove("radar-once"), 4000);
          }
        });

        marker.on("click", () => {
          pausePlayback();

          focusEvent(ev, marker);

          setRightPanelExpanded(false);
        });


        clusterGroup.addLayer(marker);
      }

      const id = buildEventId(ev);
      eventMarkers.set(id, marker);

      // item liste
      if (list && includeInList) {
        const iconSrc = getLegendIconUrl(ev.type_violence);
        const labelType = getDisplayLabelForType(ev.type_violence);

        const item = document.createElement("div");
        item.className = `event-item event-${normalizeType(ev.type_violence)}`;
        item.id = id;
        const highlightState = (typeof getEventHighlightState === "function") ? getEventHighlightState(ev) : "neutral";
        if (highlightState === "highlighted") item.classList.add("event-highlighted");
        if (highlightState === "dimmed") item.classList.add("event-dimmed");

        const ob = getEventOblast(ev);
        const dateTxt = ts ? formatDateFR(ts) : "—";
        const genderInitial = (typeof getEventGenderInitial === "function") ? getEventGenderInitial(ev) : "";
        const genderHtml = genderInitial
          ? `<span class="event-gender-badge event-gender-${escapeAttribute(genderInitial.toLowerCase())}">${escapeHtml(genderInitial)}</span>`
          : "";
        const stateLabel = currentLang === "en" ? "State" : (currentLang === "es" ? "Estado" : "Etat");
        const cityLabel = currentLang === "en" ? "City" : (currentLang === "es" ? "Ciudad" : "Ville");
        const stateHtml = ob
          ? `<div class="event-meta-row"><span class="event-meta-label">${escapeHtml(stateLabel)}</span><span class="event-meta-separator">:</span><span class="event-meta-value">${escapeHtml(ob)}</span></div>`
          : "";
        const cityHtml = ev.lieu
          ? `<div class="event-meta-row"><span class="event-meta-label">${escapeHtml(cityLabel)}</span><span class="event-meta-separator">:</span><span class="event-meta-value">${escapeHtml(ev.lieu)}</span></div>`
          : "";
        const solvedBadge = (typeof getCrimeElucideBadge === "function") ? getCrimeElucideBadge(ev) : null;
        const badges = (typeof getEventSupplementBadges === "function") ? getEventSupplementBadges(ev) : [];
        const badgeItems = [
          ...badges.map(label => `<span>${escapeHtml(label)}</span>`),
          solvedBadge
            ? `<span class="event-solved-badge event-solved-${escapeAttribute(solvedBadge.status)}">${escapeHtml(solvedBadge.label)}</span>`
            : ""
        ].filter(Boolean);
        const badgesHtml = badgeItems.length
          ? `<div class="event-badges">${badgeItems.join("")}</div>`
          : "";

        const urls = getEventLinks(ev);
        const readMoreLabel = currentLang === "fr"
          ? "↪ Lire plus"
          : (currentLang === "es" ? "↪ Leer más" : "↪ Read more");

        const readMoreHtml = urls.length
          ? `<div class="event-readmore-wrap">
              ${urls.map((url, index) => `<a class="event-readmore-btn" href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">
                ${escapeHtml(readMoreLabel)}${urls.length > 1 ? ` (${index + 1})` : ""}
              </a>`).join("")}
            </div>`
          : "";
        const extraFieldsHtml = caseFields.filter(field => field?.enabled !== false).map(field => {
          const names = [field.field, ...(field.aliases || [])].filter(Boolean);
          const keys = Object.keys(ev);
          const key = names.find(name => Object.prototype.hasOwnProperty.call(ev, name)) ||
            keys.find(candidate => names.some(name => candidate.toLowerCase() === name.toLowerCase()));
          const value = key ? ev[key] : "";
          if (value == null || value === "" || typeof value === "object") return "";
          const label = field.labels?.[currentLang] || field.labels?.fr || field.field;
          return `<div class="event-meta-row"><span class="event-meta-label">${escapeHtml(label)}</span><span class="event-meta-separator">:</span><span class="event-meta-value">${escapeHtml(value)}</span></div>`;
        }).filter(Boolean).join("");


        item.innerHTML = `
          <div class="event-card">
            <img class="event-icon" src="${escapeAttribute(iconSrc)}" alt="${escapeAttribute(labelType)}">
            <div class="event-content">
              <h4><span class="event-person-name">${escapeHtml(ev.journaliste)}</span> ${genderHtml}</h4>
              <div class="date">${escapeHtml(dateTxt)}</div>
              ${stateHtml}
              ${cityHtml}
              <p>${escapeHtml(ev.description)}</p>
              ${extraFieldsHtml}
              ${badgesHtml}
              ${readMoreHtml}
            </div>
          </div>`;

        item.querySelectorAll(".event-readmore-btn").forEach(linkEl => {
          linkEl.addEventListener("click", (e) => {
            e.stopPropagation();
          });
        });

        item.addEventListener("click", () => {
          pausePlayback();

          focusEvent(ev, marker);

          setRightPanelExpanded(false);
        });


        list.appendChild(item);
      }
    });

    if (attachToMap && clusterGroup) map.addLayer(clusterGroup);

    // compteurs footer/infos
    const totalCountEl = document.getElementById("total-count");
    if (totalCountEl) totalCountEl.textContent = allEvents.length;

    const currentCountEl = document.getElementById("current-count");
    if (currentCountEl) currentCountEl.textContent = panelVisible.length;

    // chart bottom
    if (typeof updateBottomChart === "function") updateBottomChart(false);

    return { visibleCount: panelVisible.length, totalCount: allEvents.length };
  }

  return {
    init,
    render,
    clear,
    getMarkerByEventId,
    getClusterGroup,
    getClusterRadiusPx: () => CLUSTER_RADIUS_PX
  };
})();
