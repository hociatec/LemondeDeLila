import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import type { GameEffectInstruction } from '../effects/effects-kit';
import {
  assertEffectInstructions,
  type GameEffectValidationReferences,
} from '../effects/game-effect-definition-validator';
import type { GameComponentDefinition } from './component-kit';

type DefinitionToValidate = {
  id: string;
  players: { min: number; max: number };
  actions: Readonly<
    Record<string, { enumerateInputs?: unknown; validateInput?: unknown }>
  >;
  phases?: Readonly<
    Record<
      string,
      {
        actions?: readonly string[];
        next?: string;
        visibility?: string;
        timeout?: { afterMs?: number; action?: { type?: string } };
      }
    >
  >;
  initialPhase?: string;
  components?: readonly GameComponentDefinition[];
  automatic?: readonly { id: string; priority?: number }[];
  choices?: Readonly<Record<string, { input?: unknown }>>;
  events?: readonly {
    type: string;
    data?: { parse?: unknown };
    emit?: unknown;
  }[];
  stateVersion?: number;
  contentVersion?: string;
  rulesVersion?: string;
  migrations?: readonly { from: number; to: number }[];
  config?: {
    input?: { parse?: unknown; describe?: unknown };
    defaults?: unknown;
    phase?: string;
    permission?: string;
  };
  content?: {
    kind?: unknown;
    gameId?: unknown;
    version?: unknown;
    data?: unknown;
  };
  effects?: Readonly<Record<string, { input?: unknown; resolveRaw?: unknown }>>;
};

type ValidationFailure = (path: string, reason: string) => never;
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

export function assertGameDefinition(definition: DefinitionToValidate): void {
  const fail: ValidationFailure = (path, reason) => {
    throw new GameConfigurationError(
      `Définition ${definition.id || '<sans identifiant>'}.${path}: ${reason}`,
    );
  };
  assertMetadata(definition, fail);
  const actionNames = assertActionsAndEvents(definition, fail);
  const phaseNames = assertPhases(definition, actionNames, fail);
  const references = indexComponents(definition, fail);
  assertComponents(definition.components ?? [], references, fail);
  assertAuxiliaryDefinitions(definition, fail);
  assertConfiguration(definition, phaseNames, fail);
  assertMigrations(definition, fail);
}

function assertMetadata(
  definition: DefinitionToValidate,
  fail: ValidationFailure,
): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(definition.id))
    fail('id', 'format invalide');
  if (
    !Number.isInteger(definition.players.min) ||
    !Number.isInteger(definition.players.max) ||
    definition.players.min < 1 ||
    definition.players.max < definition.players.min
  )
    fail('players', 'limites de joueurs invalides');
  if (
    definition.stateVersion != null &&
    (!Number.isInteger(definition.stateVersion) || definition.stateVersion < 1)
  ) {
    fail('stateVersion', 'un entier positif est requis');
  }
  for (const [path, version] of [
    ['rulesVersion', definition.rulesVersion],
    ['contentVersion', definition.contentVersion],
  ] as const) {
    if (version != null && version.trim().length === 0)
      fail(path, 'la version ne peut pas être vide');
  }
  const content = definition.content;
  if (!content) return;
  if (content.kind !== 'lila.game-content')
    fail('content.kind', 'utiliser defineGameContent');
  if (content.gameId !== definition.id) {
    fail(
      'content.gameId',
      `identifiant « ${String(content.gameId)} » différent du jeu`,
    );
  }
  if (
    typeof content.version !== 'string' ||
    content.version.trim().length === 0
  ) {
    fail('content.version', 'version de contenu requise');
  }
  if (
    content.data == null ||
    typeof content.data !== 'object' ||
    !Object.isFrozen(content) ||
    !Object.isFrozen(content.data)
  )
    fail('content', 'le contenu statique doit être immuable');
}

function assertActionsAndEvents(
  definition: DefinitionToValidate,
  fail: ValidationFailure,
): Set<string> {
  const names = new Set(Object.keys(definition.actions));
  if (names.size === 0) fail('actions', 'au moins une action est requise');
  assertEventDefinitions(definition.events ?? [], fail);
  for (const [name, action] of Object.entries(definition.actions)) {
    if (
      action.enumerateInputs != null &&
      typeof action.validateInput !== 'function'
    ) {
      fail(
        `actions.${name}.validate`,
        'une action énumérée doit déclarer une validation serveur',
      );
    }
  }
  return names;
}

