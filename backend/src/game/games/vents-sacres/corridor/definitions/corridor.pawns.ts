export type CorridorPawnChoice = {
  id: string;
  label: string;
  description: string;
};

export const CORRIDOR_PAWNS: CorridorPawnChoice[] = [
  {
    id: 'vent',
    label: 'Le vent',
    description: 'Rapide et changeant, il traverse le corridor sans hésiter.',
  },
  {
    id: 'eau',
    label: "L'eau",
    description:
      'Souple et patiente, elle contourne les obstacles avec précision.',
  },
  {
    id: 'terre',
    label: 'La terre',
    description:
      'Stable et solide, elle avance avec une régularité implacable.',
  },
  {
    id: 'feu',
    label: 'Le feu',
    description:
      'Direct et audacieux, il cherche la ligne d’arrivée sans détour.',
  },
];
