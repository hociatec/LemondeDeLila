import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import {
  BANDE_A_BANANE_CARD_BY_ID,
  BandeABananeCardDefinition,
  BandeABananeMonkeySpecies,
} from '../model/la-bande-a-banane-cards';
import type { BandeABananeMetadata } from '../model/la-bande-a-banane-state.entity';
import { normalizeActionType, normalizeLowerActionType } from '../../../../actions/action-service.helper';
import { isStartedState } from '../../../../rulebook/rulebook-guard.helper';

export type BandeABananeActionPayload = {
  cardId?: string | null;
  targetPlayerId?: number | null;
  cardToGiveId?: string | null;
  species?: BandeABananeMonkeySpecies | null;
};

type ValidActionType = 'play_card' | 'pass';

function getMeta(state: GameStateEntity): BandeABananeMetadata {
  return (state.metadata ?? {}) as BandeABananeMetadata;
}

function getPlayerHand(meta: BandeABananeMetadata, playerId: number): string[] {
  return Array.isArray(meta.hands?.[playerId]) ? meta.hands[playerId] : [];
}

function getPlayerSpeciesSet(
  meta: BandeABananeMetadata,
  playerId: number,
): Set<BandeABananeMonkeySpecies> {
  const troops = Array.isArray(meta.troops?.[playerId]) ? meta.troops[playerId] : [];
  return new Set(troops.map((entry) => entry.species));
}

function getMissingSpecies(
  meta: BandeABananeMetadata,
  playerId: number,
): BandeABananeMonkeySpecies[] {
  const allSpecies: BandeABananeMonkeySpecies[] = [
    'capucin',
    'mandrill',
    'gibbon',
    'babouin',
    'macaque',
  ];
  const owned = getPlayerSpeciesSet(meta, playerId);
  return allSpecies.filter((species) => !owned.has(species));
}

function getOpponentIds(state: GameStateEntity, playerId: number): number[] {
  return (Array.isArray(state.players) ? state.players : [])
    .filter((player) => player?.id != null && player.id !== playerId)
    .map((player) => player!.id);
}

function playerHasCard(meta: BandeABananeMetadata, playerId: number, cardId: string): boolean {
  return getPlayerHand(meta, playerId).includes(cardId);
}

function playerHasSpecies(
  meta: BandeABananeMetadata,
  playerId: number,
  species?: BandeABananeMonkeySpecies,
): boolean {
  if (!species) return false;
  return getPlayerSpeciesSet(meta, playerId).has(species);
}

