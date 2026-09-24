import { authoringProperty } from '../contracts/authoring-diagnostics';
import { authoringPathOf } from '../contracts/authoring-origin';
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
import { assertHandDeckDefinitions } from '../cards/hand-deck-definitions';
import { assertTrigger } from '../automation/trigger-validation';
import { isEngineEventType } from '../events/engine-event-registry';
import { validateEffectCondition } from '../effects/game-effect-reference-validator';
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
  handAcceptedDecks: Map<string, ReadonlySet<string>>;
  cardIdsByDeck: Map<string, ReadonlySet<string>>;
  trackSpaces: Map<string, number>;
  resources: Set<string>;
  inventoryItems: Map<string, ReadonlySet<string> | null>;
  ownershipAssets: Map<string, ReadonlySet<string>>;
  zoneDecks: Map<string, string>;
};

export function assertComponentDefinitions(
  definition: DefinitionToValidate,
  fail: ValidationFailure,
): void {
  const references = indexComponents(definition, fail);
  const triggerIds = new Set<string>();
  if ((definition.triggers?.length ?? 0) > 128)
    fail('triggers', 'too many triggers');
  for (const [index, trigger] of (definition.triggers ?? []).entries()) {
    const path = `triggers[${index}]`;
    assertTrigger(trigger);
    if (triggerIds.has(trigger.id)) fail(`${path}.id`, 'duplicate trigger');
    triggerIds.add(trigger.id);
    if (
      trigger.on.kind === 'action' &&
      !Object.hasOwn(definition.actions, trigger.on.type) &&
      !['choice.resolve', 'choice.timeout', 'game.configure'].includes(
        trigger.on.type,
      )
    )
      fail(`${path}.on.type`, 'unknown action');
    if (
      trigger.on.kind === 'event' &&
      !isEngineEventType(trigger.on.type) &&
      !definition.events?.some((event) => event.type === trigger.on.type)
    )
      fail(`${path}.on.type`, 'unknown event');
    if (trigger.condition)
      validateEffectCondition(
        trigger.condition,
        `${path}.condition`,
        references,
        fail,
      );
    assertEffectInstructions(
      trigger.effects,
      `${path}.effects`,
      references,
      fail,
    );
  }
  // Validate authored effects before their copies inside generated components.
  // The content retains the exact extension/deck/card origin.
  assertStaticEffectReferences(
    definition.content?.data,
    'content',
    references,
    fail,
  );
  for (const [index, component] of (definition.components ?? []).entries()) {
    assertComponent(
      component,
      references,
      componentFailure(component, index, fail),
    );
  }
}

export function indexComponents(
  definition: DefinitionToValidate,
  fail: ValidationFailure,
): ComponentReferences {
  const references: ComponentReferences = {
    phases: definition.phases
      ? new Set(Object.keys(definition.phases))
      : undefined,
    zoneDecks: new Map(),
    decks: new Map(),
    hands: new Map(),
    inventories: new Map(),
    tracks: new Set(),
    diceSets: new Set(),
    effects: definition.effects,
    handDecks: new Map(),
    handAcceptedDecks: new Map(),
    cardIdsByDeck: new Map(),
    trackSpaces: new Map(),
    inventoryItems: new Map(),
    ownershipAssets: new Map(),
    resources: new Set([
      ...Object.keys(definition.initialization?.resources ?? {}),
      ...(definition.resourceIds ?? []),
      ...resourcePoolIds(definition),
    ]),
  };
  if ((definition.components?.length ?? 0) > 512) {
    fail('components', 'trop de composants');
  }
  assertResourceIds(definition, references.resources, fail);
  const keys = new Set<string>();
  for (const [index, component] of (definition.components ?? []).entries()) {
    const id = 'id' in component ? component.id : undefined;
    if (
      typeof id !== 'string' ||
      id.length > 128 ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(id) ||
      ['constructor', 'prototype', '__proto__'].includes(id)
    ) {
      fail(
        `components[${index}].id`,
        `identifiant manquant pour « ${component.component} »`,
      );
    }
    const key = `${component.component}:${id}`;
    if (keys.has(key))
      fail(`components[${index}].id`, `composant dupliqué « ${key} »`);
    keys.add(key);
    assertComponentCatalog(component, componentFailure(component, index, fail));
    if (component.component === 'cards.deck') {
      references.decks.set(component.id, component);
      references.cardIdsByDeck.set(component.id, indexDeckCardIds(component));
    }
    if (component.component === 'cards.hands') {
      indexHand(component, references);
    }
    if (component.component === 'inventory.set') {
      references.inventories.set(component.id, component);
      references.inventoryItems.set(
        component.id,
        component.items ? new Set(component.items) : null,
      );
    }
    if (component.component === 'ownership.registry')
      references.ownershipAssets.set(component.id, new Set(component.assets));
    if (component.component === 'cards.zone')
      references.zoneDecks.set(component.id, component.deck);
    if (component.component === 'movement.track') {
      references.tracks.add(component.id);
      references.trackSpaces.set(component.id, component.spaces);
    }
    if (component.component === 'dice.set')
      references.diceSets.add(component.id);
  }
  return references;
}

