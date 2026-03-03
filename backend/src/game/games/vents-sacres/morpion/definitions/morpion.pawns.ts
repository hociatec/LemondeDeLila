export type MorpionPawnDefinition = {
  id: string;
  label: string;
  description: string;
  glyph: string;
};

export const MORPION_PAWNS: MorpionPawnDefinition[] = [
  {
    id: 'bourgeon-naissant',
    label: 'Un bourgeon naissant',
    description: "Promesse de vie, il s'eveille en silence.",
    glyph: 'B',
  },
  {
    id: 'fleur-sauvage',
    label: 'Une fleur sauvage',
    description: "Libre et lumineuse, elle parfume l'instant.",
    glyph: 'F',
  },
  {
    id: 'petale-fane',
    label: 'Un pétale fané',
    description: 'Fragile souvenir, il danse avec le vent.',
    glyph: 'P',
  },
  {
    id: 'pomme-de-pin',
    label: 'Une pomme de pin',
    description: 'Rugueuse et solide, elle garde ses secrets.',
    glyph: 'N',
  },
  {
    id: 'souche-ancienne',
    label: 'Une souche ancienne',
    description: 'Ancrée et patiente, elle veille sur la terre.',
    glyph: 'S',
  },
  {
    id: 'ecorce-parfumee',
    label: 'Une écorce parfumée',
    description: 'Chaleureuse et rare, elle raconte la foret.',
    glyph: 'E',
  },
  {
    id: 'caillou-gris',
    label: 'Un caillou gris',
    description: 'Simple et stable, il marque le passage.',
    glyph: 'C',
  },
  {
    id: 'goutte-de-rosee',
    label: 'Une goutte de rosée',
    description: 'Claire et légère, elle brille au matin.',
    glyph: 'R',
  },
  {
    id: 'feuille-tendre',
    label: 'Une feuille tendre',
    description: "Douce et vive, elle frissonne a l'air.",
    glyph: 'L',
  },
];
