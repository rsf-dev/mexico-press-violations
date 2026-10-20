// JS/ui/oblastFilters.js

export const OblastFilters = (() => {
  let deps = null;

  function clearFiltersPreservePlayback({ resetZoom = false } = {}) {
    const {
      setSelectedOblast,
      setSelectedVille,
      setVillesDisponibles,
      map,
      INITIAL_CENTER,
      INITIAL_ZOOM
    } = deps;

    setSelectedOblast(null);
    setSelectedVille(null);
    setVillesDisponibles([]);

    deps.clearOblastHighlight?.();
    deps.resetLastHighlightedOblast?.();
    deps.updateOblastPanel?.(null);

    if (resetZoom && map) {
      map.flyTo(INITIAL_CENTER, INITIAL_ZOOM, { animate: true, duration: 0.8 });
    }

    deps.afficherEvenements?.();
  }

  function buildOblastListFromEvents(allEvents) {
    const s = new Set();
    (allEvents || []).forEach(ev => {
      const o = deps.getEventOblast(ev);
      if (o) s.add(o);
    });

    return Array.from(s).sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
  }

  function init(initDeps) {
    deps = initDeps;
  }

  function setOblastsList(oblasts) {
    deps.setOblastsDisponibles?.(oblasts || []);
  }

  return {
    init,
    setOblastsList,
    buildOblastListFromEvents,
    clearFiltersPreservePlayback
  };
})();
