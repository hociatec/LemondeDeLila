import type { AventureSauvagePawn } from './model/aventure-sauvage-state.entity';

export const AVENTURE_SAUVAGE_PAWNS: AventureSauvagePawn[] = [
  {
    id: 'lion',
    label: 'Le Lion',
    description:
      "Vous avancez avec une crinière imposante qui bouge à chaque pas. Vous avez l'air majestueux, presque fier de vous, même dans les moments les plus cocasses. Tout le monde vous remarque dès que vous entrez sur le plateau.",
  },
  {
    id: 'elephant',
    label: "L'Éléphant",
    description:
      "Vous progressez avec votre masse imposante et vos oreilles qui se balancent doucement. Chaque pas résonne comme un petit tambour, et votre trompe semble parfois avoir sa propre idée. On ne peut pas vous louper, et votre présence inspire un sourire immédiat.",
  },
  {
    id: 'girafe',
    label: 'La Girafe',
    description:
      "Vous avancez la tête très haute, votre long cou semblant vouloir toucher les nuages. Vos grandes pattes font des pas élégants mais légèrement maladroits, et vous donnez l'impression de toujours observer quelque chose d'intrigant autour de vous.",
  },
  {
    id: 'zebre',
    label: 'Le Zèbre',
    description:
      "Vous trottez avec vos rayures parfaitement dessinées, changeant parfois de direction sans prévenir. Votre allure énergique et imprévisible attire les regards et provoque toujours un petit rire discret chez ceux qui vous suivent.",
  },
  {
    id: 'crocodile',
    label: 'Le Crocodile',
    description:
      "Vous glissez silencieusement, votre corps long et écailleux presque collé au sol. Votre large bouche entrouverte laisse entrevoir un sourire malicieux, et on a l'impression que vous pourriez surprendre tout le monde à tout moment.",
  },
  {
    id: 'autruche',
    label: "L'Autruche",
    description:
      "Vous avancez avec votre corps rond et vos longues pattes puissantes. Votre cou bouge dans tous les sens, et vos départs soudains pour courir ou vous arrêter font toujours sourire ceux qui observent votre trajectoire.",
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
  const text = String(raw).trim();
  if (!text) return null;
  const key = normalizeText(text);
  if (!key) return null;
  const direct = AVENTURE_SAUVAGE_PAWNS.find((p) => normalizeText(p.id) === key);
  if (direct) return direct.id;
  const byLabel = AVENTURE_SAUVAGE_PAWNS.find((p) => normalizeText(p.label) === key);
  return byLabel ? byLabel.id : null;
};
