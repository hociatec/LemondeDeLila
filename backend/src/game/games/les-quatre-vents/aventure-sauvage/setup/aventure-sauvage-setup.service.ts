import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type {
  AventureSauvageCard,
  AventureSauvageMetadata,
  AventureSauvageTile,
} from '../model/aventure-sauvage-state.entity';

@Injectable()
export class AventureSauvageSetupService {
  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = Array.isArray(baseState.players) ? baseState.players : [];
    const positions: Record<number, number> = {};
    for (const p of players) {
      positions[p.id] = 0;
    }

    const tiles = buildTiles();

    const metaBase: AventureSauvageMetadata = {
      tiles,
      positions,
      statuses: { skipTurn: {} },
      decks: {
        animal: defaultAnimalDeck(),
        patte: defaultPatteDeck(),
        discardAnimal: [],
        discardPatte: [],
      },
      winnerId: null,
    };

    return {
      ...baseState,
      phase: 'playing',
      pending: null,
      metadata: { ...(baseState.metadata ?? {}), ...metaBase },
    };
  }
}

function buildTiles(): AventureSauvageTile[] {
  // 30 cases (0..29). Arrivée sur la case 30 (index 29).
  const types: Array<'neutral' | 'animal' | 'patte'> = [
    'neutral',
    'neutral',
    'animal',
    'neutral',
    'patte',
    'animal',
    'neutral',
    'animal',
    'patte',
    'animal',
    'neutral',
    'animal',
    'patte',
    'neutral',
    'animal',
    'patte',
    'animal',
    'neutral',
    'animal',
    'patte',
    'neutral',
    'animal',
    'patte',
    'animal',
    'neutral',
    'animal',
    'patte',
    'animal',
    'patte',
  ];

  const tiles: AventureSauvageTile[] = [];
  for (let i = 0; i < 29; i += 1) {
    const type = types[i] ?? 'neutral';
    const label =
      type === 'animal'
        ? 'Animal rigolo'
        : type === 'patte'
          ? 'Coup de patte'
          : `Case ${i + 1}`;
    tiles.push({ type, label });
  }
  tiles.push({ type: 'finish', label: 'Arrivée - La mare' });
  return tiles;
}

function defaultAnimalDeck(): AventureSauvageCard[] {
  const deck: AventureSauvageCard[] = [
    { id: 1, deck: 'animal', text: 'Hyène : avancez de 2 cases.', moveDelta: 2 },
    { id: 2, deck: 'animal', text: 'Hippopotame : reculez d’1 case.', moveDelta: -1 },
    { id: 3, deck: 'animal', text: 'Impala : avancez de 3 cases.', moveDelta: 3 },
    { id: 4, deck: 'animal', text: 'Suricate : relancez le dé.', reroll: true },
    { id: 5, deck: 'animal', text: 'Flamant rose : restez sur place.' },
    { id: 6, deck: 'animal', text: 'Guépard : avancez d’1 case.', moveDelta: 1 },
    { id: 7, deck: 'animal', text: 'Buffle : avancez d’1 case.', moveDelta: 1 },
    { id: 8, deck: 'animal', text: 'Serpent : avancez de 2 cases.', moveDelta: 2 },
    { id: 9, deck: 'animal', text: 'Calao : avancez d’1 case.', moveDelta: 1 },
    { id: 10, deck: 'animal', text: 'Babouin : passez un tour.', skipTurns: 1 },
    { id: 11, deck: 'animal', text: 'Tisserin : avancez de 2 cases.', moveDelta: 2 },
    { id: 12, deck: 'animal', text: 'Musique : avancez de 3 cases.', moveDelta: 3 },
    { id: 13, deck: 'animal', text: 'Phacochère : avancez d’1 case.', moveDelta: 1 },
    { id: 14, deck: 'animal', text: 'Gecko : avancez d’1 case.', moveDelta: 1 },
    { id: 15, deck: 'animal', text: 'Pangolin : avancez d’1 case.', moveDelta: 1 },
    { id: 16, deck: 'animal', text: 'Marabout : avancez de 2 cases.', moveDelta: 2 },
    { id: 17, deck: 'animal', text: 'Grenouille : reculez d’1 case puis avancez d’1 case.' },
    { id: 18, deck: 'animal', text: 'Mangouste : avancez d’1 case.', moveDelta: 1 },
    { id: 19, deck: 'animal', text: 'Rhinocéros : avancez de 3 cases.', moveDelta: 3 },
    { id: 20, deck: 'animal', text: 'Arbre : restez sur place.' },
  ];
  return deck;
}

function defaultPatteDeck(): AventureSauvageCard[] {
  const deck: AventureSauvageCard[] = [
    { id: 1, deck: 'patte', text: 'Civette : passez un tour.', skipTurns: 1 },
    { id: 2, deck: 'patte', text: 'Pluie : reculez d’1 case.', moveDelta: -1 },
    { id: 3, deck: 'patte', text: 'Nid : passez un tour.', skipTurns: 1 },
    { id: 4, deck: 'patte', text: 'Scorpion : reculez d’1 case.', moveDelta: -1 },
    { id: 5, deck: 'patte', text: 'Fourmilier : restez sur place.' },
    { id: 6, deck: 'patte', text: 'Baobab : passez un tour.', skipTurns: 1 },
    { id: 7, deck: 'patte', text: 'Manguier : passez un tour.', skipTurns: 1 },
    { id: 8, deck: 'patte', text: 'Feuilles : perdez un tour.', skipTurns: 1 },
    { id: 9, deck: 'patte', text: 'Caméléon : passez un tour.', skipTurns: 1 },
    { id: 10, deck: 'patte', text: 'Perroquet : reculez d’1 case.', moveDelta: -1 },
  ];
  return deck;
}

