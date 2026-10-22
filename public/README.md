# Carte RSF - Mexique

Guide pas à pas commun aux cartes et procédure ADM02 : [GUIDE_ADMIN_CARTES.md](../GUIDE_ADMIN_CARTES.md). Le Mexique utilise aussi les libellés espagnols et son propre jeu de filtres additionnels.

Carte de suivi des assassinats de journalistes au Mexique. La configuration de la carte est centralisée dans `JS/reglages.js`; les traductions et le contenu du tutoriel sont dans `JS/i18n/i18n.js`.

Les fonds se règlent dans `carte.fonds` : OpenFreeMap Bright est actif par défaut ; Clair, Sombre, Liberty et Satellite sont proposés en commentaires. `JS/maps/rendering.js` synchronise les contours avec le fond vectoriel et attend les tuiles avant de retirer le loader. Le zoom maximal et `carte.delaiChargementMaximum` sont configurables.

Comme sur le Bilan, le choroplèthe utilise une échelle logarithmique, des bordures fines et une infobulle compacte. `choropleth.epaisseurContour` règle leur épaisseur, qui reste constante au survol. Les infobulles et les clics restent actifs, sans highlight de région. Le GeoJSON est envoyé une seule fois à MapLibre : les filtres actualisent uniquement les couleurs et opacités avec `feature-state`, sans resérialisation ni redécoupage des géométries. La simplification des tuiles utilise la tolérance standard de MapLibre (0,375 pixel).

Le démarrage charge les événements, les régions et le fond en parallèle, puis attend une seule fois le rendu final. Un seul loader conserve son titre Mexique et sa progression jusqu'à 100 %, puis disparaît en fondu avant le tutoriel. Le fond Satellite conserve le rendu Leaflet ; les changements de fond et les niveaux administratifs optionnels restent pris en charge.

Le module inutilisé `utils/math.js` et le traitement de survol qui reconstruisait les sources ont été supprimés. Les modules configurables inactifs sont conservés, notamment `maps/geojsonLevels.js` pour les niveaux administratifs et `ui/legend.js` associé à l'option historique `afficherCategories` (son interface n'est pas montée dans cette carte).

## Structure de la carte

```text
Mexique/
├── index.html                 # structure HTML, CDN Leaflet et point d'entree
├── evenements.json            # cas et champs traduits FR / EN / ES
├── geojson/                   # geometries des Etats mexicains
├── icons/                     # icones de categories et credits
├── css/style.css              # styles et mise en page
└── JS/
    ├── reglages.js            # chemins, carte, categorie, filtres et commandes
    ├── main.js                # orchestration et logique specifique au Mexique
    ├── i18n/i18n.js            # textes visibles FR / EN / ES
    ├── charts/                # graphiques et chronologie
    ├── events/                # marqueurs et liste des cas
    ├── playback/              # lecture chronologique
    ├── tutorial/              # tutoriel interactif
    ├── ui/                    # legendes et filtres Etat / ville
    └── utils/                 # dates, chaines, securite et calculs
```

`main.js` connecte les modules et lit les options dans `reglages.js`. Pour une mise à jour courante, l'administrateur modifie d'abord les données et les réglages; il ne modifie le code que si une nouvelle interaction ou un nouveau module est nécessaire.

## Mettre à jour les cas

1. Modifiez `evenements.json`, qui contient les versions françaises, anglaises et espagnoles des cas.
2. Conservez un tableau JSON et vérifiez les champs requis :

```json
{
  "date": "2025-01-15",
  "lieu": "Ville exemple",
  "journaliste": "Nom du journaliste",
  "description_FR": "Description en français",
  "description_EN": "Description in English",
  "description_ES": "Descripción en español",
  "Province_FR": "État exemple",
  "Province_EN": "Example state",
  "Province_ES": "Estado ejemplo",
  "Geojson": "ShapeName de l'Etat",
  "lat": 19.4326,
  "lng": -99.1332,
  "auteur": "Auteur de l'atteinte",
  "Torture": "Non",
  "Crime_organise": "Oui",
  "Sous_protection": "Non",
  "crime_elucide": "Non",
  "URL": "https://example.org"
}
```

