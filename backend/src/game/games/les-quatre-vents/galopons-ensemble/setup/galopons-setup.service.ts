import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
import { loadV1Content } from '../../../../setup/content-loader.helper';
import type {
  GaloponsBoardJsonV1,
  GaloponsCardsJsonV1,
  GaloponsMetadata,
} from '../model/galopons.types';

const GALOPONS_PAWNS = [
  {
    id: 'shetland',
    name: 'Le Poney Shetland',
    description:
      "Petit, trapu et plein de malice, ce poney ressemble à une peluche... jusqu'au moment où il décide que c'est lui qui commande. Ne vous fiez pas à sa taille : c'est un véritable tracteur miniature avec un sacré caractère !",
  },
  {
    id: 'mustang',
    name: 'Le Mustang',
    description: `Ce cheval des grands espaces adore galoper librement comme s'il tournait dans un vieux western. Rapide, malin et un peu rebelle, il a toujours l'air de dire : "Attrape-moi si tu peux !"`,
  },
  {
    id: 'percheron',
    name: 'Le Percheron',
    description:
      "Grand, puissant et impressionnant, ce cheval pourrait presque tirer une maison... ou au moins la caravane du voisin. Malgré sa taille de géant, il est souvent d'un calme olympien.",
  },
  {
    id: 'camargue',
    name: 'Le Camargue',
    description: `Toujours prêt à patauger dans les marais, ce cheval blanc semble aimer l'eau presque autant qu'un canard. Rustique et courageux, il suit les taureaux avec l'air de dire : "Même pas peur !"`,
  },
];

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return '';
}

@Injectable()
export class GaloponsSetupService {
  constructor(
    private readonly contentLoader: GameContentLoaderService,
    private readonly random: RandomService,
    private readonly setupFlow: SetupFlowService,
  ) {}

  hydrateInitialState(base: GameStateEntity): GameStateEntity {
    const board = this.loadBoard();
    const cards = this.loadCards();
    const pawns = this.loadPawns();

    const players = Array.isArray(base.players) ? base.players : [];
    const positions: Record<number, number> = {};
    const apples: Record<number, number> = {};
    for (const player of players) {
      positions[player.id] = 0;
      apples[player.id] = 0;
    }

    const seedMeta = asRecord(base.metadata);
    const pawnByPlayerId = this.normalizePawnAssignments(
      players,
      seedMeta.pawnByPlayerId,
      pawns,
    );
    const setupStarterId =
      typeof seedMeta.setupStarterId === 'number'
        ? seedMeta.setupStarterId
        : (players[0]?.id ?? null);
    const shuffled = this.random.shuffle(seedMeta, cards.cards ?? []);

    const meta: GaloponsMetadata = {
      tiles: board.tiles ?? [],
      positions,
      apples,
      pawns,
      pawnByPlayerId,
      setupStarterId,
      ious: {},
      statuses: { skipTurn: {} },
      decks: { cards: shuffled.values, discard: [] },
      pendingContext: null,
      finish: {
        triggered: false,
        starterId: null,
        pendingIds: [],
        bonusGiven: false,
      },
      winnerId: null,
    };

    const hydratedPlayers = players.map((player) => {
      const pawnId = pawnByPlayerId[player.id];
      if (!pawnId) return player;
      const pawn = pawns.find((entry) => entry.id === pawnId);
      if (!pawn) return player;
      return {
        ...player,
        pawn: pawn.id,
        pawnLabel: pawn.name,
      };
    });

    const initial: GameStateEntity = {
      ...base,
      players: hydratedPlayers,
      phase: 'playing',
      pending: null,
      turn: {
        ...(base.turn ?? { currentPlayerId: setupStarterId, direction: 1 }),
        currentPlayerId: setupStarterId,
        direction: 1,
      },
      metadata: {
        ...(base.metadata ?? {}),
        ...shuffled.meta,
        ...meta,
      },
    };

    const pendingInfo = this.setupFlow.createSequentialPawnPending({
      players: hydratedPlayers,
      startPlayerId: setupStarterId,
      isAssigned: (playerId) => Boolean(pawnByPlayerId[playerId]),
      pawns: pawns
        .filter((pawn) => !Object.values(pawnByPlayerId).includes(pawn.id))
        .map((pawn) => ({
          id: pawn.id,
          label: pawn.name,
          description: pawn.description,
        })),
      choiceLabelBuilder: (pawn) =>
        toText(pawn.description).length > 0
          ? `${toText(pawn.label)}: ${toText(pawn.description)}`
          : toText(pawn.label),
      pawnDataMapper: (choice) => ({
        id: toText(choice.id),
        label: toText(choice.label),
        description: toText(choice.description),
      }),
    });
    if (!pendingInfo) {
      return initial;
    }

    return {
      ...initial,
      pending: pendingInfo.pending,
      turnIndex: pendingInfo.turnIndex,
      turn: {
        ...(initial.turn ?? {
          currentPlayerId: pendingInfo.playerId,
          direction: 1,
        }),
        currentPlayerId: pendingInfo.playerId,
        direction: 1,
      },
    };
  }

  private loadBoard(): GaloponsBoardJsonV1 {
    return loadV1Content<GaloponsBoardJsonV1>(this.contentLoader, {
      gameType: 'galopons-ensemble',
      baseDir: __dirname,
      filename: 'board.json',
      arrayField: 'tiles',
      minItems: 1,
    });
  }

  private loadCards(): GaloponsCardsJsonV1 {
    return loadV1Content<GaloponsCardsJsonV1>(this.contentLoader, {
      gameType: 'galopons-ensemble',
      baseDir: __dirname,
      filename: 'cards.json',
      arrayField: 'cards',
      minItems: 1,
    });
  }

  private loadPawns() {
    return GALOPONS_PAWNS.map((pawn) => ({ ...pawn }));
  }

  private normalizePawnAssignments(
    players: Array<{ id: number }>,
    raw: unknown,
    pawns: Array<{ id: string; name: string }>,
  ): Record<number, string> {
    const byId: Record<number, string> = {};
    if (!raw || typeof raw !== 'object') return byId;

    const rawRecord = asRecord(raw);
    const used = new Set<string>();
    const choices = pawns.map((pawn) => ({
      id: pawn.id,
      label: pawn.name,
    }));

    for (const player of players) {
      const resolved = this.setupFlow.resolveChoice(
        rawRecord[String(player.id)],
        choices,
      );
      const pawnId = toText(resolved?.id);
      if (!pawnId || used.has(pawnId)) continue;
      used.add(pawnId);
      byId[player.id] = pawnId;
    }

    return byId;
  }
}
