import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import type { JeuOieCaseTextsJsonV1 } from '../model/jeu-oie-content.entity';
import type {
  JeuOieMetadata,
  JeuOiePawn,
  JeuOieTile,
} from '../model/jeu-oie-state.entity';

const JEU_OIE_PAWNS: JeuOiePawn[] = [
  { id: 'coq-rockeur', label: 'Coq rockeur', feminine: false },
  { id: 'vache-artistique', label: 'Vache artistique', feminine: true },
  { id: 'cochon-gourmand', label: 'Cochon gourmand', feminine: false },
  { id: 'poule-scientifique', label: 'Poule scientifique', feminine: true },
  { id: 'chevre-acrobate', label: 'Chevre acrobate', feminine: true },
  { id: 'marmotte-reveuse', label: 'Marmotte reveuse', feminine: true },
];

@Injectable()
export class JeuOieSetupService {
  constructor(
    private readonly core: GameCoreService,
    private readonly contentLoader: GameContentLoaderService,
  ) {}

  private loadTexts(): JeuOieCaseTextsJsonV1 {
    return this.contentLoader.loadContent<JeuOieCaseTextsJsonV1>({
      gameType: 'jeu-oie',
      baseDir: __dirname,
      filename: 'descriptions.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('cases', 1),
      ],
    });
  }

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = Array.isArray(baseState.players) ? baseState.players : [];
    const positions: Record<number, number> = {};
    const laps: Record<number, number> = {};
    for (const p of players) {
      positions[p.id] = 1;
      laps[p.id] = 0;
    }
    const pawnByPlayerId: Record<number, string> = {};

    const starterId =
      typeof baseState.turn?.currentPlayerId === 'number'
        ? baseState.turn.currentPlayerId
        : players[0]?.id ?? null;
    const pendingInfo = buildPawnPending(
      players,
      pawnByPlayerId,
      starterId,
      JEU_OIE_PAWNS,
    );

    const meta: JeuOieMetadata = {
      tiles: buildTiles(this.loadTexts()),
      positions,
      laps,
      pawns: [...JEU_OIE_PAWNS],
      pawnByPlayerId,
      setupStarterId: starterId,
      statuses: { skipTurn: {}, well: {} },
      winnerId: null,
    };

    const next: GameStateEntity = {
      ...baseState,
      phase: 'turn',
      lastRoll: null,
      pending: pendingInfo?.pending ?? null,
      turnIndex:
        pendingInfo?.turnIndex != null ? pendingInfo.turnIndex : baseState.turnIndex,
      turn: {
        ...(baseState.turn ?? { direction: 1 }),
        currentPlayerId: pendingInfo?.playerId ?? starterId,
        direction: 1,
      },
      metadata: { ...(baseState.metadata ?? {}), ...meta },
    };

    if (!pendingInfo) return next;
    const chooser = players.find((p) => p?.id === pendingInfo.playerId);
    const chooserName = String((chooser as any)?.username ?? '').trim();
    const chooserLabel =
      chooserName.length > 0 ? chooserName : `Joueur ${pendingInfo.playerId}`;
    return this.core.appendLog(next, `${chooserLabel} doit choisir un pion.`);
  }
}

function buildPawnPending(
  players: Array<{ id: number; username?: string }>,
  pawnByPlayerId: Record<number, string>,
  startId: number | null,
  pawns: JeuOiePawn[],
): { pending: any; playerId: number; turnIndex: number } | null {
  if (!players.length) return null;
  const startIndex =
    startId != null ? players.findIndex((p) => p?.id === startId) : -1;
  const baseIndex = startIndex >= 0 ? startIndex : 0;
  let nextIndex = -1;
  for (let i = 0; i < players.length; i += 1) {
    const idx = (baseIndex + i) % players.length;
    const pid = players[idx]?.id;
    if (pid == null) continue;
    if (!pawnByPlayerId[pid]) {
      nextIndex = idx;
      break;
    }
  }
  if (nextIndex < 0) return null;

  const used = new Set(
    Object.values(pawnByPlayerId).filter((v) => typeof v === 'string'),
  );
  const choices = pawns.filter((p) => !used.has(p.id));
  if (!choices.length) return null;

  const chooserId = players[nextIndex].id;
  const chooserName = String((players[nextIndex] as any)?.username ?? '').trim();
  const chooserLabel = chooserName.length > 0 ? chooserName : `Joueur ${chooserId}`;

  return {
    playerId: chooserId,
    turnIndex: nextIndex,
    pending: {
      type: 'choose_pawn',
      playerId: chooserId,
      blocking: true,
      label: `C'est à ${chooserLabel} de choisir son pion.`,
      choices: choices.map((p) => p.label),
      data: {
        pawns: choices.map((p) => ({
          id: p.id,
          label: p.label,
          feminine: p.feminine,
        })),
      },
    },
  };
}