3. La valeur de `Geojson` doit correspondre à `properties.shapeName` dans `geojson/geoBoundaries-MEX-ADM1_simplified.geojson`. Les noms d'État doivent rester cohérents dans les trois champs `Province_*` pour que les filtres et graphiques trouvent les cas.
4. Contrôlez les dates ISO (`AAAA-MM-JJ`), les coordonnées numériques et les liens HTTPS. Une traduction absente reste vide; elle n'est pas remplacée automatiquement par une autre langue.

Le champ `URL` alimente le bouton « Lire plus » de chaque cas, comme sur la carte Ukraine. Les alias historiques `lien`, `Lien`, `link` et `Link` restent acceptés via `champsDonnees.lien`. Plusieurs adresses dans un même champ, séparées par des espaces ou retours à la ligne, donnent plusieurs boutons numérotés. Les liens s'ouvrent dans un nouvel onglet, sans déclencher le centrage du cas sur la carte. Un champ vide ou une adresse invalide n'affiche aucun bouton. Les libellés suivent la langue de l'interface (FR/EN/ES).

Les colonnes alternatives acceptées par le chargeur sont définies dans `REGLAGES.champsDonnees`. Si la source ajoute un nouveau nom de colonne, ajoutez-le à la liste correspondante avant de modifier le traitement dans `main.js`.

## Régler la carte

Les contours et remplissages GeoJSON hors choroplèthe se règlent uniquement dans `JS/reglages.js`, sous `stylesGeojson` : `contour` pour les limites des États, `selection` pour l'État sélectionné et `niveauxAdministratifs` pour les couches optionnelles. `defaut` fournit les valeurs communes aux propriétés omises. Dans chaque bloc, `color`, `weight` et `opacity` contrôlent le contour ; `fillColor` et `fillOpacity` contrôlent le remplissage. `stroke: false` masque le contour, `fill: false` masque le remplissage. `fillColor: null` reprend la couleur du contour. Les mêmes réglages sont appliqués au rendu OpenFreeMap et au rendu Satellite. Une entrée `fichiers.geojson.niveauxAdministratifs[].style` peut surcharger le style des niveaux optionnels.

`JS/reglages.js` contient les options modifiables par carte :

- `fichiers` : JSON, GeoJSON, CSS, logo, icônes et chemins des modules JavaScript ;
- `champsDonnees` : alias des colonnes de la source ;
- `carte` : centre, niveaux de zoom, fonds de carte, attribution et fond par défaut ;
- `categories` : catégorie, libellés, icône et couleur ; le Mexique utilise actuellement `Assassinat` ;
- `filtresAdditionnels` : champs, valeurs, libellés et groupes exclusifs des filtres ;
- `fonctionnalites` : visibilité de la liste, des statistiques, de la chronologie, du tutoriel et du mode choroplèthe ;
- `controles` : ordre du menu, filtres du panneau titre, boutons de lecture et vues États/Villes ;
- `lecture` : date de départ, date de fin, vitesses et repères ;
- `choropleth` : couleurs et opacités du mode choroplèthe ;
- `cartesLiees` : liens et images de la modale « RSF cartographie ».

Le mode choroplèthe est activé et affiché par défaut. La couche d'occupation et les statuts de régions ne sont pas pris en charge par le code de la carte Mexique : les options correspondantes sont désactivées à titre descriptif et les activer dans `reglages.js` ne suffit pas. Il faut d'abord intégrer leurs modules et leur interface dans `main.js`.

Les boutons et textes généraux traduits sont dans `JS/i18n/i18n.js`. Les noms des filtres complémentaires sont configurés dans `REGLAGES.filtresAdditionnels`. Lorsqu'une nouvelle langue est ajoutée, renseignez-la dans `REGLAGES.projet.langues`, ajoutez ses boutons dans `index.html`, puis complétez `UI_STRINGS` et les descriptions/champs localisés des données.

