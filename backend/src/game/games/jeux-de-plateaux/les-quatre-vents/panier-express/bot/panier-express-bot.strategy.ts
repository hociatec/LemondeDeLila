import { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import { GameSingleActionDto } from '../../../../../engine/dto/game-action.dto';
import { PanierExpressMetadata, PanierExpressTile } from '../entities/panier-express-state.entity';
import { PendingRequirementService } from '../../../../../modules/effects/services/pending-requirement.service';

/**
 * Stratégie bot extraite pour Panier Express.
 * Le bot :
 * - répond automatiquement aux quiz si c'est son tour,
 * - tente un échange quand il est sur une tuile échange,
 * - sinon lance le dé.
 */
export function suggestPanierExpressBotActions(
  state: GameStateEntity,
  botPlayerId: number,
  pendingQuiz: PendingRequirementService<{ question: string; answer: string }>,
): GameSingleActionDto[] {
  const meta = state.metadata as PanierExpressMetadata;
  const current = state.turn?.currentPlayerId ?? null;
  if (current !== botPlayerId) {
    return [];
  }

  // Réponse automatique à un quiz en attente
  if (pendingQuiz.get(botPlayerId)) {
    return [
      {
        type: 'answer_quiz',
        payload: { playerId: botPlayerId, correct: true },
      },
    ];
  }

  const position = meta.positions[botPlayerId] ?? 0;
  const tile = meta.tiles[position];

  if (tile?.type === 'exchange') {
    const options = buildExchangeActions(state, botPlayerId);
    if (options.length > 0) {
      return [options[Math.floor(Math.random() * options.length)]];
    }
  }

  return [{ type: 'roll' }];
}

function buildExchangeActions(state: GameStateEntity, playerId: number): GameSingleActionDto[] {
  const players = state.players ?? [];
  const current = players.find((p) => p.id === playerId);
  if (!current || (current.inventory?.length ?? 0) === 0) return [{ type: 'roll' }];

  const actions: GameSingleActionDto[] = [];
  players.forEach((p) => {
    if (p.id === playerId) return;
    const targetInv = p.inventory ?? [];
    if (targetInv.length === 0) return;
    current.inventory?.forEach((give) => {
      targetInv.forEach((take) => {
        actions.push({
          type: 'exchange_with',
          payload: {
            playerId,
            targetPlayerId: p.id,
            give,
            take,
          },
        });
      });
    });
  });
  return actions.length > 0 ? actions : [{ type: 'roll' }];
}
