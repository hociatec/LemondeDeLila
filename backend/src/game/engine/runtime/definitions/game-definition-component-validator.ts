import type { GameEffectInstruction } from '../contracts/effect-ir';
import {
  assertEffectInstructions,
  type GameEffectValidationReferences,
} from '../effects/game-effect-definition-validator';
import type { GameComponentDefinition } from './component-kit';
import { assertPlayerValueId } from '../kits/numeric-invariants';
import {
  requireReference,
  requireTrackPosition,
} from '../effects/game-effect-reference-validator';
import { assertStaticEffectReferences } from './static-effect-references';
import { assertComponentCatalog } from './component-catalog-validation';
import type {
  DefinitionToValidate,
  ValidationFailure,
} from '../contracts/definition-validation';

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
  handDecks: Map<string, string>;
  cardIdsByDeck: Map<string, ReadonlySet<string>>;
  trackSpaces: Map<string, number>;
  resources: Set<string>;
};

export function assertComponentDefinitions(
  definition: DefinitionToValidate,
  fail: ValidationFailure,
): void {
  const references = indexComponents(definition, fail);
  for (const component of definition.components ?? []) {
    assertComponent(component, references, fail);
  }
  assertStaticEffectReferences(
    definition.content?.data,
    'content',
    references,
    fail,
  );
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
    handDecks: new Map(),
    cardIdsByDeck: new Map(),
    trackSpaces: new Map(),
    resources: new Set([
      ...Object.keys(definition.initialization?.resources ?? {}),
      ...(definition.resourceIds ?? []),
    ]),
  };
  if ((definition.components?.length ?? 0) > 512) {
    fail('components', 'trop de composants');
  }
  assertResourceIds(references.resources, fail);
  const keys = new Set<string>();
  for (const component of definition.components ?? []) {
    const id = 'id' in component ? component.id : undefined;
    if (
      typeof id !== 'string' ||
      id.length > 128 ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(id) ||
      ['constructor', 'prototype', '__proto__'].includes(id)
    ) {
      fail(
        'components',
        `identifiant manquant pour « ${component.component} »`,
      );
    }
    const key = `${component.component}:${id}`;
    if (keys.has(key)) fail('components', `composant dupliqué « ${key} »`);
    keys.add(key);
    assertComponentCatalog(component, fail);
    if (component.component === 'cards.deck') {
      references.decks.set(component.id, component);
      references.cardIdsByDeck.set(
        component.id,
        new Set(
          component.cards.flatMap((card) => {
            const cardId =
              typeof card === 'object' && card != null && 'id' in card
                ? card.id
                : card;
            return typeof cardId === 'string' ? [cardId] : [];
          }),
        ),
      );
    }
    if (component.component === 'cards.hands') {
      references.hands.set(component.id, component);
      references.handDecks.set(component.id, component.deck);
    }
    if (component.component === 'inventory.set')
      references.inventories.set(component.id, component);
    if (component.component === 'movement.track') {
      references.tracks.add(component.id);
      references.trackSpaces.set(component.id, component.spaces);
    }
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
    for (const [field, value] of Object.entries({
      finish: component.finish,
      homeFrom: component.homeStretch?.from,
      homeTo: component.homeStretch?.to,
    })) {
      if (value != null)
        requireTrackPosition(
          references,
          component.id,
          value,
          `components.${component.id}.${field}`,
          fail,
        );
    }
    for (const [position, instructions] of Object.entries(
      component.landingEffects ?? {},
    )) {
      requireTrackPosition(
        references,
        component.id,
        Number(position),
        `components.${component.id}.landingEffects.${position}`,
        fail,
      );
      assertEffectInstructions(
        instructions,
        `components.${component.id}.landingEffects.${position}`,
        references,
        fail,
      );
    }
  }
  if (component.component === 'collection.view')
    assertCollectionResources(component, references, fail);
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

function assertCollectionResources(
  component: Extract<GameComponentDefinition, { component: 'collection.view' }>,
  references: ComponentReferences,
  fail: ValidationFailure,
): void {
  const sources = [
    ...Object.values(component.groups),
    ...(component.total && component.total !== 'sum' ? [component.total] : []),
  ];
  for (const source of sources) {
    if (source.kind === 'resource')
      requireReference(
        references.resources,
        source.id,
        `components.${component.id}.resources`,
        fail,
      );
    if (source.kind === 'inventory')
      requireReference(
        references.inventories,
        source.id,
        `components.${component.id}.inventories`,
        fail,
      );
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
  const cardIds =
    references.cardIdsByDeck.get(component.deck) ?? new Set<string>();
  for (const [setId, setCardIds] of Object.entries(component.sets)) {
    if (setCardIds.length === 0)
      fail(`components.${component.id}.sets.${setId}`, 'famille vide');
    if (setCardIds.some((cardId) => !cardIds.has(cardId))) {
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
  requireReference(
    references.resources,
    component.currency,
    `components.${component.id}.currency`,
    fail,
  );
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

function assertResourceIds(
  resources: ReadonlySet<string>,
  fail: ValidationFailure,
): void {
  if (resources.size > 512) {
    fail('resourceIds', 'trop de ressources');
  }
  for (const id of resources) {
    try {
      assertPlayerValueId(id);
    } catch {
      fail('resourceIds', `identifiant de ressource invalide « ${id} »`);
    }
    if (
      !/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(id) ||
      ['constructor', 'prototype', '__proto__'].includes(id)
    )
      fail('resourceIds', `identifiant de ressource invalide « ${id} »`);
  }
}
