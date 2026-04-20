import type { GameStateWithActions } from '../dto/game-action.dto';
import { extractExtras, extractPanels, extractUi } from './game-engine-extras';

type CurrentPlayerView = {
  shoppingList?: unknown;
  basket?: unknown;
  inventory?: unknown;
  stable?: unknown;
  position?: unknown;
};

export function attachUiDescriptors(params: {
  state: GameStateWithActions;
  normalizeString: (value: unknown) => string;
}): GameStateWithActions {
  const { state, normalizeString } = params;

  // Les panneaux UI doivent être entièrement définis par les jeux via `extras.ui.panels`.
  // Le moteur n'infère plus de panneaux génériques (shopping, position, pollution, etc.).
  // Provide a generic "turn" panel derived from `turn.label` (no game rules).
  const turnLabel = String(state.turn?.label ?? '').trim();
  if (!turnLabel) return state;

  const extrasNow = extractExtras(state);
  const uiExistingNow = extractUi(extrasNow);
  const uiNow = uiExistingNow ? { ...uiExistingNow } : {};
  const panelsExistingNow = extractPanels(uiExistingNow);
  const panelsNow = panelsExistingNow ? { ...panelsExistingNow } : {};
  const existingTurn = panelsNow['turn'] as Record<string, unknown> | undefined;
  const existingTurnMessage =
    existingTurn && typeof existingTurn['message'] === 'string'
      ? existingTurn['message']
      : null;
  const hasTurnMessage =
    typeof existingTurnMessage === 'string' &&
    existingTurnMessage.trim().length > 0;

  if (!hasTurnMessage) {
    panelsNow['turn'] = {
      title: 'Tour',
      message: turnLabel.endsWith('.') ? turnLabel : `${turnLabel}.`,
    };
  }

  uiNow['panels'] = panelsNow;
  const stateWithTurnPanel: GameStateWithActions = {
    ...state,
    extras: {
      ...extrasNow,
      ui: uiNow,
    },
  };

  const extrasAfter = extractExtras(stateWithTurnPanel);
  const uiExisting = extractUi(extrasAfter);
  const ui = uiExisting ? { ...uiExisting } : {};
  const panelsExisting = extractPanels(uiExisting);
  const panels = panelsExisting ? { ...panelsExisting } : {};
  const hasGameDefinedPanels = Object.keys(panels).some((id) => id !== 'turn');
  const currentPlayerView =
    (extrasAfter['currentPlayerView'] as CurrentPlayerView | null) ?? null;
  const metadata =
    stateWithTurnPanel.metadata &&
    typeof stateWithTurnPanel.metadata === 'object'
      ? (stateWithTurnPanel.metadata as Record<string, unknown>)
      : {};
  const upsertPanel = (id: string, title: string, message: string) => {
    if (!id || !title || !message) return;

    const existing = panels[id] as Record<string, unknown> | undefined;
    const existingMessage =
      existing && typeof existing['message'] === 'string'
        ? existing['message']
        : null;
    const hasMessage =
      typeof existingMessage === 'string' && existingMessage.trim().length > 0;
    if (hasMessage) return;

    panels[id] = { title, message };
  };

  const buildListMessage = (title: string, itemsRaw: unknown) => {
    const items = Array.isArray(itemsRaw)
      ? itemsRaw.map((x) => normalizeString(x)).filter((x) => x)
      : [];

    if (items.length === 0) return `${title}: (vide)`;

    const max = 12;
    const shown = items.length > max ? items.slice(0, max) : items;
    const body = shown.join(', ');
    return items.length > max
      ? `${title}: ${body}, ... (+${items.length - max})`
      : `${title}: ${body}`;
  };

  const normalizeSentence = (text: unknown): string => {
    const t = normalizeString(text);
    if (!t) return '';
    return t.endsWith('.') ? t : `${t}.`;
  };

  const buildJoinedLinesMessage = (title: string, linesRaw: unknown) => {
    const lines = Array.isArray(linesRaw)
      ? linesRaw.map(normalizeSentence).filter((x) => x)
      : [];
    if (lines.length === 0) return `${title}: inconnue.`;
    return lines.join(' ');
  };

  if (
    !hasGameDefinedPanels &&
    currentPlayerView &&
    typeof currentPlayerView === 'object'
  ) {
    upsertPanel(
      'shopping',
      'Shopping list',
      buildListMessage('Shopping list', currentPlayerView.shoppingList),
    );
    upsertPanel(
      'basket',
      'Panier',
      buildListMessage('Panier', currentPlayerView.basket),
    );
    upsertPanel(
      'inventory',
      'Inventaire',
      buildListMessage('Inventaire', currentPlayerView.inventory),
    );
    upsertPanel(
      'stable',
      'Écurie',
      buildJoinedLinesMessage('Écurie', currentPlayerView.stable),
    );
    upsertPanel(
      'position',
      'Position',
      buildJoinedLinesMessage('Position', currentPlayerView.position),
    );
  }

  if (!hasGameDefinedPanels) {
    upsertPanel(
      'score',
      'Score',
      buildListMessage('Score', extrasAfter['score']),
    );
    upsertPanel('hand', 'Main', buildListMessage('Main', extrasAfter['hand']));
    upsertPanel(
      'books',
      'Familles',
      buildListMessage('Familles', extrasAfter['books']),
    );
  }

  const pollution =
    typeof metadata['pollution'] === 'number' ? metadata['pollution'] : null;
  const maxPollution =
    typeof metadata['maxPollution'] === 'number'
      ? metadata['maxPollution']
      : null;

  if (!hasGameDefinedPanels && (pollution !== null || maxPollution !== null)) {
    let message = 'Pollution: inconnue.';
    if (pollution !== null && maxPollution !== null)
      message = `Pollution: ${pollution}/${maxPollution}.`;
    else if (pollution !== null) message = `Pollution: ${pollution}.`;
    else if (maxPollution !== null) message = `Pollution max: ${maxPollution}.`;

    upsertPanel('pollution', 'Pollution', message);
  }

  ui['panels'] = panels;
  return {
    ...stateWithTurnPanel,
    extras: {
      ...extrasAfter,
      ui,
    },
  };
}
