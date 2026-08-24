import type { GameStateEntity } from '../../../../../application/models/game-state.model';

import { getSafePlayers } from '../../../../../application/helpers/setup-service.helper';
import { loadV1Content } from '../../../../../application/helpers/content-loader.helper';
import { GameCoreService } from '../../../../../application/services/game-core.service';
import { GameContentLoaderService } from '../../../../../application/services/game-content-loader.service';
import { SetupFlowService } from '../../../../../application/services/setup-flow.service';
import {
  FOULEES_FAMILY_PACKS,
  FOULEES_FAMILY_PENDING_LABEL,
  toFouleesFamilyChoice,
} from '../../definitions/family.definition';
import type {
  FouleesFantastiquesColor,
  FouleesFantastiquesMetadata,
  FouleesFantastiquesPawnState,
  FouleesFantastiquesTile,
} from '../../model/foulees-fantastiques-state.model';
import type { FouleesFantastiquesBoardJsonV1 } from '../../model/foulees-fantastiques-content.model';

export class FouleesFantastiquesSetupService {
  constructor(
    private readonly core: GameCoreService,
    private readonly contentLoader: GameContentLoaderService,
    private readonly setupFlow: SetupFlowService,
  ) {}

  private loadBoard(): FouleesFantastiquesBoardJsonV1 {
    return loadV1Content<FouleesFantastiquesBoardJsonV1>(this.contentLoader, {
      gameType: 'foulees-fantastiques',
      baseDir: __dirname,
      filename: 'board.json',
      arrayField: 'tiles',
      minItems: 1,
      extraValidators: [
        this.contentLoader.validators.positiveNumber('trackLength'),
        this.contentLoader.validators.positiveNumber('homeLength'),
      ],
    });
  }

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = getSafePlayers(baseState);
    const board = this.loadBoard();
    const trackLength = Number(board.trackLength);
    const homeLength = Number(board.homeLength);

    const pawnsByPlayer: Record<number, FouleesFantastiquesPawnState[]> = {};
    const colorsByPlayer: Record<number, FouleesFantastiquesColor> = {};
    const familyByPlayer: Record<number, string> = {};
    const habitatByPlayer: Record<number, string> = {};
    const pawnNamesByPlayer: Record<number, string[]> = {};
    const offsets: Record<number, number> = {};

    // 2 joueurs => opposÃƒÂ©s (0 et 20). Jusqu'ÃƒÂ  4 joueurs supportÃƒÂ©s.
    const half = Math.floor(trackLength / 2);
    const quarter = Math.floor(trackLength / 4);
    const threeQuarter = Math.floor((trackLength * 3) / 4);
    const offsetTable = [0, half, quarter, threeQuarter] as const;
    const colorTable: FouleesFantastiquesColor[] = [
      'Rouge',
      'Bleu',
      'Vert',
      'Jaune',
    ];

    players.forEach((p, idx) => {
      pawnsByPlayer[p.id] = Array.from({ length: 4 }).map((_, pawnIndex) => ({
        pawnIndex,
        progress: -1,
      }));
      colorsByPlayer[p.id] = colorTable[idx] ?? 'Rouge';
      offsets[p.id] = offsetTable[idx] ?? (idx * 10) % trackLength;
    });

    const tiles: FouleesFantastiquesTile[] = Array.isArray(board.tiles)
      ? board.tiles.map((t, i) => ({
          id: String(t?.id ?? `c${i}`),
          type: 'normal' as const,
          label:
            typeof t?.label === 'string' && t.label.trim()
              ? t.label.trim()
              : i === 0
                ? 'DÃƒÂ©part'
                : `Case ${i + 1}`,
        }))
      : [];

    const safeTiles =
      Array.isArray(board.safeTiles) && board.safeTiles.length > 0
        ? board.safeTiles
            .map((v) => (typeof v === 'number' ? v : Number(v)))
            .filter((v) => Number.isFinite(v))
            .map((v) => Math.max(0, Math.min(trackLength - 1, v)))
        : [];

    const safeFromOffsets = players
      .map((p) => offsets[p.id])
      .filter((x) => typeof x === 'number');
    const mergedSafeTiles = Array.from(
      new Set([...safeTiles, ...safeFromOffsets]),
    );

    const meta: FouleesFantastiquesMetadata = {
      tiles,
      trackLength,
      homeLength,
      pawnsByPlayer,
      colorsByPlayer,
      // Choix au dÃƒÂ©marrage: rempli par action `choose_family`.
      familyIdByPlayer: {},
      familyByPlayer,
      habitatByPlayer,
      pawnNamesByPlayer,
      offsets,
      safeTiles: mergedSafeTiles,
      positions: {},
      laps: {},
      statuses: { skipTurn: {} },
      winnerId: null,
    };

    const hydrated: GameStateEntity = {
      ...baseState,
      phase: 'setup',
      lastRoll: null,
      pending: null,
      metadata: { ...(baseState.metadata ?? {}), ...meta },
    };

    const withBoard = this.recomputeBoardView(hydrated);

    const currentId = withBoard.turn?.currentPlayerId ?? players[0]?.id ?? null;
    if (currentId == null) {
      return withBoard;
    }

    // PremiÃƒÂ¨re ÃƒÂ©tape: choix de la famille d'animaux.
    const familyChoices = FOULEES_FAMILY_PACKS.map(toFouleesFamilyChoice);

    const withPending = {
      ...withBoard,
      pending: this.setupFlow.createSequentialChoicePending({
        players,
        startPlayerId: currentId,
        isAssigned: () => false,
        pendingType: 'choose_family',
        choices: familyChoices,
        labelForPlayer: () => FOULEES_FAMILY_PENDING_LABEL,
        dataBuilder: (choices) => ({
          familyIds: choices.map((c) => c.id),
        }),
      })?.pending,
    };
    const currentName =
      players.find((p) => p?.id === currentId)?.username?.trim() ||
      `Joueur ${currentId}`;
    return this.core.appendLog(
      withPending,
      `${currentName} doit choisir une famille d'animaux.`,
    );
  }

  recomputeBoardView(state: GameStateEntity): GameStateEntity {
    const meta = (state.metadata ?? {}) as FouleesFantastiquesMetadata;
    const players = Array.isArray(state.players) ? state.players : [];
    const positions: Record<number, number> = {};
    const laps: Record<number, number> = {};

    for (const p of players) {
      const pawns = Array.isArray(meta.pawnsByPlayer?.[p.id])
        ? meta.pawnsByPlayer[p.id]
        : [];
      const onTrack = pawns
        .map((pawn) =>
          typeof pawn?.progress === 'number' ? pawn.progress : -1,
        )
        .filter((prog: number) => prog >= 0 && prog < meta.trackLength);

      if (onTrack.length) {
        const bestProg = Math.max(...onTrack);
        const offset = meta.offsets?.[p.id] ?? 0;
        positions[p.id] = (offset + bestProg) % meta.trackLength;
      }

      laps[p.id] = 0;
    }

    const updated: FouleesFantastiquesMetadata = { ...meta, positions, laps };
    return { ...state, metadata: { ...(state.metadata ?? {}), ...updated } };
  }
}





