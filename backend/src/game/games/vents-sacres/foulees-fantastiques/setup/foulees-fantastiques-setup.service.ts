import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import type {
  PetitChevauxColor,
  PetitChevauxMetadata,
  PetitChevauxPawnState,
  PetitChevauxTile,
} from '../model/petit-chevaux-state.entity';
import type { PetitChevauxBoardJsonV1 } from '../model/petit-chevaux-content.entity';

@Injectable()
export class FouleesFantastiquesSetupService {
  constructor(
    private readonly core: GameCoreService,
    private readonly contentLoader: GameContentLoaderService,
  ) {}

  private loadBoard(): PetitChevauxBoardJsonV1 {
    return this.contentLoader.loadContent<PetitChevauxBoardJsonV1>({
      gameType: 'foulees-fantastiques',
      baseDir: __dirname,
      filename: 'board.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('tiles', 1),
        this.contentLoader.validators.positiveNumber('trackLength'),
        this.contentLoader.validators.positiveNumber('homeLength'),
      ],
    });
  }

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = Array.isArray(baseState.players) ? baseState.players : [];
    const board = this.loadBoard();
    const trackLength = Number(board.trackLength);
    const homeLength = Number(board.homeLength);

    const pawnsByPlayer: Record<number, PetitChevauxPawnState[]> = {};
    const colorsByPlayer: Record<number, PetitChevauxColor> = {};
    const familyByPlayer: Record<number, string> = {};
    const habitatByPlayer: Record<number, string> = {};
    const pawnNamesByPlayer: Record<number, string[]> = {};
    const offsets: Record<number, number> = {};

    // 2 joueurs => opposés (0 et 20). Jusqu'à 4 joueurs supportés.
    const half = Math.floor(trackLength / 2);
    const quarter = Math.floor(trackLength / 4);
    const threeQuarter = Math.floor((trackLength * 3) / 4);
    const offsetTable = [0, half, quarter, threeQuarter] as const;
    const colorTable: PetitChevauxColor[] = ['Rouge', 'Bleu', 'Vert', 'Jaune'];

    players.forEach((p, idx) => {
      pawnsByPlayer[p.id] = Array.from({ length: 4 }).map((_, pawnIndex) => ({
        pawnIndex,
        progress: -1,
      }));
      colorsByPlayer[p.id] = colorTable[idx] ?? 'Rouge';
      offsets[p.id] = offsetTable[idx] ?? (idx * 10) % trackLength;
    });

    const tiles: PetitChevauxTile[] = Array.isArray(board.tiles)
      ? board.tiles.map((t, i) => ({
          id: String(t?.id ?? `c${i}`),
          type: 'normal' as const,
          label:
            typeof t?.label === 'string' && t.label.trim()
              ? t.label.trim()
              : i === 0
                ? 'Départ'
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

    const meta: PetitChevauxMetadata = {
      tiles,
      trackLength,
      homeLength,
      pawnsByPlayer,
      colorsByPlayer,
      // Choix au démarrage: rempli par action `choose_family`.
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

    const currentId =
      withBoard.turn?.currentPlayerId ??
      players[0]?.id ??
      null;
    if (currentId == null) {
      return withBoard;
    }

    // Première étape: choix de la famille d'animaux.
    const families = [
      { id: 'equides', label: "Famille des Equidés (écurie)" },
      { id: 'primates', label: 'Famille des Primates (primaterie)' },
      { id: 'oiseaux', label: 'Famille des Oiseaux (volière)' },
      { id: 'poissons', label: 'Famille des Poissons (aquarium)' },
    ];

    return {
      ...withBoard,
      pending: {
        type: 'choose_family',
        playerId: currentId,
        blocking: true,
        label: "Choisissez la famille d'animaux que vous souhaitez jouer, puis Entrée.",
        choices: families.map((f) => f.label),
        data: { familyIds: families.map((f) => f.id) },
      } as any,
    };
  }

  recomputeBoardView(state: GameStateEntity): GameStateEntity {
    const meta = (state.metadata ?? {}) as any as PetitChevauxMetadata;
    const players = Array.isArray(state.players) ? state.players : [];
    const positions: Record<number, number> = {};
    const laps: Record<number, number> = {};

    for (const p of players) {
      const pawns = Array.isArray(meta.pawnsByPlayer?.[p.id])
        ? meta.pawnsByPlayer[p.id]
        : [];
      const onTrack = pawns
        .map((pawn: any) =>
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

    const updated: PetitChevauxMetadata = { ...meta, positions, laps };
    return { ...state, metadata: { ...(state.metadata ?? {}), ...updated } };
  }
}
