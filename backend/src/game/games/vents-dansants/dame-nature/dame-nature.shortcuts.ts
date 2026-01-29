import type { GameShortcutsBuilder } from '../../../engine/shortcuts/game-shortcuts';
import type { DameNatureMetadata } from './model/dame-nature.model';
import {
  actionShortcut,
  concat,
  interfaceShortcut,
  when,
} from '../../../engine/shortcuts/shortcut-utils';

export const buildDameNatureShortcuts: GameShortcutsBuilder<
  DameNatureMetadata
> = (ctx) => {
  const { metadata, started, currentPlayerId } = ctx;
  const pendingAsk = metadata?.pendingAsk ?? null;
  const pendingQuiz = metadata?.pendingQuiz ?? null;
  const pendingRefill = metadata?.pendingRefill ?? null;
  const actionPlayerId =
    pendingAsk?.targetId ??
    pendingQuiz?.playerId ??
    pendingRefill?.playerId ??
    (typeof currentPlayerId === 'number' ? currentPlayerId : null);

  const base = [
    actionShortcut('D', 'ask_card'),
    interfaceShortcut('C', 'hand'),
    interfaceShortcut('F', 'books'),
  ];

  const startedShortcuts = [
    interfaceShortcut('P', 'score'),
    interfaceShortcut('S', 'pollution'),
  ];

  const askAnswerShortcuts = [
    actionShortcut('A', 'answer_ask_card_accept'),
    actionShortcut('R', 'answer_ask_card_refuse'),
  ];

  return concat(
    base,
    when(ctx, started, startedShortcuts),
    when(
      ctx,
      Boolean(
        pendingAsk &&
        actionPlayerId != null &&
        pendingAsk.targetId === actionPlayerId,
      ),
      askAnswerShortcuts,
    ),
  );
};
