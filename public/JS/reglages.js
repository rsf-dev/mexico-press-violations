// JS/reglages.js
// Configuration de la carte Mexique : chemins, données, options et contrôles.

export const REGLAGES = {
  projet: {
    titreHtml: "Mexique - journalistes assassinés",
    langueParDefaut: "fr",
    langues: ["fr", "en", "es"],
    indexationMoteurs: false
  },

  fichiers: {
    donnees: {
      fr: "evenements.json",
      en: "evenements.json",
      es: "evenements.json"
    },
    geojson: {
      regions: "geojson/geoBoundaries-MEX-ADM1_simplified.geojson",
      niveauxAdministratifs: []
    },
    assets: {
      feuilleDeStyle: "css/style.css",
      logo: "logo.svg",
      favicon: "logo.svg",
      dossierIcones: "icons/",
      iconeParDefaut: "assassinat.png"
    },
    modules: {
      dates: "./utils/dates.js",
      strings: "./utils/strings.js",
      security: "./utils/security.js",
      bottomChart: "./charts/bottomChart.js",
      eventsRenderer: "./events/eventsRenderer.js",
      panelScroll: "./ui/panelScroll.js",
      oblastFilters: "./ui/oblastFilters.js",
      playback: "./playback/playback.js",
      i18n: "./i18n/i18n.js",
      tutorial: "./tutorial/tutorial.js",
      menu: "./ui/menu.js",
      nearbyNavigation: "./maps/nearbyNavigation.js",
      mapRendering: "./maps/rendering.js",
      geojsonLevels: "./maps/geojsonLevels.js"
    }
  },

  champsDonnees: {
    date: ["date", "date_evenement", "date_event", "date_iso"],
    emplacement: ["lieu", "ville", "Ville", "city", "City", "location", "Location"],
    personne: ["journaliste", "Journaliste", "name", "Name", "nom", "Nom"],
    description: ["description", "Description", "summary", "Summary"],
    categorie: ["type_violence", "type", "Type", "category", "Category"],
    zone: ["Province_FR", "Province_EN", "Province_ES", "Province", "province", "region", "Region", "Oblast", "oblast"],
    nomGeojson: ["Geojson", "geojson", "ShapeName", "shapeName"],
    latitude: ["lat", "latitude", "Latitude"],
    longitude: ["lng", "lon", "longitude", "Longitude"],
    identifiant: ["compteur_evenements", "id", "ID"],
    lien: ["lien", "Lien", "link", "Link", "URL", "url", "Url"]
  },

  carte: {
    // Projections : "mercator" (EPSG:3857, compatible avec les fonds actuels) ; "naturalEarth2" (Proj4Leaflet et fonds compatibles requis).
    projection: "mercator",
    centreInitial: [23.8, -102.4],
    zoomInitial: 5,
    zoomMinimum: 4,
    zoomMaximum: 15,
    zoomDelta: 0.5,
    zoomSnap: 0.1,
    wheelPxPerZoomLevel: 60,
    scrollWheelZoom: true,
    // Attente maximale des tuiles et du rendu, en millisecondes.
    delaiChargementMaximum: 30000,
    zoomSurEmplacement: 7,
    zoomMaximumContour: 7,
    ajusterVueAuContour: true,
    attribution: '<a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener noreferrer">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
    cleCarto: "",
    // "maplibre" : style vectoriel ; "raster" : tuiles image. Un seul actifParDefaut: true.
    // Pour changer le fond initial, mettre son actifParDefaut à true et les autres à false.
    // theme : "light" ou "dark" ; une seule entrée actifParDefaut: true.
    // maxNativeZoom évite de demander au fournisseur des tuiles inexistantes.
    fonds: [
      {
        id: "positron",
        labels: {
          fr: "Clair",
          en: "Light",
          es: "Claro"
        },
        type: "maplibre",
        url: "https://tiles.openfreemap.org/styles/positron",
        options: {
          attributionControl: false
        },
        theme: "light",
        actifParDefaut: false
      },
      {
        id: "dark",
        labels: {
          fr: "Sombre",
          en: "Dark",
          es: "Oscuro"
        },
        type: "maplibre",
        url: "https://tiles.openfreemap.org/styles/dark",
        options: {
          attributionControl: false
        },
        theme: "dark",
        actifParDefaut: false
      },
      {
        id: "fiord",
        labels: {
          fr: "Fiord",
          en: "Fiord",
          es: "Fiord"
        },
        type: "maplibre",
        url: "https://tiles.openfreemap.org/styles/fiord",
        options: {
          attributionControl: false
        },
        theme: "dark",
        actifParDefaut: false
      },
      {
        id: "liberty",
        labels: {
          fr: "Liberty",
          en: "Liberty",
          es: "Liberty"
        },
        type: "maplibre",
        url: "https://tiles.openfreemap.org/styles/liberty",
        options: {
          attributionControl: false
        },
        theme: "light",
        actifParDefaut: false
      },
      {
        id: "bright",
        labels: {
          fr: "Bright",
          en: "Bright",
          es: "Bright"
        },
        type: "maplibre",
        url: "https://tiles.openfreemap.org/styles/bright",
        options: {
          attributionControl: false
        },
        theme: "light",
        actifParDefaut: false
      },
      {
        id: "satellite",
        labels: {
          fr: "Satellite",
          en: "Satellite",
          es: "Satélite"
        },
        type: "raster",
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        options: {
          maxNativeZoom: 23
        },
        theme: "light",
        attribution: "Tiles &copy; Esri",
        actifParDefaut: true
      },
      {
        id: "relief",
        labels: {
          fr: "Relief",
          en: "Relief",
          es: "Relieve"
        },
        type: "raster",
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}",
        options: {
          maxNativeZoom: 13
        },
        theme: "light",
        attribution: "Tiles &copy; Esri",
        actifParDefaut: false
      }
    ]
  },

  categorieParDefaut: "Assassinat",
  categories: [
    { cle: "Assassinat", slug: "assassinat", icone: "assassinat.png", couleur: "#dc143c", labels: { fr: "Assassinat", en: "Murder", es: "Asesinato" }, valeursEntree: ["Assassinat", "Murder", "Asesinato"] }
  ],
  listeCas: { champsSupplementaires: [] },
  stylesGeojson: {
    // color / opacity / weight : couleur, opacité (0 à 1) et épaisseur du contour.
    // fillColor / fillOpacity : couleur et opacité (0 à 1) du remplissage.
    // stroke / fill : afficher le contour / le remplissage (true ou false).
    // Chaque couche complète ce style par défaut ; fillColor: null reprend color.
    defaut: {
      stroke: true, color: "#3388ff", weight: 3, opacity: 1,
      fill: true, fillColor: null, fillOpacity: 0.2
    },
    // Limites des États en mode marqueurs (hors choroplèthe).
    contour: {
      stroke: true, color: "#015CBB", weight: 0.5, opacity: 0.9,
      fill: true, fillColor: "#015CBB", fillOpacity: 0.3
    },
    // État sélectionné en mode marqueurs.
    selection: {
      stroke: true, color: "#FED501", weight: 1, opacity: 1,
      fill: true, fillColor: "#FED501", fillOpacity: 0.15
    },
    // Niveaux GeoJSON optionnels ; chaque entrée niveauxAdministratifs[].style
    // peut remplacer ces valeurs dans fichiers.geojson.
    niveauxAdministratifs: {
      stroke: true, color: "#64748b", weight: 1, opacity: 0.8,
      fill: true, fillColor: "#64748b", fillOpacity: 0
    }
  },
  choropleth: {
    couleurSansCas: "#7890a0",
    couleurMinimum: "#f7d457",
    couleurMaximum: "#76001f",
    contour: "rgba(255,255,255,0.82)",
    // Bordures fines du Bilan, constantes au survol.
    epaisseurContour: 0.6,
    opaciteSansCas: 0.42,
    opaciteAvecCas: 0.9
  },

  fonctionnalites: {
    navigationProche: {
      enabled: true, // Navigation vers le groupe ou événement hors écran le plus proche.
      zoomMinimum: 11,
      maximumVisibles: 1, // Afficher le bouton avec 0 ou 1 groupe/événement visible.
      margeDesktop: 56, // Pixels ; le placement évite aussi les panneaux et commandes.
      margeMobile: 20,
      espacementComposants: 12,
      seuilMobile: 768,
      dureeDeplacement: 0.65 // Secondes ; le zoom final reste inchangé.
    },
    listeCas: { enabled: true },
    statistiques: { enabled: true },
    chronologie: { enabled: true },
    lecture: { enabled: true },
    tutoriel: {
      enabled: true, // Conserve le bouton Tutoriel dans le menu.
      // false : ne pas ouvrir le tutoriel à l'arrivée sur la page.
      // true : l'ouvrir après le chargement, uniquement s'il n'a pas déjà été vu.
      demarrageAutomatique: false
    },
    langues: { enabled: true },
    rsfCartographie: { enabled: true },
    contour: { enabled: true },
    statutsRegions: { enabled: false },
    filtresAdditionnels: { enabled: true },
    occupationLayer: { enabled: false },
    choropleth: { enabled: true, actifParDefaut: true }
  },

  controles: {
    panneauTitre: {
      ouvertParDefaut: true,
      afficherZone: true,
      afficherEmplacement: true,
      afficherDates: true,
      afficherCategories: false,
      afficherEffacerFiltres: true
    },
    lecture: {
      vitesses: [0.5, 1, 2],
      vitesseParDefaut: 1,
      afficherPrecedent: true,
      afficherLecturePause: true,
      afficherSuivant: true,
      afficherFin: true
    },
    statistiques: {
      vues: ["zones", "emplacements"],
      vueParDefaut: "zones",
      lignesMaximumZones: 27,
      lignesMaximumEmplacements: 100
    },
    menu: {
      ordre: ["langues", "tutoriel", "listeCas", "choropleth", "statistiques", "chronologie", "rsfCartographie"]
    }
  },

  filtresAdditionnels: [
    { id: "homme", enabled: true, filterable: true, fields: ["genre", "Genre", "sexe", "Sexe", "gender", "Gender", "homme_femme", "Homme_Femme", "homme/femme", "Homme/Femme", "masculin_feminin", "Masculin_Feminin", "masculin/feminin", "Masculin/Feminin", "masculin/féminin", "Masculin/Féminin", "H/F"], values: ["homme", "hommes", "h", "male", "man", "men", "masculin", "masculino", "hombre", "hombres"], group: "genre", groupExclusive: true, showBadge: false, labels: { fr: "Hommes", en: "Men", es: "Hombres" } },
    { id: "femme", enabled: true, filterable: true, fields: ["genre", "Genre", "sexe", "Sexe", "gender", "Gender", "homme_femme", "Homme_Femme", "homme/femme", "Homme/Femme", "masculin_feminin", "Masculin_Feminin", "masculin/feminin", "Masculin/Feminin", "masculin/féminin", "Masculin/Féminin", "H/F"], values: ["femme", "femmes", "f", "female", "woman", "women", "feminin", "féminin", "femenino", "mujer", "mujeres"], group: "genre", groupExclusive: true, showBadge: false, labels: { fr: "Femmes", en: "Women", es: "Mujeres" } },
    { id: "journaliste_local", enabled: true, filterable: true, field: "journaliste_local", fields: ["Journaliste_local", "local_journalist"], values: [true, "oui", "yes", 1], group: "contexte", showBadge: false, labels: { fr: "Journaliste local", en: "Local journalist", es: "Periodista local" } },
    { id: "torture", enabled: true, filterable: true, field: "Torture", values: [true, "oui", "yes", 1], group: "contexte", labels: { fr: "Torture", en: "Torture", es: "Tortura" } },
    { id: "crime_organise", enabled: true, filterable: false, field: "Crime_organise", values: [true, "oui", "yes", 1], group: "contexte", showBadge: false, labels: { fr: "Crime organisé", en: "Organized crime", es: "Crimen organizado" } },
    { id: "enquete_crime", enabled: true, filterable: true, field: "enquete_crime", fields: ["Enquete_crime", "enquête_crime", "Enquête_crime", "enquete_criminalite", "Enquete_criminalite", "enquête_criminalité", "Enquête_criminalité", "enquête sur la criminalité", "Enquête sur la criminalité", "enquete sur la criminalite", "Enquete sur la criminalite", "enquête sur le crime organisé", "Enquête sur le crime organisé", "enquete sur le crime organise", "Enquete sur le crime organise"], values: [true, "oui", "yes", 1], group: "contexte", labels: { fr: "Enquêtait sur la criminalité", en: "Investigated crime", es: "Investigaba criminalidad" } },
    { id: "enquete_politique", enabled: true, filterable: true, field: "enquete_politique", fields: ["Enquete_politique", "enquête_politique", "Enquête_politique", "politique", "Politique", "enquête sur la politique", "Enquête sur la politique", "enquete sur la politique", "Enquete sur la politique"], values: [true, "oui", "yes", 1], group: "contexte", labels: { fr: "Enquêtait sur la politique", en: "Investigated politics", es: "Investigaba política" } },
    { id: "sous_protection", enabled: true, filterable: true, field: "Sous_protection", values: [true, "oui", "yes", 1], group: "contexte", labels: { fr: "Sous protection", en: "Under protection", es: "Bajo proteccion" } },
    { id: "crime_elucide", enabled: true, filterable: false, field: "crime_elucide", fields: ["Crime_elucide", "crime élucidé"], values: [true, "oui", "yes", 1], group: "contexte", labels: { fr: "Crime élucidé", en: "Solved crime", es: "Crimen esclarecido" } }
  ],

  lecture: {
    dateDebut: "01/01/2006",
    dateFin: null,
    reperes: []
  },

  cartesLiees: [
    { href: "https://rsf-carte-journalistes-tues-disparus-otages-detenus-2025.rsf.org/", image: "assets/carte_bilan.png", labels: { fr: "Violences contre les journalistes dans le monde (édition 2025)", en: "Violence against journalists worldwide (2025 edition)", es: "Violencia contra periodistas en el mundo (edición 2025)" } },
    { href: "https://ukraine-mobilisation.rsf.org/", image: "assets/carte_ukraine.png", labels: { fr: "Surveillance des violences contre les journalistes en Ukraine", en: "Monitoring violence against journalists in Ukraine", es: "Seguimiento de la violencia contra periodistas en Ucrania" } },
    { href: "https://grands-lacs.rsf.org/", image: "assets/grands-lacs.png", labels: { fr: "Surveillance des violences contre les journalistes dans la région des Grands Lacs africains", en: "Monitoring violence against journalists in Africa's Great Lakes region", es: "Seguimiento de la violencia contra periodistas en la región de los Grandes Lagos" } },
    { href: "https://routes-de-l-exil.data.rsf.org/", image: "assets/carte_exil.png", labels: { fr: "Les journalistes sur les routes de l'exil (édition 2021 à 2025)", en: "Journalists on the routes of exile (2021 to 2025 edition)", es: "Periodistas en las rutas del exilio (edición 2021 a 2025)" } }
  ]
};

export function validerReglages(reglages = REGLAGES) {
  const erreurs = [];
  if (!reglages.projet?.langues?.includes(reglages.projet.langueParDefaut)) erreurs.push("la langue par défaut doit être présente dans projet.langues");
  if (!reglages.fichiers?.donnees?.[reglages.projet?.langueParDefaut]) erreurs.push("le fichier de données par défaut est manquant");
  if (!reglages.fichiers?.geojson?.regions) erreurs.push("le GeoJSON des régions est manquant");
  if (!reglages.categories?.some(categorie => categorie.cle === reglages.categorieParDefaut)) erreurs.push("categorieParDefaut doit désigner une catégorie configurée");
  if (erreurs.length) throw new Error(`[reglages.js] ${erreurs.join(" ; ")}`);
  return true;
}
