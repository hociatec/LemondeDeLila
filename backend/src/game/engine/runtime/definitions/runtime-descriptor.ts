import type { GameRuntimeDescriptor } from '../../../core/application/ports/game-runtime.port';
import type { CompiledGameDefinition } from '../contracts/compiled-game-definition';
import type { GameActionMap } from '../contracts/author-rule-contracts';
import { GAME_CONFIGURE_ACTION } from '../configuration/configuration-kit';
import type { GameShortcutHint } from '../../../shortcuts/public-api';
import { contentManifest } from '../content/game-content';

export function describeGameDefinition<
  TState extends object,
  TActions extends GameActionMap<TState>,
>(definition: CompiledGameDefinition<TState, TActions>): GameRuntimeDescriptor {
  return {
    id: definition.id,
    name: definition.displayName,
    category: definition.category,
    stateVersion: definition.stateVersion,
    rulesVersion: definition.rulesVersion,
    ...(definition.subcategory ? { subcategory: definition.subcategory } : {}),
    players: { ...definition.players },
    ...(definition.presentation
      ? { presentation: structuredClone(definition.presentation) }
      : {}),
    actions: describeActions(definition),
    choices: Object.entries(definition.choices ?? {}).map(([id, choice]) => ({
      id,
      input: choice.input.describe(),
      ...(choice.documentation ? { documentation: choice.documentation } : {}),
      ui: deriveUi(id, choice.input.describe(), choice.ui),
    })),
    phases: Object.entries(definition.phases ?? {}).map(([id, phase]) => ({
      id,
      actions: [...(phase.actions ?? [])],
      visibility: phase.visibility ?? 'public',
      ...(phase.next ? { next: phase.next } : {}),
      ...(phase.timeout ? { timeoutMs: phase.timeout.afterMs } : {}),
    })),
    components: (definition.components ?? []).map((component) => ({
      component: component.component,
      ...('id' in component && typeof component.id === 'string'
        ? { id: component.id }
        : {}),
    })),
    patterns: definition.plan.patterns.map((pattern) => ({
      id: pattern.id,
      mechanics: [...pattern.mechanics],
    })),
    ...describeConfiguration(definition),
    ...(definition.content
      ? {
          content: {
            ...contentManifest(definition.content),
          },
        }
      : {}),
  };
}

function describeActions<
  TState extends object,
  TActions extends GameActionMap<TState>,
>(definition: CompiledGameDefinition<TState, TActions>) {
  const configurationAction = definition.config
    ? [
        {
          type: GAME_CONFIGURE_ACTION,
          input: describeInput(
            definition.config.input.describe(),
            definition.config.defaults,
          ),
          documentation: 'Configure la partie avant son démarrage.',
          ui: {
            label: definition.config.ui?.submitLabel ?? 'Configurer',
            control: 'form' as const,
          },
        },
      ]
    : [];
  return [
    ...configurationAction,
    ...Object.entries(definition.actions).map(([type, action]) => ({
      type,
      input: describeInput(action.input.describe()),
      ...(action.documentation ? { documentation: action.documentation } : {}),
      ...(action.enumerateCandidateInputs ? { paginatedCandidates: true } : {}),
      ui: deriveUi(type, action.input.describe(), action.ui),
    })),
  ];
}

function describeConfiguration<
  TState extends object,
  TActions extends GameActionMap<TState>,
>(definition: CompiledGameDefinition<TState, TActions>) {
  if (!definition.config) return {};
  return {
    configuration: {
      actionType: GAME_CONFIGURE_ACTION,
      input: describeInput(
        definition.config.input.describe(),
        definition.config.defaults,
      ),
      defaults: structuredClone(
        definition.config.defaults as Record<string, unknown>,
      ),
      permission: definition.config.permission ?? 'owner',
      ...(definition.config.phase ? { phase: definition.config.phase } : {}),
      ...(definition.config.ui
        ? { ui: structuredClone(definition.config.ui) }
        : {}),
    },
  };
}

export function deriveGameShortcuts<
  TState extends object,
  TActions extends GameActionMap<TState>,
