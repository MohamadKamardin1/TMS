// Shared tailoring vocabulary used by the customer request form and the
// tailor's review view, so measurement keys typed on one side render with
// friendly labels on the other.

export const GARMENT_TYPES = [
  'Sherwani',
  'Suit (Two-Piece)',
  'Suit (Three-Piece)',
  'Waistcoat',
  'Shalwar Kameez',
  'Kurta',
  'Trouser / Pant',
  'Shirt',
  'Blazer',
  'Jacket',
  'Overcoat',
  'Saree Blouse',
  'Lehenga',
  'Abaya',
  'Other',
];

export const FABRIC_SUGGESTIONS = [
  'Cotton',
  'Khaadi',
  'Washed Cotton',
  'Linen',
  'Silk',
  'Georgette',
  'Chiffon',
  'Velvet',
  'Jacquard',
  'Wool',
  'Polyester',
  'Blended',
];

// Slug -> human label for the structured measurements on the request form.
// Custom measurements added by the customer are stored under a slug of their
// own label and displayed again via `measurementLabel`.
export const DEFAULT_MEASUREMENTS = [
  { key: 'chest', label: 'Chest' },
  { key: 'waist', label: 'Waist' },
  { key: 'hips', label: 'Hips' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'sleeveLength', label: 'Sleeve length' },
  { key: 'armhole', label: 'Armhole' },
  { key: 'collar', label: 'Collar' },
  { key: 'kameezLength', label: 'Kameez / top length' },
  { key: 'shalwarLength', label: 'Shalwar / bottom length' },
  { key: 'thigh', label: 'Thigh' },
];

const KNOWN_LABELS = Object.fromEntries(
  DEFAULT_MEASUREMENTS.map(({ key, label }) => [key, label]),
);

/** Turns a user-typed label into a stable, unique object key. */
export function slugifyLabel(label) {
  return label
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s(.)/g, (_m, c) => c.toUpperCase())
    .replace(/\s/g, '');
}

/** Friendly display label for a measurement key. */
export function measurementLabel(key) {
  if (KNOWN_LABELS[key]) return KNOWN_LABELS[key];
  if (!key) return '';
  // camelCase / snake_case -> Title Case ("chestWidth" -> "Chest width").
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const MEASUREMENT_UNIT_HINT = 'inches — leave blank if not needed';