function opponentHasCards(meta: BandeABananeMetadata, targetId: number): boolean {
  return getPlayerHand(meta, targetId).length > 0;
}

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];
  const current = state.turn?.currentPlayerId ?? null;
  if (current !== playerId) return [];
  const meta = getMeta(state);
  const hand = getPlayerHand(meta, playerId);
  const opponents = getOpponentIds(state, playerId);
  const available: GameSingleActionDto[] = [
    { type: 'pass', payload: {} },
  ];

  for (const cardId of hand) {
    const definition = BANDE_A_BANANE_CARD_BY_ID[cardId];
    if (!definition) continue;

    if (definition.type === 'monkey') {
      if (definition.species && playerHasSpecies(meta, playerId, definition.species)) {
        continue;
      }
      available.push({ type: 'play_card', payload: { cardId } });
      continue;
    }

    if (definition.type === 'joker') {
      const missing = getMissingSpecies(meta, playerId);
      if (!missing.length) continue;
      for (const species of missing) {
        available.push({
          type: 'play_card',
          payload: {
            cardId,
            species,
          },
        });
      }
      continue;
    }

    if (definition.type === 'action') {
      if (definition.action === 'vol-de-banane') {
        for (const targetId of opponents) {
          if (!opponentHasCards(meta, targetId)) continue;
          available.push({
            type: 'play_card',
            payload: {
              cardId,
              targetPlayerId: targetId,
            },
          });
        }
        continue;
      }

      if (definition.action === 'cris-de-la-jungle') {
        const candidates = hand.filter((id) => id !== cardId);
        if (!candidates.length) continue;
        for (const targetId of opponents) {
          if (!opponentHasCards(meta, targetId)) continue;
          for (const giveId of candidates) {
            available.push({
              type: 'play_card',
              payload: {
                cardId,
                targetPlayerId: targetId,
                cardToGiveId: giveId,
              },
            });
          }
        }
        continue;
      }

      if (definition.action === 'grimpeur-fou') {
        available.push({ type: 'play_card', payload: { cardId } });
        continue;
      }
    }

    if (definition.type === 'trap') {
      available.push({ type: 'play_card', payload: { cardId } });
    }
  }

  return available;
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const type = normalizeActionType(action);
  const payload = (action?.payload ?? {}) as BandeABananeActionPayload;
  if (type !== 'play_card' && type !== 'pass') {
    throw new Error(`Action inconnue : ${type}`);
  }
  if (actorId == null) {
    throw new Error('Acteur requis.');
  }
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') {
    throw new Error('La partie n\'est pas commencée.');
  }
  const current = state.turn?.currentPlayerId ?? null;
  if (current !== actorId) {
    throw new Error('Ce n\'est pas votre tour.');
  }

  if (type === 'pass') {
    return { type: 'pass', payload: {} };
  }

  const cardId = String(payload.cardId ?? '').trim();
  if (!cardId) {
    throw new Error('Carte manquante.');
  }

  const meta = getMeta(state);
  if (!playerHasCard(meta, actorId, cardId)) {
    throw new Error('Vous ne possédez pas cette carte.');
  }

  const definition = BANDE_A_BANANE_CARD_BY_ID[cardId];
  if (!definition) {
    throw new Error('Carte invalide.');
  }

  if (definition.type === 'monkey') {
    if (tileUsed(definition.species, meta, actorId)) {
      throw new Error('Vous avez déjà cette espèce.');
    }
    return { type: 'play_card', payload };
  }

  if (definition.type === 'joker') {
    const species = payload.species;
    if (!species) {
      throw new Error('Choisissez une espèce pour le joker.');
    }
    if (tileUsed(species, meta, actorId)) {
      throw new Error('Cette espèce est déjà dans votre troupe.');
    }
    return { type: 'play_card', payload };
  }

  if (definition.type === 'action') {
    return validateActionCard(state, definition, payload, actorId);
  }

  if (definition.type === 'trap') {
    return { type: 'play_card', payload };
  }

  return { type: 'play_card', payload };
}

function tileUsed(
  species: BandeABananeMonkeySpecies | undefined,
  meta: BandeABananeMetadata,
  playerId: number,
): boolean {
  if (!species) return false;
  return playerHasSpecies(meta, playerId, species);
}

function validateActionCard(
  state: GameStateEntity,
  card: BandeABananeCardDefinition,
  payload: BandeABananeActionPayload,
  actorId: number,
): GameSingleActionDto {
  const meta = getMeta(state);
  const opponents = getOpponentIds(state, actorId);
  if (card.action === 'vol-de-banane') {
    const targetId = payload.targetPlayerId;
    if (targetId == null) {
      throw new Error('Choisissez une cible pour voler.');
    }
    if (targetId === actorId) {
      throw new Error('Impossible de vous voler vous-même.');
    }
    if (!opponents.includes(targetId)) {
      throw new Error('Cible invalide.');
    }
    if (!opponentHasCards(meta, targetId)) {
      throw new Error('La cible n\'a pas de cartes à voler.');
    }
    return { type: 'play_card', payload };
  }

  if (card.action === 'cris-de-la-jungle') {
    const targetId = payload.targetPlayerId;
    if (targetId == null) {
      throw new Error('Choisissez une cible pour échanger.');
    }
    if (targetId === actorId) {
      throw new Error('Impossible de s\'échanger avec soi-même.');
    }
    if (!opponents.includes(targetId)) {
      throw new Error('Cible invalide.');
    }
    if (!opponentHasCards(meta, targetId)) {
      throw new Error('La cible n\'a pas de cartes à échanger.');
    }
    const giveCardId = String(payload.cardToGiveId ?? '').trim();
    if (!giveCardId) {
      throw new Error('Choisissez une carte à donner.');
    }
    if (giveCardId === card.id) {
      throw new Error('Vous ne pouvez pas donner la carte d\'action.');
    }
    if (!playerHasCard(meta, actorId, giveCardId)) {
      throw new Error('Vous ne possédez pas cette carte à donner.');
    }
    return { type: 'play_card', payload };
  }

  if (card.action === 'grimpeur-fou') {
    return { type: 'play_card', payload };
  }

  return { type: 'play_card', payload };
}



