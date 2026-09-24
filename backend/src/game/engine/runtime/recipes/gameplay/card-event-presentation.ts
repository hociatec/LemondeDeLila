import type { CardValue } from '../../cards/cards-kit';
import type { GameEffectInstruction } from '../../contracts/effect-ir';

type PublicCard = Record<string, unknown> & {
  effects?: readonly GameEffectInstruction[];
};

/** Public narration for a card whose rule is resolved immediately. */
export function resolvedCardEventData(
  value: CardValue,
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const card = value as PublicCard;
  const text = firstText(
    card.label,
    card.title,
    card.name,
    card.text,
    card.prompt,
    card.id,
  );
  const explicitEffect = firstText(
    card.effectDescription,
    card.effect,
    card.description,
  );
  const split = splitCardText(text);
  const narrative = firstText(card.text);
  const effectDescription =
    explicitEffect ||
    split.effect ||
    (narrative && narrative !== text
      ? narrative
      : describeEffects(card.effects ?? []));
  return {
    revealed: true,
    ...(split.label ? { cardLabel: split.label } : {}),
    ...(effectDescription ? { effectDescription } : {}),
  };
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim())
      return value.trim().slice(0, 2_000);
    if (typeof value === 'number' && Number.isFinite(value))
      return String(value);
  }
  return '';
}

function splitCardText(text: string): { label: string; effect: string } {
  const separator = text.indexOf(':');
  if (separator < 0) return { label: text, effect: '' };
  return {
    label: text.slice(0, separator).trim(),
    effect: text.slice(separator + 1).trim(),
  };
}

function describeEffects(effects: readonly GameEffectInstruction[]): string {
  const descriptions = effects
    .map(describeEffect)
    .filter((value): value is string => Boolean(value));
  return descriptions.length > 0
    ? descriptions.join(' Puis ')
    : 'Aucun effet supplémentaire';
}

function describeEffect(effect: GameEffectInstruction): string {
  switch (effect.kind) {
    case 'move':
      return movementDescription(effect.spaces);
    case 'move-to':
      return `Allez à la case ${effect.position + 1}`;
    case 'draw-cards':
      return `Piochez ${countLabel(effect.count, 'carte')}`;
    case 'discard-random':
    case 'discard-random-inventory':
      return `Défaussez ${countLabel(effect.count, 'élément')} au hasard`;
    case 'gain-resource':
      return typeof effect.amount === 'number'
        ? `Gagnez ${effect.amount} ${humanize(effect.resource)}`
        : `Gagnez des ${humanize(effect.resource)} selon la situation`;
    case 'lose-resource':
      return typeof effect.amount === 'number'
        ? `Perdez ${effect.amount} ${humanize(effect.resource)}`
        : `Perdez des ${humanize(effect.resource)} selon la situation`;
    case 'gain-score':
      return typeof effect.amount === 'number'
        ? `Gagnez ${countLabel(effect.amount, 'point')}`
        : 'Modifiez votre score selon la situation';
    case 'skip-turn':
      return `Passez ${countLabel(effect.count ?? 1, 'tour')}`;
    case 'extra-turn':
      return (effect.count ?? 1) === 1
        ? 'Rejouez immédiatement'
        : `Rejouez ${effect.count} fois`;
    case 'reverse-turn-order':
      return 'Inversez le sens du jeu';
    case 'swap-positions':
      return 'Échangez les positions indiquées';
    case 'swap-hands':
      return 'Échangez les mains indiquées';
    case 'swap-inventories':
      return 'Échangez les inventaires indiqués';
    case 'steal-card':
      return `Volez ${countLabel(effect.count ?? 1, 'carte')}`;
    case 'choose-player':
      return 'Choisissez un joueur';
    case 'roll-dice':
      return 'Lancez le dé';
    case 'eliminate-player':
      return 'Éliminez le joueur indiqué';
    case 'conditional':
      return 'Appliquez l’effet correspondant à la condition';
    case 'reaction':
      return 'Choisissez une réaction';
    case 'custom':
    case 'complete-turn':
    case 'start-round':
    case 'end-round':
      return '';
    default:
      return `Appliquez l’effet ${humanize(effect.kind)}`;
  }
}

function movementDescription(spaces: number): string {
  if (spaces === 0) return 'Restez sur votre case';
  const distance = countLabel(Math.abs(spaces), 'case');
  return spaces > 0 ? `Avancez de ${distance}` : `Reculez de ${distance}`;
}

function countLabel(count: number, singular: string): string {
  return `${count} ${singular}${Math.abs(count) === 1 ? '' : 's'}`;
}

function humanize(value: string): string {
  return value.replace(/[-_.]+/gu, ' ').trim();
}