function resourcePoolIds(definition: DefinitionToValidate): string[] {
  return (definition.components ?? [])
    .filter((component) => component.component === 'resource.pool')
    .map((component) => component.id);
}

function indexHand(
  component: HandDefinition,
  references: ComponentReferences,
): void {
  references.hands.set(component.id, component);
  references.handDecks.set(component.id, component.deck);
  references.handAcceptedDecks.set(
    component.id,
    new Set([component.deck, ...(component.acceptedDecks ?? [])]),
  );
}

function indexDeckCardIds(deck: DeckDefinition): ReadonlySet<string> {
  return new Set(
    (deck.catalog ?? deck.cards).flatMap((card) => {
      const id =
        typeof card === 'object' && card != null && 'id' in card
          ? card.id
          : card;
      return typeof id === 'string' ? [id] : [];
    }),
  );
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
  if (component.component === 'cards.hands') {
    try {
      assertHandDeckDefinitions(component, references.decks);
    } catch (error) {
      const path = authoringPathOf(error);
      if (path === undefined || !(error instanceof Error)) throw error;
      fail(`components.${component.id}.${path}`, error.message);
    }
  }
  if (component.component === 'economy.market')
    assertMarket(component, references, fail);
  if (component.component === 'movement.track') {
    for (const [field, value] of Object.entries({
      finish: component.finish,
      'homeStretch.from': component.homeStretch?.from,
      'homeStretch.to': component.homeStretch?.to,
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
  for (const field of ['cards', 'catalog'] as const) {
    for (const [index, card] of (component[field] ?? []).entries()) {
      if (
        card != null &&
        typeof card === 'object' &&
        'effects' in card &&
        Array.isArray(card.effects)
      ) {
        assertEffectInstructions(
          card.effects as readonly GameEffectInstruction[],
          `components.${component.id}.${field}[${index}].effects`,
          references,
          fail,
        );
      }
    }
  }
}

function assertCollectionResources(
  component: Extract<GameComponentDefinition, { component: 'collection.view' }>,
  references: ComponentReferences,
  fail: ValidationFailure,
): void {
  const sources = [
    ...Object.entries(component.groups).map(
      ([key, source]) =>
        [
          authoringProperty(`components.${component.id}.groups`, key),
          source,
        ] as const,
    ),
    ...(component.total && component.total !== 'sum'
      ? [[`components.${component.id}.total`, component.total] as const]
      : []),
  ];
  for (const [path, source] of sources) {
    if (source.kind === 'resource')
      requireReference(references.resources, source.id, `${path}.id`, fail);
    if (source.kind === 'inventory')
      requireReference(references.inventories, source.id, `${path}.id`, fail);
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
      `components.${component.id}.hand`,
      `la main « ${component.hand} » dépend de la pioche « ${hand.deck} »`,
    );
  }
  const cardIds =
    references.cardIdsByDeck.get(component.deck) ?? new Set<string>();
  for (const [setId, setCardIds] of Object.entries(component.sets)) {
    const path = authoringProperty(`components.${component.id}.sets`, setId);
    if (setCardIds.length === 0) fail(path, 'famille vide');
    for (const [index, cardId] of setCardIds.entries())
      if (!cardIds.has(cardId))
        fail(`${path}[${index}]`, 'référence une carte absente de la pioche');
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
  for (const id of Object.keys(component.prices))
    if (inventory?.items && !inventory.items.includes(id))
      fail(
        authoringProperty(`components.${component.id}.prices`, id),
        'référence un objet absent de l’inventaire',
      );
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
  definition: DefinitionToValidate,
  resources: ReadonlySet<string>,
  fail: ValidationFailure,
): void {
  if (resources.size > 512) {
    fail('resourceIds', 'trop de ressources');
  }
  const entries = [
    ...Object.keys(definition.initialization?.resources ?? {}).map(
      (id) => [authoringProperty('initialization.resources', id), id] as const,
    ),
    ...(definition.resourceIds ?? []).map(
      (id, index) => [`resourceIds[${index}]`, id] as const,
    ),
  ];
  for (const [path, id] of entries) {
    try {
      assertPlayerValueId(id);
    } catch {
      fail(path, `identifiant de ressource invalide « ${id} »`);
    }
    if (
      !/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(id) ||
      ['constructor', 'prototype', '__proto__'].includes(id)
    )
      fail(path, `identifiant de ressource invalide « ${id} »`);
  }
}

function componentFailure(
  component: GameComponentDefinition,
  index: number,
  fail: ValidationFailure,
): ValidationFailure {
  const prefix = `components.${component.id}`;
  return (path, reason) =>
    fail(
      path === prefix ||
        path.startsWith(`${prefix}.`) ||
        path.startsWith(`${prefix}[`)
        ? `components[${index}]${path.slice(prefix.length)}`
        : path,
      reason,
    );
}
