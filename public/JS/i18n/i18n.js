// JS/i18n/i18n.js
// Ajuste ici les titres, labels, tutoriels et traductions visibles.

export const UI_STRINGS = {
  fr: {
    loader: {
      subtitle: "Monitoring des assassinats contre les journalistes au Mexique",
      subtext: "Chargement de la carte...",
      error: "Impossible de charger la carte. Réessayez.",
      retry: "Réessayer"
    },
    tutorial: {
      step1: {
        title: "Bienvenue",
        subtitle: "Information importante",
        body: "Cette carte recense les assassinats de journalistes commis au Mexique depuis 2006. Si vous êtes sur téléphone mobile, mettez cette carte en format horizontal. Vous pouvez changer la langue (anglais, français), et voir comment la parcourir en cliquant sur 'Montrez-moi'.",
        body2: "Cette carte et les données qui lui sont attachées sont issues d'un monitoring de RSF selon son mandat et sont mises à jour en temps réel. RSF collecte ces informations grâce à une veille et au partage d'informations de ses partenaires en Ukraine",
        nextLabel: "Montrez-moi"
      },
      step2: {
        title: "Filtres de la carte",
        subtitle: "Regions, villes, annees et informations",
        body: "Le composant titre regroupe les filtres principaux : region, ville, annee et informations complementaires.",
        body2: "Le bouton Supprimer les filtres retablit la vue complete et remet les categories dans leur etat initial.",
        nextLabel: "Suivant"
      },
      step3: {
        title: "Menu de navigation",
        subtitle: "Panneaux",
        body: "Le menu burger rassemble la langue, le tutoriel, la liste des cas, les statistiques, le mode Choropleth et la chronologie.",
        body2: "",
        nextLabel: "Suivant"
      },
      step4: {
        title: "Liste des cas",
        subtitle: "Depuis la liste",
        body: "La liste des cas permet de parcourir les evenements documentes.",
        body2: "Cliquez sur un cas pour centrer la carte sur son emplacement. Le bouton Fermer replie le panneau.",
        nextLabel: "Suivant"
      },
      step5: {
        title: "Lecture et chronologie",
        subtitle: "Zoom de la chronologie",
        body: "Le module lecture rejoue les cas dans l'ordre chronologique.",
        body2: "La chronologie affiche les cas par annee. Cliquez sur une annee pour afficher le bouton + et zoomer sur ses jours ; la reinitialisation des filtres revient a la vue annuelle.",
        nextLabel: "Suivant"
      },
      step6: {
        title: "Statistiques",
        subtitle: "Regions et villes",
        body: "Le panneau statistiques affiche les compteurs et les graphiques pour les regions et les villes disponibles.",
        body2: "Les éléments des graphiques permettent de filtrer par region ou ville.",
        nextLabel: "Suivant"
      },
      step7: {
        title: "Mode Choropleth",
        body: "Le mode Choropleth permet de visualiser les données de manière par région.",
        subtitle: "Données par région",
        body2: "Cliquez sur une région pour afficher les données correspondantes. Les filtres et la date mettent à jour l'affichage de la carte.",
        nextLabel: "Terminer"
      },
      skipLabel: "Passer"
    },
    ui: {
      selectOblast: "Cliquez sur une region ou une ville ci-dessous",
      eventPanelTitle: "Liste des cas",
      closeButton: "Fermer",
      clearFilters: "Supprimer les filtres",
      filtersLabel: "Filtres",
      notesSection: "Notes",
      creditsTitle: "Credits",
      eventFooterNote: "<b>Note :</b> données collectées et vérifiées par RSF et issues de son baromètre. <br><b> Mandat de RSF </b>: Les journalistes auxquels il est fait référence ont été tués dans l'exercice de leur profession, ou en raison de celle-ci.",
      floatingTitle: "Monitoring des assassinats contre les journalistes au Mexique",
      floatingSubtitle: "Entre 2006 et 2026, 167 journalistes ont été tués au Mexique.",
      floatingSubtitleBase: ({ startDate, endDate, total }) =>
        `Entre ${startDate} et ${endDate}, ${total} journalistes ont été tués au Mexique.`,
      supplementSummaries: {
        homme: ({ count, percent }) =>
          `${count}, soit ${percent}% étaient des hommes.`,
        femme: ({ count, percent }) =>
          `${count}, soit ${percent}% étaient des femmes.`,
        journaliste_local: ({ count, percent }) =>
          `${count}, soit ${percent}% étaient des journalistes locaux.`,
        sous_protection: ({ count, percent }) =>
          `${count}, soit ${percent}% étaient sous régime de protection.`,
        torture: ({ count, percent }) =>
          `${count}, soit ${percent}% ont été torturés avant d'être tués.`,
        enquete_crime: ({ count, percent }) =>
          `${count}, soit ${percent}% enquêtaient sur la criminalité.`,
        enquete_politique: ({ count, percent }) =>
          `${count}, soit ${percent}% enquêtaient sur la politique.`,
        crime_organise: ({ count, percent }) =>
          `${count}, soit ${percent}% ont été tués par le crime organisé.`,
        crime_elucide: ({ count, percent }) =>
          `${count}, soit ${percent}% des crimes ont été élucidés.`
      },
      panelWhenOblast: "Les statistiques apparaitront ici des qu'une region sera selectionnee.",
      chartNoEvents: "Cette region n'a pas d'evenements sur les categories disponibles.",
      chartNoEventsCategory: "Aucun evenement pour cette categorie.",
      chartSearchOblast: "Selectionnez un evenement ou une ville pour afficher les statistiques d'une region.",
      oblastTotalLabel: "Total d'evenements :",
      oblastCitiesLabel: "Villes concernees :",
      tutoButton: "Tutoriel",
      tutorialLangButton: "Switch to English",
      menuLanguage: "Langue",
      menuEvents: "Liste des cas",
      menuRegions: "Carte Choropleth",
      menuStats: "Statistiques",
      menuTimeline: "Chronologie",
      menuOpen: "Ouvrir le menu",
      rsfCartography: "RSF cartographie",
      bottomChartTitle: "Evolution des assassinats",
      oblastsBtn: "États",
      villesBtn: "Villes",
      footerCredits: `
        <b>Graphiques et carte :</b> <i>Vianney Loriquet / RSF.</i><br>
        <b>Source donnees :</b> <i>Reporters sans frontières (RSF)</i><br>
        <b>Icones et illustrations :</b> <button class="credits-link" data-open-credits="flaticon">Flaticon (voir details)</button>
      `,
      flaticonCredits: `<ul class="credits-list">
        <li>Completez ici les credits d'icones utilises par la carte.</li>
      </ul>`
    },
    cartography: {
      title: "RSF cartographie",
      close: "Fermer",
      cards: [
        "Violences contre les journalistes dans le monde (edition 2025)",
        "Surveillance des violences contre les journalistes en Ukraine",
        "Surveillance des violences contre les journalistes dans la region des Grands Lacs africains",
        "Les journalistes sur les routes de l'exil (edition 2021 a 2025)"
      ]
    },
    playbackMessages: {
      example_title: "Repere chronologique",
      example_body: "Ajoutez vos reperes dans PLAYBACK_CUES puis traduisez-les ici."
    }
  },

  en: {
    loader: {
      subtitle: "Monitoring murders of journalists in Mexico",
      subtext: "Loading map...",
      error: "Unable to load the map. Try again.",
      retry: "Try again"
    },
    tutorial: {
      step1: {
        title: "Welcome",
        subtitle: "Important information",
        body: "This map lists the assassinations of journalists committed in Mexico since 2006. If you are on a mobile phone, please put this map in landscape format. You can change the language (English, French), and see how to navigate it by clicking on 'Show me'.",
        body2: "This map and the data associated with it come from an RSF monitoring exercise in accordance with its mandate and are updated in real time. RSF collects this information through monitoring and sharing information with its partners in Mexico",
        nextLabel: "Show me"
      },
      step2: {
        title: "Map filters",
        subtitle: "Regions, cities, dates and information",
        body: "The title component groups the main filters: region, city, dates and additional information.",
        body2: "The Clear filters button restores the full map view and resets categories to their initial state.",
        nextLabel: "Next"
      },
      step3: {
        title: "Navigation menu",
        subtitle: "Panels",
        body: "The burger menu gathers language, tutorial, case list, statistics, Choropleth mode and timeline controls.",
        body2: "",
        nextLabel: "Next"
      },
      step4: {
        title: "Case list",
        subtitle: "From the list",
        body: "The case list lets you browse documented events.",
        body2: "Click a case to center the map on its location. The Close button closes the panel.",
        nextLabel: "Next"
      },
      step5: {
        title: "Playback and timeline",
        subtitle: "Timeline zoom",
        body: "The playback module replays cases chronologically.",
        body2: "The timeline displays cases by year. Click a year to reveal the + button and zoom into its days; clearing filters restores the yearly view.",
        nextLabel: "Next"
      },
      step6: {
        title: "Statistics",
        subtitle: "Regions and cities",
        body: "The statistics panel displays counters and charts for the available regions and cities.",
        body2: "Chart elements can filter by region or city.",
        nextLabel: "Next"
      },
      step7: {
        title: "Choropleth map",
        body: "The Choropleth mode allows you to visualize the data by region. Click on the button again to deactivate it.",
        subtitle: "Data by region",
        body2: "Click on a region to display the corresponding data. The filters and the date update the map display.",
        nextLabel: "Finish"
      },
      skipLabel: "Skip"
    },
    ui: {
      selectOblast: "Click on a region or city below",
      eventPanelTitle: "Case list",
      closeButton: "Close",
      clearFilters: "Clear filters",
      filtersLabel: "Filters",
      notesSection: "Notes",
      creditsTitle: "Credits",
      eventFooterNote: "<b>Note:</b> Data collected and verified by RSF and from its barometer. <br><b> RSF mandate </b>: Journalists referred to were killed in the exercise of their profession, or because of it.",
      floatingTitle: "Monitoring killings of journalists in Mexico",
      floatingSubtitle: "Between 2006 and 2026, 167 journalists were killed in Mexico.",
      floatingSubtitleBase: ({ startDate, endDate, total }) =>
        `Between ${startDate} and ${endDate}, ${total} journalists were killed in Mexico.`,
      supplementSummaries: {
        homme: ({ count, percent }) =>
          `${count}, or ${percent}%, were men.`,
        femme: ({ count, percent }) =>
          `${count}, or ${percent}%, were women.`,
        journaliste_local: ({ count, percent }) =>
          `${count}, or ${percent}%, were local journalists.`,
        sous_protection: ({ count, percent }) =>
          `${count}, or ${percent}%, were under a protection scheme.`,
        torture: ({ count, percent }) =>
          `${count}, or ${percent}%, were tortured before being killed.`,
        enquete_crime: ({ count, percent }) =>
          `${count}, or ${percent}%, were investigating crime.`,
        enquete_politique: ({ count, percent }) =>
          `${count}, or ${percent}%, were investigating politics.`,
        crime_organise: ({ count, percent }) =>
          `${count}, or ${percent}%, were killed by organized crime.`,
        crime_elucide: ({ count, percent }) =>
          `${count}, or ${percent}%, of the crimes were solved.`
      },
      panelWhenOblast: "Statistics will appear here as soon as a region is selected.",
      chartNoEvents: "This region has no events in the available categories.",
      chartNoEventsCategory: "No events for this category.",
      chartSearchOblast: "Select an event or city to display region statistics.",
      oblastTotalLabel: "Total number of events:",
      oblastCitiesLabel: "Cities involved:",
      tutoButton: "Tutorial",
      tutorialLangButton: "Voir en Francais",
      menuLanguage: "Language",
      menuEvents: "Case list",
      menuRegions: "Choropleth map",
      menuStats: "Statistics",
      menuTimeline: "Timeline",
      menuOpen: "Open menu",
      rsfCartography: "RSF cartography",
      bottomChartTitle: "Killings over time",
      oblastsBtn: "States",
      villesBtn: "Cities",
      footerCredits: `
        <b>Charts and map:</b> <i>Vianney Loriquet / RSF.</i><br>
        <b>Data source:</b> <i>Reporters without Borders (RSF)</i><br>
        <b>Icons and illustrations:</b> <button class="credits-link" data-open-credits="flaticon">Flaticon (details)</button>
      `,
      flaticonCredits: `<ul class="credits-list">
        <li>Complete the credits for icons used by the map.</li>
      </ul>`
    },
    cartography: {
      title: "RSF cartography",
      close: "Close",
      cards: [
        "Violence against journalists worldwide (2025 edition)",
        "Monitoring violence against journalists in Ukraine",
        "Monitoring violence against journalists in Africa's Great Lakes region",
        "Journalists on the routes of exile (2021 to 2025 edition)"
      ]
    },
    playbackMessages: {
      example_title: "Timeline cue",
      example_body: "Add your cues in PLAYBACK_CUES, then translate them here."
    }
  }
};

