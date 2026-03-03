export type MorpionPawnDefinition = {
  id: string;
  label: string;
  description: string;
  glyph: string;
};

export const MORPION_PAWNS: MorpionPawnDefinition[] = [
  {
    id: 'vent',
    label: 'Le vent',
    description: 'Souple et rapide, il ouvre les chemins.',
    glyph: 'V',
  },
  {
    id: 'eau',
    label: "L'eau",
    description: 'Calme et precise, elle contourne les obstacles.',
    glyph: 'E',
  },
  {
    id: 'terre',
    label: 'La terre',
    description: 'Stable et solide, elle tient la ligne.',
    glyph: 'T',
  },
  {
    id: 'feu',
    label: 'Le feu',
    description: 'Direct et intense, il impose le rythme.',
    glyph: 'F',
  },
];

