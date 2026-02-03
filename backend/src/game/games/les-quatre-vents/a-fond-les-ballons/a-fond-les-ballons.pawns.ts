import type { AFondLesBallonsPawn } from './model/a-fond-les-ballons-state.entity';

export const A_FOND_LES_BALLONS_PAWNS: AFondLesBallonsPawn[] = [
  {
    id: 'capitaine-cacahuete',
    label: 'Capitaine Cacahuète',
    description:
      "Écureuil roux moustachu, chapeau de pirate trop grand, cache-œil en noisette, épée en cure-dents. Aventurier grognon, rêve du « trésor de la noix éternelle ». Accessoire : carte au trésor qui sent la confiture. Pouvoir : « À l’abordage ! ».",
  },
  {
    id: 'professeur-gribouille',
    label: 'Professeur Gribouille',
    description:
      'Rat gris à lunettes carrées, fioles « pouf », « gloup » ou « BOUM », blouse trop longue, chapeau en entonnoir. Généreux mais distrait. Accessoire : bocal de bulles parfumées. Pouvoir : échange de place sur éternuement.',
  },
  {
    id: 'miss-froufrou',
    label: 'Miss Froufrou',
    description:
      "Cochon d’Inde blanc et rose, robe à volants, lunettes cœur, mini miroir pomme, parfum fraise. Coquette et gentille. Accessoire : sèche-cheveux enchanté qui joue de la harpe. Pouvoir : « pause beauté ». ",
  },
  {
    id: 'sir-croquou',
    label: 'Sir Croquou',
    description:
      'Castor brun au monocle doré, nœud papillon géant, théière accrochée à la queue. Très poli. Accessoire : valise de biscuits au citron. Pouvoir : « prendre le thé ».',
  },
  {
    id: 'chinchillator-3000',
    label: 'Chinchillator 3000',
    description:
      'Chinchilla argenté mi-robot, mi-roue de hamster. Un peu buggé mais très rapide. Accessoire : antenne extensible et oreille-micro. Pouvoir : « BIP-BLOUP-ZING ».',
  },
  {
    id: 'hamstero-dynamite',
    label: 'Hamstéro Dynamite',
    description:
      'Hamster beige et blanc, bandana rouge, lunettes de moto, mini cape. Hyperactif. Accessoire : pétards inoffensifs et serpentins. Pouvoir : « super tourbillon ».',
  },
];

const normalizeText = (value: string): string =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');

export const resolvePawnId = (raw: unknown): string | null => {
  if (raw == null) return null;
  if (typeof raw === 'object') {
    const maybeId = (raw as any)?.id ?? (raw as any)?.pawnId ?? (raw as any)?.value;
    if (typeof maybeId === 'string' || typeof maybeId === 'number') {
      raw = maybeId;
    }
  }
  const text = String(raw).trim();
  if (!text) return null;
  const key = normalizeText(text);
  if (!key) return null;
  const direct = A_FOND_LES_BALLONS_PAWNS.find((p) => normalizeText(p.id) === key);
  if (direct) return direct.id;
  const byLabel = A_FOND_LES_BALLONS_PAWNS.find((p) => normalizeText(p.label) === key);
  return byLabel ? byLabel.id : null;
};