UI_STRINGS.es = {
  ...UI_STRINGS.fr,
  loader: {
    subtitle: "Seguimiento de los asesinatos de periodistas en México",
    subtext: "Cargando el mapa...",
    error: "No se pudo cargar el mapa. Inténtalo de nuevo.",
    retry: "Reintentar"
  },
  tutorial: {
    ...UI_STRINGS.fr.tutorial,
    step1: {
      title: "Bienvenido",
      body: "Este mapa recopila los asesinatos de periodistas cometidos en México desde 2006. Si estás en un teléfono móvil, pon este mapa en formato horizontal. Puedes cambiar el idioma (inglés, francés) y ver cómo recorrerlo haciendo clic en \"Mostrarme\".",
      subtitle: "Informacion importante",
      body2: "Este mapa y los datos que contiene provienen del monitoreo de RSF de acuerdo con su mandato y se actualizan en tiempo real. RSF recopila esta información gracias a la vigilancia y al intercambio de información de sus socios en México",
      nextLabel: "Mostrarme"
    },
    step2: {
      title: "Filtros de la carte",
      body: "El componente del título agrupa los filtros principales : region, ciudad, fechas e informacion complementaria.",
      subtitle: "Estados, ciudades, fechas e informacion",
      body2: "El botón \"Eliminar filtros\" restaura la vista completa y restablece las categorías a su estado inicial.",
      nextLabel: "Siguiente"
    },
    step3: {
      title: "Menú de navegación",
      body: "El menú desplegable reúne el idioma, el tutorial, la lista de casos, las estadísticas, el modo mapa de densidad y la cronología.",
      subtitle: "Paneles",
      body2: "Haga clic de nuevo en el botón del menú para cerrarlo",
      nextLabel: "Siguiente"
    },
    step4: {
      title: "Lista de casos",
      body: "La lista de casos permite recorrer los eventos documentados.",
      subtitle: "Desde la lista",
      body2: "Haga clic en un caso para centrar el mapa en su ubicación. El botón \"Cerrar\" en la parte superior del panel cierra la lista.",
      nextLabel: "Siguiente"
    },
    step5: {
      title: "Reproducción y cronología",
      body: "El módulo de reproducción, situado en el componente del título, reproduce los casos en orden cronológico.",
      subtitle: "Zoom de la cronología",
      body2: "La cronología muestra los casos por año. Haga clic en un año para mostrar el botón + y ampliar sus días; borrar los filtros restaura la vista anual.",
      nextLabel: "Siguiente"
    },
    step6: {
      title: "Estadísticas",
      body: "El panel de estadísticas muestra los contadores y gráficos de los estados y ciudades disponibles.",
      subtitle: "Estados y ciudades",
      body2: "Los elementos de los gráficos permiten filtrar por region o ciudad.",
      nextLabel: "Siguiente"
    },
    step7: {
      title: "Modo mapa de densidad",
      body: "El modo mapa de densidad permite visualizar los datos de manera por estado. Vuelva a hacer clic en el botón para desactivarlo.",
      subtitle: "Datos por estado",
      body2: "Haga clic en un estado para mostrar los datos correspondientes. Los filtros y la fecha actualizan la visualización del mapa.",
      nextLabel: "Terminar"
    },
    skipLabel: "Omitir"
  },
  ui: {
    ...UI_STRINGS.fr.ui,
    selectOblast: "Haga clic en un estado o una ciudad",
    eventPanelTitle: "Lista de casos",
    closeButton: "Cerrar",
    clearFilters: "Borrar filtros",
    filtersLabel: "Filtros",
    notesSection: "Notas",
    creditsTitle: "Créditos",
    eventFooterNote: "<b>Nota:</b> Datos recopilados y verificados por RSF y de su barómetro. <br><b> Mandato de RSF </b>: Los periodistas referidos fueron asesinados en el ejercicio de su profesión, o a causa de ella.",
    floatingTitle: "Monitoreo de los asesinatos de periodistas en México",
    floatingSubtitle: "Entre 2006 y 2026, 167 periodistas fueron asesinados en México.",
    floatingSubtitleBase: ({ startDate, endDate, total }) =>
      `Entre ${startDate} y ${endDate}, ${total} periodistas fueron asesinados en México.`,
    supplementSummaries: {
      homme: ({ count, percent }) =>
        `${count}, es decir ${percent}%, eran hombres.`,
      femme: ({ count, percent }) =>
        `${count}, es decir ${percent}%, eran mujeres.`,
      journaliste_local: ({ count, percent }) =>
        `${count}, es decir ${percent}%, eran periodistas locales.`,
      sous_protection: ({ count, percent }) =>
        `${count}, es decir ${percent}%, estaban bajo un régimen de protección.`,
      torture: ({ count, percent }) =>
        `${count}, es decir ${percent}%, fueron torturados antes de ser asesinados.`,
      enquete_crime: ({ count, percent }) =>
        `${count}, es decir ${percent}%, investigaban la criminalidad.`,
      enquete_politique: ({ count, percent }) =>
        `${count}, es decir ${percent}%, investigaban la política.`,
      crime_organise: ({ count, percent }) =>
        `${count}, es decir ${percent}%, fueron asesinados por el crimen organizado.`,
      crime_elucide: ({ count, percent }) =>
        `${count}, es decir ${percent}%, de los crímenes fueron esclarecidos.`
    },
    chartNoEvents: "Este estado no tiene casos para los filtros activos.",
    chartNoEventsCategory: "Ningun caso para esta categoria.",
    chartSearchOblast: "Seleccione un estado o una ciudad para ver las estadisticas.",
    oblastTotalLabel: "Total de casos:",
    oblastCitiesLabel: "Ciudades afectadas:",
    tutoButton: "Tutorial",
    tutorialLangButton: "Voir en Francais",
    menuLanguage: "Idioma",
    menuEvents: "Lista de casos",
    menuRegions: "Mapa de densidad",
    menuStats: "Estadisticas",
    menuTimeline: "Cronologia",
    menuOpen: "Abrir menu",
    bottomChartTitle: "Asesinatos en el tiempo",
    oblastsBtn: "Estados",
    villesBtn: "Ciudades",
    footerCredits: `
        <b>Graficos y mapa:</b> <i>Vianney Loriquet / RSF.</i><br>
        <b>Fuente de datos:</b> <i>Reporteros Sin Fronteras (RSF)</i><br>
        <b>Iconos e ilustraciones:</b> <button class="credits-link" data-open-credits="flaticon">Flaticon (detalles)</button>
      `,
    flaticonCredits: `<ul class="credits-list">
        <li>Completar aqui los creditos de los iconos utilizados por el mapa.</li>
      </ul>`
  },
  cartography: {
    title: "Cartografia RSF",
    close: "Cerrar",
    cards: [
      "Violencia contra periodistas en el mundo (edicion 2025)",
      "Monitoreo de la violencia contra periodistas en Ucrania",
      "Monitoreo de la violencia contra periodistas en la region africana de los Grandes Lagos",
      "Periodistas en las rutas del exilio (edicion 2021 a 2025)"
    ]
  },
  playbackMessages: {
    example_title: "Referencia cronologica",
    example_body: "Agregue sus referencias en PLAYBACK_CUES y traduzcalas aqui."
  }
};

