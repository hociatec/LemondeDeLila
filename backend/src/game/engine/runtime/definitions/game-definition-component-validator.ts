import type { GameEffectInstruction } from '../effects/effects-kit';
import {
  assertEffectInstructions,
  type GameEffectValidationReferences,
} from '../effects/game-effect-definition-validator';
import type { GameComponentDefinition } from './component-kit';
import type {
  DefinitionToValidate,
  ValidationFailure,
} from './game-definition-validator';

type DeckDefinition = Extract<
  GameComponentDefinition,
  { component: 'cards.deck' }
>;
type HandDefinition = Extract<
  GameComponentDefinition,
  { component: 'cards.hands' }
>;
type InventoryDefinition = Extract<
  GameComponentDefinition,
  { component: 'inventory.set' }
>;
type ComponentReferences = Omit<
  GameEffectValidationReferences,
  'decks' | 'hands' | 'inventories' | 'tracks' | 'diceSets'
> & {
  decks: Map<string, DeckDefinition>;
  hands: Map<string, HandDefinition>;
  inventories: Map<string, InventoryDefinition>;
  tracks: Set<string>;
  diceSets: Set<string>;
};

export function assertComponentDefinitions(
  definition: DefinitionToValidate,
  fail: ValidationFailure,
): void {
  const references = indexComponents(definition, fail);
  for (const component of definition.components ?? []) {
    assertComponent(component, references, fail);
  }
}

function indexComponents(
  definition: DefinitionToValidate,
  fail: ValidationFailure,
): ComponentReferences {
  const references: ComponentReferences = {
    decks: new Map(),
    hands: new Map(),
    inventories: new Map(),
    tracks: new Set(),
    diceSets: new Set(),
    effects: definition.effects,
  };
  const keys = new Set<string>();
  for (const component of definition.components ?? []) {
    const id = 'id' in component ? component.id : undefined;
    if (typeof id !== 'string' || id.trim().length === 0) {
      fail(
        'components',
        `identifiant manquant pour « ${component.component} »`,
      );
    }
    const key = `${component.component}:${id}`;
    if (keys.has(key)) fail('components', `composant dupliqué « ${key} »`);
    keys.add(key);
    if (component.component === 'cards.deck')
      references.decks.set(component.id, component);
    if (component.component === 'cards.hands')
      references.hands.set(component.id, component);
    if (component.component === 'inventory.set')
      references.inventories.set(component.id, component);
    if (component.component === 'movement.track')
      references.tracks.add(component.id);
    if (component.component === 'dice.set')
      references.diceSets.add(component.id);
  }
  return references;
}

function assertComponent(
  component: GameComponentDefinition,
  references: ComponentReferences,
  fail: ValidationFailure,
): void {
  if (isCardContainer(component) && !references.decks.has(component.deck)) {
    fail(
      `components.${component.id}.deck`,
      `pioche inconnue « ${component.deck} »`,
    );
  }
  if (component.component === 'cards.sets')
    assertCardSets(component, references, fail);
  if (component.component === 'economy.market')
    assertMarket(component, references, fail);
  if (component.component === 'movement.track') {
    for (const [position, instructions] of Object.entries(
      component.landingEffects ?? {},
    )) {
      assertEffectInstructions(
        instructions,
        `components.${component.id}.landingEffects.${position}`,
        references,
        fail,
      );
    }
  }
  if (component.component !== 'cards.deck') return;
  for (const [index, card] of component.cards.entries()) {
    if (
      card != null &&
      typeof card === 'object' &&
      'effects' in card &&
      Array.isArray(card.effects)
    ) {
      assertEffectInstructions(
        card.effects as readonly GameEffectInstruction[],
        `components.${component.id}.cards.${index}.effects`,
        references,
        fail,
      );
    }
  }
}

function assertCardSets(
  component: Extract<GameComponentDefinition, { component: 'cards.sets' }>,
  references: ComponentReferences,
  fail: ValidationFailure,
): void {
  const hand = references.hands.get(component.hand);
  const deck = references.decks.get(component.deck);
  if (!hand)
    fail(
      `components.${component.id}.hand`,
      `main inconnue « ${component.hand} »`,
    );
  if (!deck)
    fail(
      `components.${component.id}.deck`,
      `pioche inconnue « ${component.deck} »`,
    );
  if (hand && hand.deck !== component.deck) {
    fail(
      `components.${component.id}`,
      `la main « ${component.hand} » dépend de la pioche « ${hand.deck} »`,
    );
  }
  const cardIds = new Set(
    (deck?.cards ?? []).flatMap((card) => {
      if (typeof card === 'string') return [card];
      return card != null &&
        typeof card === 'object' &&
        'id' in card &&
        typeof card.id === 'string'
        ? [card.id]
        : [];
    }),
  );
  for (const [setId, setCardIds] of Object.entries(component.sets)) {
    if (setCardIds.length === 0)
      fail(`components.${component.id}.sets.${setId}`, 'famille vide');
    if (cardIds.size > 0 && setCardIds.some((cardId) => !cardIds.has(cardId))) {
      fail(
        `components.${component.id}.sets.${setId}`,
        'référence une carte absente de la pioche',
      );
    }
  }
}

function assertMarket(
  component: Extract<GameComponentDefinition, { component: 'economy.market' }>,
  references: ComponentReferences,
  fail: ValidationFailure,
): void {
  const inventory = references.inventories.get(component.inventory);
  if (!inventory)
    fail(
      `components.${component.id}.inventory`,
      `inventaire inconnu « ${component.inventory} »`,
    );
  if (
    inventory?.items &&
    Object.keys(component.prices).some((id) => !inventory.items?.includes(id))
  ) {
    fail(
      `components.${component.id}.prices`,
      'référence un objet absent de l’inventaire',
    );
  }
}

function isCardContainer(
  component: GameComponentDefinition,
): component is Extract<
  GameComponentDefinition,
  { component: 'cards.hands' | 'cards.zone' }
> {
  return (
    component.component === 'cards.hands' ||
    component.component === 'cards.zone'
  );
}
