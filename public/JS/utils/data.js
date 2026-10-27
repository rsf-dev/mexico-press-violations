// Conserver le même cache-busting que les imports pilotés par main.js.
const version = new URL(import.meta.url).searchParams.get("v");
const { parseDateFlexible } = await import(`./dates.js${version ? `?v=${encodeURIComponent(version)}` : ""}`);

// Bornes adaptées à cette carte statique (169 cas et GeoJSON de 4 Mo à l'audit).
export const DATA_LIMITS = Object.freeze({ events: 5000, fields: 100, text: 20000, eventsBytes: 5 * 1024 * 1024, geojsonBytes: 12 * 1024 * 1024 });

export async function fetchJson(url, { maxBytes, timeoutMs = 30000, fetchImpl = globalThis.fetch } = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new Error("Limite JSON manquante.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let reader;
  try {
    const response = await fetchImpl(url, { signal: controller.signal, credentials: "omit", referrerPolicy: "no-referrer" });
    if (!response.ok) throw new Error(`Chargement JSON : HTTP ${response.status}`);
    if (Number(response.headers.get("content-length")) > maxBytes) throw new Error("Fichier JSON trop volumineux.");
    // Compter aussi les octets décompressés, même sans Content-Length.
    reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error("Fichier JSON trop volumineux.");
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    controller.abort();
    try { await reader?.cancel(); } catch { /* Le flux peut déjà être fermé. */ }
    throw error;
  } finally {
    clearTimeout(timer);
    reader?.releaseLock();
  }
}

export function validateEvents(data, fields) {
  if (!Array.isArray(data) || data.length > DATA_LIMITS.events) throw new Error("Tableau de cas invalide ou trop volumineux.");
  const linkFields = new Set(fields.lien || []);
  return data.map((row, index) => {
    const invalid = () => new Error(`Structure invalide pour le cas ${index + 1}.`);
    if (!row || typeof row !== "object" || Array.isArray(row)) throw invalid();
    const entries = Object.entries(row);
    if (entries.length > DATA_LIMITS.fields) throw invalid();
    const event = Object.create(null);
    for (const [key, value] of entries) {
      if (key.length > 128 || ["__proto__", "constructor", "prototype"].includes(key)) throw invalid();
      if (Array.isArray(value) && linkFields.has(key)) {
        if (value.length > 20 || value.some(url => typeof url !== "string" || url.length > 4096)) throw invalid();
        event[key] = value.slice();
      } else {
        if (value !== null && !["string", "number", "boolean"].includes(typeof value)) throw invalid();
        if (typeof value === "string" && value.length > DATA_LIMITS.text) throw invalid();
        if (typeof value === "number" && !Number.isFinite(value)) throw invalid();
        event[key] = value;
      }
    }
    // Les champs utilisés comme libellés ou clés doivent rester du texte.
    const textFields = new Set([
      ...(fields.emplacement || []), ...(fields.personne || []), ...(fields.description || []),
      ...(fields.zone || []), "pays", "Pays", ...(fields.nomGeojson || []), ...(fields.categorie || []),
      ...Object.keys(event).filter(key => /^(description|province)_/i.test(key))
    ]);
    for (const key of textFields) {
      if (event[key] != null && typeof event[key] !== "string") throw invalid();
    }
    for (const key of fields.date || []) {
      if (event[key] == null || event[key] === "") continue;
      const date = parseDateFlexible(event[key]);
      if (!date || date.getUTCFullYear() < 1900 || date.getUTCFullYear() > 2100) throw invalid();
    }
    return event;
  });
}

export function parseCoordinate(value, maximum) {
  if (typeof value !== "number" && (typeof value !== "string" || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim()))) return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= maximum ? number : null;
}

export function validateGeoJson(data) {
  if (!data || data.type !== "FeatureCollection" || !Array.isArray(data.features) || data.features.length > 10000) throw new Error("Collection GeoJSON invalide.");
  let positions = 0;
  const ring = coordinates => {
    if (!Array.isArray(coordinates) || coordinates.length < 4) throw new Error("Anneau GeoJSON invalide.");
    for (const point of coordinates) {
      if (++positions > 500000 || !Array.isArray(point) || point.length < 2 || point.length > 3 ||
          !point.every(Number.isFinite) || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90) throw new Error("Coordonnées GeoJSON invalides ou trop nombreuses.");
    }
    const first = coordinates[0], last = coordinates[coordinates.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) throw new Error("Anneau GeoJSON non fermé.");
  };
  for (const feature of data.features) {
    const geometry = feature?.geometry;
    if (feature?.type !== "Feature" || !feature.properties || typeof feature.properties !== "object" || Array.isArray(feature.properties) || !geometry) throw new Error("Entité GeoJSON invalide.");
    const properties = Object.entries(feature.properties);
    if (properties.length > 100 || properties.some(([key, value]) =>
      key.length > 128 || ["__proto__", "constructor", "prototype"].includes(key) ||
      (value !== null && !["string", "number", "boolean"].includes(typeof value)) ||
      (typeof value === "string" && value.length > DATA_LIMITS.text) ||
      (typeof value === "number" && !Number.isFinite(value))
    )) throw new Error("Propriétés GeoJSON invalides.");
    for (const key of ["shapeName", "name", "region"]) {
      if (feature.properties[key] != null && (typeof feature.properties[key] !== "string" || feature.properties[key].length > 1000)) throw new Error("Libellé GeoJSON invalide.");
    }
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : null;
    if (!Array.isArray(polygons) || !polygons.length) throw new Error("Géométrie GeoJSON non prise en charge.");
    for (const polygon of polygons) {
      if (!Array.isArray(polygon) || !polygon.length) throw new Error("Polygone GeoJSON invalide.");
      polygon.forEach(ring);
    }
  }
  return data;
}