function assertPhases(
  definition: DefinitionToValidate,
  actionNames: ReadonlySet<string>,
  fail: ValidationFailure,
): Set<string> {
  const names = new Set(Object.keys(definition.phases ?? {}));
  if (
    names.size > 0 &&
    definition.initialPhase &&
    !names.has(definition.initialPhase)
  ) {
    fail('initialPhase', `phase inconnue « ${definition.initialPhase} »`);
  }
  for (const [name, phase] of Object.entries(definition.phases ?? {})) {
    for (const action of phase.actions ?? []) {
      if (!actionNames.has(action))
        fail(`phases.${name}.actions`, `action inconnue « ${action} »`);
    }
    if (phase.next && !names.has(phase.next))
      fail(`phases.${name}.next`, `phase inconnue « ${phase.next} »`);
    if (
      phase.visibility != null &&
      !['public', 'hidden'].includes(phase.visibility)
    ) {
      fail(`phases.${name}.visibility`, 'visibilité inconnue');
    }
    if (!phase.timeout) continue;
    if (
      !Number.isFinite(phase.timeout.afterMs) ||
      Number(phase.timeout.afterMs) < 0
    ) {
      fail(`phases.${name}.timeout`, 'durée invalide');
    }
    const action = phase.timeout.action?.type;
    if (!action || !actionNames.has(action)) {
      fail(
        `phases.${name}.timeout.action`,
        `action inconnue « ${String(action)} »`,
      );
    }
  }
  return names;
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

function assertComponents(
  components: readonly GameComponentDefinition[],
  references: ComponentReferences,
  fail: ValidationFailure,
): void {
  for (const component of components) {
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
    if (component.component === 'cards.deck') {
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
      if (
        card != null &&
        typeof card === 'object' &&
        'id' in card &&
        typeof card.id === 'string'
      )
        return [card.id];
      return [];
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

function assertAuxiliaryDefinitions(
  definition: DefinitionToValidate,
  fail: ValidationFailure,
): void {
  const automaticIds = new Set<string>();
  for (const automatic of definition.automatic ?? []) {
    if (!automatic.id.trim())
      fail('automatic', 'identifiant de règle automatique vide');
    if (automaticIds.has(automatic.id))
      fail('automatic', `règle dupliquée « ${automatic.id} »`);
    if (automatic.priority != null && !Number.isFinite(automatic.priority)) {
      fail(
        `automatic.${automatic.id}.priority`,
        'la priorité doit être un nombre fini',
      );
    }
    automaticIds.add(automatic.id);
  }
  for (const [id, choice] of Object.entries(definition.choices ?? {})) {
    if (!choice.input || typeof choice.input !== 'object')
      fail(`choices.${id}.input`, 'un schéma de valeur est requis');
  }
  for (const [id, effect] of Object.entries(definition.effects ?? {})) {
    if (!id.trim()) fail('effects', 'identifiant d’effet vide');
    if (!effect.input || typeof effect.input !== 'object')
      fail(`effects.${id}.input`, 'un schéma de données est requis');
    if (typeof effect.resolveRaw !== 'function')
      fail(`effects.${id}.resolveRaw`, 'un resolver est requis');
  }
}

function assertConfiguration(
  definition: DefinitionToValidate,
  phaseNames: ReadonlySet<string>,
  fail: ValidationFailure,
): void {
  const config = definition.config;
  if (!config) return;
  if (
    typeof config.input?.parse !== 'function' ||
    typeof config.input.describe !== 'function'
  ) {
    fail('config.input', 'un schéma de configuration est requis');
  }
  if (
    config.defaults == null ||
    typeof config.defaults !== 'object' ||
    Array.isArray(config.defaults)
  ) {
    fail('config.defaults', 'un objet de valeurs par défaut est requis');
  }
  if (phaseNames.size > 0 && config.phase && !phaseNames.has(config.phase)) {
    fail('config.phase', `phase inconnue « ${config.phase} »`);
  }
  if (
    config.permission != null &&
    !['owner', 'any-player'].includes(config.permission)
  ) {
    fail('config.permission', 'permission inconnue');
  }
}

function assertMigrations(
  definition: DefinitionToValidate,
  fail: ValidationFailure,
): void {
  const target = definition.stateVersion ?? 1;
  const bySource = new Map<number, number>();
  for (const migration of definition.migrations ?? []) {
    if (
      !Number.isInteger(migration.from) ||
      !Number.isInteger(migration.to) ||
      migration.from < 1 ||
      migration.to <= migration.from ||
      migration.to > target
    )
      fail(
        'migrations',
        `transition invalide ${migration.from}→${migration.to}`,
      );
    if (bySource.has(migration.from))
      fail('migrations', `source dupliquée « ${migration.from} »`);
    bySource.set(migration.from, migration.to);
  }
  if (target <= 1) return;
  let cursor = 1;
  const visited = new Set<number>();
  while (cursor < target && !visited.has(cursor)) {
    visited.add(cursor);
    cursor = bySource.get(cursor) ?? 0;
  }
  if (cursor !== target)
    fail('migrations', `chaîne incomplète de 1 vers ${target}`);
}

function assertEventDefinitions(
  events: NonNullable<DefinitionToValidate['events']>,
  fail: ValidationFailure,
): void {
  const names = new Set<string>();
  for (const event of events) {
    if (!event.type.trim()) fail('events.type', 'identifiant vide');
    if (names.has(event.type))
      fail('events', `événement dupliqué « ${event.type} »`);
    if (
      typeof event.data?.parse !== 'function' ||
      typeof event.emit !== 'function'
    ) {
      fail(`events.${event.type}`, 'utiliser defineEvent');
    }
    names.add(event.type);
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
