export type FouleesFamilyPack = {
  id: string;
  family: string;
  habitat: string;
  pawns: readonly string[];
};

export const FOULEES_FAMILY_PENDING_LABEL =
  "Choisissez la famille d'animaux que vous souhaitez jouer, puis Entree.";

export const FOULEES_FAMILY_PACKS: readonly FouleesFamilyPack[] = [
  {
    id: 'equides',
    family: 'Equides',
    habitat: 'ecurie',
    pawns: ['Alkhal-teke', 'Andalou', 'Frison', 'Pur-sang'],
  },
  {
    id: 'primates',
    family: 'Primates',
    habitat: 'primaterie',
    pawns: ['Douc', 'Gibbon', 'Mandrill', 'Sakis'],
  },
  {
    id: 'oiseaux',
    family: 'Oiseaux',
    habitat: 'voliere',
    pawns: ['Cygne', 'Heron', 'Paon', 'Perroquet'],
  },
  {
    id: 'poissons',
    family: 'Poissons',
    habitat: 'aquarium',
    pawns: ['Anthias', 'Discus', 'Mandarin', 'Merou'],
  },
];

export function toFouleesFamilyChoice(pack: FouleesFamilyPack): {
  id: string;
  label: string;
} {
  return {
    id: pack.id,
    label: `Famille des ${pack.family} (${pack.habitat})`,
  };
}