Le tutoriel comporte sept étapes en français, anglais et espagnol. Son bouton de langue parcourt les langues configurées dans `projet.langues`. Dans `fonctionnalites.tutoriel`, `demarrageAutomatique: false` désactive son ouverture à l'arrivée sur la page tout en conservant le bouton Tutoriel dans le menu (`enabled: true`). Passez `demarrageAutomatique` à `true` pour le lancer après le chargement lors d'une première visite. `enabled: false` masque entièrement le tutoriel et son bouton.

Pour ajouter un filtre complémentaire, créez son contrôle `data-supplement-filter` dans `index.html`, ajoutez sa définition (champ, valeurs reconnues, traduction et groupe éventuel) dans `reglages.js`, puis vérifiez les résumés et badges correspondants dans `main.js`.

## Vérifier et publier

Servez le dossier avec un serveur HTTP local; ne l'ouvrez pas directement en `file://`, car la carte charge des modules et fichiers JSON. Vérifiez les trois langues, les filtres de dates et d'États, les boutons complémentaires, la liste des cas, les graphiques, le choroplèthe et la chronologie. Lorsqu'un module ou un asset change, incrémentez le paramètre `v` des ressources CSS et JavaScript dans `index.html` afin d'éviter un ancien cache, puis déployez le dossier complet avec les fichiers de données et GeoJSON nécessaires.


## Fonds de carte et thèmes

Les sept fonds sont disponibles dans `carte.fonds` : Clair, Sombre, Fiord, Liberty, Bright, Satellite et Relief. Une seule entrée doit avoir `actifParDefaut: true`. Le fond initial propre à cette carte est conservé.

Chaque fond déclare `theme: "light"` ou `"dark"`. Sombre, Fiord et Satellite utilisent des panneaux noirs avec texte clair ; les autres fonds utilisent des panneaux blancs avec texte sombre. Les noms du fournisseur ne sont pas des valeurs de thème. `css/themes.css` regroupe les palettes des panneaux, formulaires, légendes, menus et contrôles. La chronologie redessine aussi ses axes et son fond au changement de thème.

Les tuiles Relief sont disponibles jusqu’au zoom natif 13 et Satellite jusqu’au zoom natif 23 ; `options.maxNativeZoom` permet de les agrandir aux zooms supérieurs autorisés par la carte. Les données, filtres, contours et options propres à la carte sont conservés.

Le menu burger ferme au clic extérieur et avec Échap, sans réinitialiser les filtres. Son attribut `hidden`, son état ouvert et `aria-expanded` sont synchronisés.

## Navigation vers les événements proches

En mode marqueurs, à partir du zoom 11, un bouton fléché indique le groupe ou événement le plus proche hors écran ou caché par un panneau, lorsqu’il reste au plus une icône visible. Il reprend l’icône du cas ou le nombre d’événements du groupe et indique sa distance dans l’infobulle. Les cibles suivent les filtres et la période affichée ; le clic conserve le zoom final et place la cible dans une zone dégagée. La lecture est suspendue au clic.

Le bouton suit les thèmes clair et sombre. Il évite panneaux, titre, menu, zoom et légendes : marge de 56 px sur le pourtour en ordinateur ; placement au bas de la zone libre, au-dessus du titre, avec une marge de 20 px en mobile. Il se masque en choroplèthe, pendant les déplacements, sous les fenêtres et quand un panneau mobile ou l’encombrement ne laisse pas assez de place.

Dans `JS/reglages.js`, `fonctionnalites.navigationProche` regroupe `enabled`, `zoomMinimum`, `maximumVisibles`, `margeDesktop`, `margeMobile`, `espacementComposants`, `seuilMobile` et `dureeDeplacement` (secondes). `enabled: false` désactive la navigation. Les libellés suivent la langue de la carte.