function buildTiles(texts: JeuOieCaseTextsJsonV1): JeuOieTile[] {
  const byIndex = new Map<number, { title: string; description: string }>();
  for (const c of texts?.cases ?? []) {
    const index = typeof c?.index === 'number' ? c.index : Number(c?.index);
    if (!Number.isFinite(index)) continue;
    const title = typeof c?.title === 'string' ? c.title.trim() : '';
    const description =
      typeof c?.description === 'string' ? c.description.trim() : '';
    if (!title && !description) continue;
    byIndex.set(Math.trunc(index), { title, description });
  }

  const tiles: JeuOieTile[] = [];
  const goose = new Set([5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59]);

  // 0..63 inclus (64 cases). Victoire = case 63.
  for (let i = 0; i <= 63; i += 1) {
    if (i === 0) {
      tiles.push({
        id: 'outside',
        type: 'normal',
        label: 'Case 0 - Hors plateau',
      });
      continue;
    }
    if (i === 1) {
      const t = byIndex.get(i);
      tiles.push({
        id: 'start',
        type: 'start',
        label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Depart`,
        description: t?.description || undefined,
      });
      continue;
    }
    if (i === 63) {
      const t = byIndex.get(i);
      tiles.push({
        id: 'finish',
        type: 'finish',
        label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Arrivee`,
        description: t?.description || undefined,
      });
      continue;
    }
    if (i === 6) {
      const t = byIndex.get(i);
      tiles.push({
        id: 'bridge',
        type: 'bridge',
        label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Pont`,
        description: t?.description || undefined,
      });
      continue;
    }
    if (i === 19) {
      const t = byIndex.get(i);
      tiles.push({
        id: 'inn',
        type: 'inn',
        label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Auberge`,
        description: t?.description || undefined,
        skipTurns: 1,
      });
      continue;
    }
    if (i === 26) {
      const t = byIndex.get(i);
      tiles.push({
        id: 'magic-die',
        type: 'magic_die',
        label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - De magique`,
        description: t?.description || undefined,
      });
      continue;
    }
    if (i === 31) {
      const t = byIndex.get(i);
      tiles.push({
        id: 'well',
        type: 'well',
        label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Puits`,
        description: t?.description || undefined,
      });
      continue;
    }
    if (i === 42) {
      const t = byIndex.get(i);
      tiles.push({
        id: 'labyrinth',
        type: 'labyrinth',
        label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Labyrinthe`,
        description: t?.description || undefined,
        backTo: 30,
      });
      continue;
    }
    if (i === 52) {
      const t = byIndex.get(i);
      tiles.push({
        id: 'prison',
        type: 'prison',
        label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Prison`,
        description: t?.description || undefined,
        skipTurns: 2,
      });
      continue;
    }
    if (i === 58) {
      const t = byIndex.get(i);
      tiles.push({
        id: 'death',
        type: 'death',
        label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Mort`,
        description: t?.description || undefined,
        backTo: 1,
      });
      continue;
    }
    if (goose.has(i)) {
      const t = byIndex.get(i);
      tiles.push({
        id: `goose-${i}`,
        type: 'goose',
        label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Oie`,
        description: t?.description || undefined,
      });
      continue;
    }
    const t = byIndex.get(i);
    tiles.push({
      id: `c${i}`,
      type: 'normal',
      label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i}`,
      description: t?.description || undefined,
    });
  }
  return tiles;
}
