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
export class PetitChevauxSetupService {
  constructor(
    private readonly core: GameCoreService,
    private readonly contentLoader: GameContentLoaderService,
  ) {}

  private loadBoard(): PetitChevauxBoardJsonV1 {
    return this.contentLoader.loadContent<PetitChevauxBoardJsonV1>({
      gameType: 'petit-chevaux',
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

    const families = [
      {
        family: 'Equidés',
        habitat: 'écurie',
        pawns: ['Alkhal-téké', 'Andalou', 'Frison', 'Pur-sang'],
      },
      {
        family: 'Primates',
        habitat: 'primaterie',
        pawns: ['Douc', 'Gibbon', 'Mandrill', 'Sakis'],
      },
      {
        family: 'Oiseaux',
        habitat: 'volière',
        pawns: ['Cygne', 'Héron', 'Paon', 'Perroquet'],
      },
      {
        family: 'Poissons',
        habitat: 'aquarium',
        pawns: ['Anthias', 'Discus', 'Mandarin', 'Mérou'],
      },
    ] as const;

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
      const pack = families[idx % families.length];
      familyByPlayer[p.id] = pack.family;
      habitatByPlayer[p.id] = pack.habitat;
      pawnNamesByPlayer[p.id] = [...pack.pawns];
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
      phase: 'turn',
      lastRoll: null,
      pending: null,
      metadata: { ...(baseState.metadata ?? {}), ...meta },
    };

    let next = this.recomputeBoardView(hydrated);
    for (const p of players) {
      const color = colorsByPlayer[p.id];
      const family = familyByPlayer[p.id];
      const habitat = habitatByPlayer[p.id];
      const pawns = pawnNamesByPlayer[p.id];
      next = this.core.appendLog(
        next,
        `${p.username} reçoit les pions ${color}. Famille des ${family} (${habitat}) : ${pawns.join(', ')}.`,
      );
    }
    return next;
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