>(definition: CompiledGameDefinition<TState, TActions>): GameShortcutHint[] {
  const shortcuts: GameShortcutHint[] = [];
  const usedKeys = new Set<string>();
  for (const declared of structuredClone(definition.shortcuts ?? [])) {
    const shortcut = safeGameplayShortcut(declared);
    if (!shortcut) continue;
    const normalizedKey = shortcut.key.trim().toUpperCase();
    if (usedKeys.has(normalizedKey)) continue;
    shortcuts.push(shortcut);
    usedKeys.add(normalizedKey);
  }
  const actionTypes = new Set(
    shortcuts.flatMap((shortcut) =>
      shortcut.type === 'action' ? [shortcut.actionType] : [],
    ),
  );
  for (const [type, action] of Object.entries(definition.actions)) {
    if (actionTypes.has(type)) continue;
    const key =
      action.ui?.shortcut ?? inferShortcut(type, action.input.describe());
    if (!key) continue;
    const shortcut = safeGameplayShortcut({
      key,
      type: 'action',
      actionType: type,
      ...(action.ui?.label ? { label: action.ui.label } : {}),
    });
    if (!shortcut) continue;
    const normalizedKey = shortcut.key.trim().toUpperCase();
    if (usedKeys.has(normalizedKey)) continue;
    shortcuts.push(shortcut);
    usedKeys.add(normalizedKey);
    actionTypes.add(type);
  }
  return shortcuts;
}

function safeGameplayShortcut(
  shortcut: GameShortcutHint,
): GameShortcutHint | null {
  const key = shortcut.key.trim().toUpperCase();
  // Enter is handled by the client's dedicated dice control. It must not be
  // exposed as a server shortcut or compete with form validation.
  if (key === 'ENTER' || key === 'RETURN') return null;
  if (shortcut.type === 'action' && isDiceRollAction(shortcut.actionType)) {
    return null;
  }
  return shortcut;
}

function deriveUi(
  id: string,
  input: Record<string, unknown>,
  explicit:
    | {
        label?: string;
        icon?: string;
        intent?: 'primary' | 'secondary' | 'danger' | 'success';
        control?: 'button' | 'card' | 'player' | 'pawn' | 'number' | 'form';
        shortcut?: string;
      }
    | undefined,
) {
  return {
    label: explicit?.label ?? humanize(id),
    control: explicit?.control ?? inferControl(input),
    ...(explicit?.icon ? { icon: explicit.icon } : {}),
    ...(explicit?.intent ? { intent: explicit.intent } : {}),
    ...(explicit?.shortcut ? { shortcut: explicit.shortcut } : {}),
  };
}

function describeInput(
  input: Record<string, unknown>,
  initialValue?: unknown,
): Record<string, unknown> {
  const described = structuredClone(input);
  const properties = asRecord(described.properties);
  const initialValues = asRecord(initialValue);
  if (Object.keys(properties).length > 0) {
    described.properties = Object.fromEntries(
      Object.entries(properties).map(([key, raw]) => {
        const field = describeInput(asRecord(raw), initialValues[key]);
        return [key, { label: humanize(key), ...field }];
      }),
    );
  }
  const items = asRecord(described.items);
  if (Object.keys(items).length > 0) described.items = describeInput(items);
  if (
    typeof initialValue === 'string' ||
    typeof initialValue === 'number' ||
    typeof initialValue === 'boolean'
  ) {
    described.initialText = String(initialValue);
  }
  return described;
}

function inferControl(
  input: Record<string, unknown>,
): 'button' | 'card' | 'player' | 'pawn' | 'number' | 'form' {
  if (input.type !== 'object')
    return input.type === 'number' ? 'number' : 'form';
  const properties = asRecord(input.properties);
  const fields = Object.values(properties).map(asRecord);
  if (fields.length === 0) return 'button';
  if (fields.length !== 1) return 'form';
  const field = fields[0];
  if (field.format === 'card-id') return 'card';
  if (field.format === 'player-id') return 'player';
  if (field.format === 'pawn-id') return 'pawn';
  if (field.type === 'number') return 'number';
  return 'form';
}

function inferShortcut(
  actionType: string,
  input: Record<string, unknown>,
): string | null {
  if (inferControl(input) !== 'button') return null;
  const normalized = actionType.toLowerCase().replaceAll('_', '-');
  if (isDiceRollAction(normalized)) return null;
  if (normalized.includes('draw') || normalized.includes('pick'))
    return 'Space';
  if (
    normalized.includes('pass') ||
    normalized.includes('end-turn') ||
    normalized.includes('confirm')
  ) {
    return null;
  }
  return null;
}

function isDiceRollAction(actionType: string): boolean {
  const normalized = actionType.trim().toLowerCase().replaceAll('_', '-');
  return normalized.includes('roll') || normalized.includes('launch');
}

function humanize(value: string): string {
  const normalized = value.replace(/[._-]+/g, ' ').trim();
  return normalized
    ? normalized.charAt(0).toLocaleUpperCase('fr') + normalized.slice(1)
    : 'Action';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