export const TYPE_LABELS = {
  fr: {
    "Assassinat": "Assassinat"
  },
  en: {
    "Assassinat": "Killing"
  },
  es: {
    "Assassinat": "Asesinato"
  }
};

export function getDisplayLabelForType(type, lang) {
  const dict = TYPE_LABELS[lang] || TYPE_LABELS.fr;
  return dict[type] || type;
}

export function applyStaticTextsForLang(lang) {
  const strings = UI_STRINGS[lang] || UI_STRINGS.fr;
  const ui = strings.ui;

  const titleEl = document.getElementById("floating-title");
  if (titleEl) titleEl.textContent = ui.floatingTitle;

  const subtitleEl = document.getElementById("floating-subtitle");
  if (subtitleEl) subtitleEl.textContent = ui.floatingSubtitle;

  const clearFilters = document.getElementById("title-clear-filters");
  if (clearFilters) clearFilters.textContent = ui.clearFilters;

  const supplementToggle = document.getElementById("title-supplement-toggle");
  if (supplementToggle) supplementToggle.textContent = ui.filtersLabel;

  const bottomTitle = document.querySelector(".bottom-chart-title");
  if (bottomTitle) bottomTitle.textContent = ui.bottomChartTitle;

  const eventPanelTitle = document.querySelector(".panel-list-title");
  if (eventPanelTitle) eventPanelTitle.textContent = ui.eventPanelTitle;

  document.querySelectorAll(".panel-close-button").forEach(btn => {
    btn.textContent = ui.closeButton;
    btn.setAttribute("aria-label", ui.closeButton);
  });

  const notesTitle = document.getElementById("notes-section-title");
  if (notesTitle) notesTitle.textContent = ui.notesSection;

  const eventFooterNote = document.getElementById("event-footer-note");
  if (eventFooterNote) eventFooterNote.innerHTML = ui.eventFooterNote;

  const tutoBtn = document.getElementById("tutorial-replay-btn");
  if (tutoBtn) tutoBtn.textContent = ui.tutoButton;

  const menuLanguageLabel = document.querySelector(".utility-menu-field > span");
  if (menuLanguageLabel) menuLanguageLabel.textContent = ui.menuLanguage;

  const languageToggle = document.querySelector(".utility-menu .language-toggle");
  if (languageToggle) languageToggle.setAttribute("aria-label", ui.menuLanguage);

  const utilityToggle = document.getElementById("utility-menu-toggle");
  if (utilityToggle) utilityToggle.setAttribute("aria-label", ui.menuOpen);

  [
    ["utility-events-toggle", ui.menuEvents],
    ["utility-regions-mode-toggle", ui.menuRegions],
    ["utility-country-toggle", ui.menuStats],
    ["utility-chart-toggle", ui.menuTimeline],
    ["rsf-cartography-toggle", ui.rsfCartography]
  ].forEach(([id, label]) => {
    const btn = document.getElementById(id);
    if (btn && label) btn.textContent = label;
  });

  const cartographyTitle = document.getElementById("rsf-cartography-title");
  if (cartographyTitle) cartographyTitle.textContent = strings.cartography?.title || ui.rsfCartography;

  const cartographyClose = document.getElementById("rsf-cartography-close");
  if (cartographyClose) cartographyClose.setAttribute("aria-label", strings.cartography?.close || ui.closeButton);

  document.querySelectorAll("#rsf-cartography-modal .rsf-cartography-link span").forEach((span, index) => {
    const label = strings.cartography?.cards?.[index];
    if (label) span.textContent = label;
  });

  const skipBtn = document.getElementById("tutorial-skip-btn");
  if (skipBtn) skipBtn.textContent = strings.tutorial.skipLabel;

  const tutLangBtn = document.getElementById("tutorial-lang-btn");
  if (tutLangBtn) tutLangBtn.textContent = ui.tutorialLangButton;

  const loaderSubtitle = document.querySelector(".loading-subtitle");
  const loaderSubtext = document.querySelector(".loading-subtext");
  if (loaderSubtitle) loaderSubtitle.textContent = strings.loader.subtitle;
  if (loaderSubtext) loaderSubtext.textContent = strings.loader.subtext;
  const loaderRetry = document.getElementById("loading-retry");
  if (loaderRetry) loaderRetry.textContent = strings.loader.retry;

  const totalLabelEl = document.getElementById("country-rank-label");
  const citiesLabelEl = document.getElementById("country-score-label");
  if (totalLabelEl) totalLabelEl.textContent = ui.oblastTotalLabel;
  if (citiesLabelEl) citiesLabelEl.textContent = ui.oblastCitiesLabel;

  const nameEl = document.getElementById("country-name");
  if (nameEl) nameEl.textContent = ui.selectOblast;

  const footer = document.getElementById("footer-credits");
  if (footer && ui.footerCredits) footer.innerHTML = ui.footerCredits;

  window.currentlang = lang;
  bindCreditsModalOnce();
}

function openCreditsModal({ title, html }) {
  const modal = document.getElementById("credits-modal");
  const t = document.getElementById("credits-title");
  const b = document.getElementById("credits-body");
  if (!modal || !t || !b) return;

  t.textContent = title || "";
  b.innerHTML = html || "";
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeCreditsModal() {
  const modal = document.getElementById("credits-modal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

let creditsBound = false;
function bindCreditsModalOnce() {
  if (creditsBound) return;
  creditsBound = true;

  document.addEventListener("click", (e) => {
    const openBtn = e.target.closest?.("[data-open-credits]");
    const closeBtn = e.target.closest?.("[data-close-credits]");

    if (openBtn) {
      e.preventDefault();
      const lang = window.currentlang || "fr";
      const strings = UI_STRINGS[lang] || UI_STRINGS.fr;
      openCreditsModal({
        title: strings.ui.creditsTitle || "Credits",
        html: strings.ui.flaticonCredits
      });
    }

    if (closeBtn) {
      e.preventDefault();
      closeCreditsModal();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeCreditsModal();
  });
}
