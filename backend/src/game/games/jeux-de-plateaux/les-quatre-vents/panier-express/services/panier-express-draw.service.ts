import { Injectable } from '@nestjs/common';
import { DeckPoolService } from '../../../../../modules/cards/services/deck-pool.service';
import { GameCoreService } from '../../../../../core/services/game-core.service';
import { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import { PanierExpressMetadata } from '../entities/panier-express-state.entity';
import { PanierExpressSetupService } from './panier-express-setup.service';
import { playingLog } from '../../../../../../common/utils/playing-logger';
import { PanierExpressUtils } from './panier-express.utils';

@Injectable()
export class PanierExpressDrawService {
  constructor(
    private readonly deckPool: DeckPoolService,
    private readonly setup: PanierExpressSetupService,
    private readonly core: GameCoreService,
    private readonly utils: PanierExpressUtils,
  ) {}

  drawCourse(state: GameStateEntity, playerId: number, standId?: string): GameStateEntity {
    const meta = state.metadata as PanierExpressMetadata;
    const decks = meta.decks ?? this.setup.buildDeckPool(state);
    let metaAfter: PanierExpressMetadata = { ...meta, decks } as any;

    let resolvedStandId = standId;
    if (!resolvedStandId) {
      const pos = meta.positions?.[playerId] ?? 0;
      const tile = meta.tiles?.[pos];
      if (tile?.type === 'stand') {
        resolvedStandId = (tile as any).standId ?? '';
      }
    }

    const standKey = resolvedStandId ? `courses-${resolvedStandId}` : 'courses';
    const hasStandDeck = Boolean((metaAfter.decks as any)?.[standKey]);

    // S'assurer qu'un deck de stand existe.
    if (resolvedStandId && !hasStandDeck) {
      const standIdKey = resolvedStandId as string;
      const replenish = this.setup.standCourseMap()[standIdKey] ?? this.setup.courseItems();
      const refilledPool = this.deckPool.set<any>(
        metaAfter.decks as any,
        standKey,
        this.deckPool.shuffle(this.setup.buildReplenishableDeck(replenish)),
      );
      metaAfter = { ...metaAfter, decks: refilledPool } as any;
    }

    let draw = this.drawFromPool(metaAfter, (metaAfter.decks as any)[standKey] ? standKey : 'courses');
    metaAfter = draw.metadata as PanierExpressMetadata;

    if (!draw.card && (metaAfter.decks as any)[standKey]) {
      const standIdKey = resolvedStandId as string;
      const replenish = this.setup.standCourseMap()[standIdKey] ?? this.setup.courseItems();
      const refilledPool = this.deckPool.set<any>(
        metaAfter.decks as any,
        standKey,
        this.deckPool.shuffle(this.setup.buildReplenishableDeck(replenish)),
      );
      metaAfter = { ...metaAfter, decks: refilledPool } as any;
      draw = this.drawFromPool(metaAfter, standKey);
      metaAfter = draw.metadata as PanierExpressMetadata;
    }

    if (!draw.card) {
      const refilledPool = this.deckPool.set<any>(
        metaAfter.decks as any,
        'courses',
        this.deckPool.shuffle(this.setup.buildReplenishableDeck()),
      );
      metaAfter = { ...metaAfter, decks: refilledPool } as any;
      draw = this.drawFromPool(metaAfter, 'courses');
      metaAfter = draw.metadata as PanierExpressMetadata;
    }

    if (!draw.card) {
      const debugLabel = (metaAfter.decks as any)[standKey] ? standKey : 'courses';
      return this.core.appendLog(state, `[Panier Express] Stand ${resolvedStandId || 'inconnu'} : aucune carte disponible (deck ${debugLabel}).`);
    }

    const { card, metadata } = draw;
    const players = (state.players ?? []).map((p) => {
      if (p.id !== playerId) return p;
      const shoppingList = Array.isArray((p as any).shoppingList) ? (p as any).shoppingList.map((c: any) => String(c)) : [];
      const basket = Array.isArray((p as any).basket) ? [...(p as any).basket] : [];
      const inventory = Array.isArray((p as any).inventory) ? [...(p as any).inventory] : [];
      if (shoppingList.includes(card) && !basket.includes(card)) {
        basket.push(card);
      } else {
        inventory.push(card);
      }
      return { ...p, basket, inventory };
    });

    const nextState: GameStateEntity = { ...state, players, metadata };
    const playerPos = (meta.positions ?? {})[playerId] ?? 0;
    const tile = meta.tiles?.[playerPos];
    let standLabel: string;
    if (resolvedStandId) {
      standLabel = resolvedStandId;
    } else if (tile?.type === 'stand') {
      standLabel = (tile as any).standId ?? tile.id ?? 'stand';
    } else {
      standLabel = 'hors-stand';
      playingLog('panier.draw.warn', {
        playerId,
        reason: 'draw-outside-stand',
        position: playerPos,
        tileType: tile?.type ?? null,
        tileId: tile?.id ?? null,
      });
    }
    const logged = this.core.appendLog(
      nextState,
      `[Panier Express] ${this.utils.playerName(state, playerId)} pioche "${card}" au stand ${standLabel}`,
    );

    const playerView = players.find((p) => p.id === playerId) as any;
    playingLog('panier.draw', {
      playerId,
      card,
      standId: resolvedStandId || null,
      shoppingList: playerView?.shoppingList ?? [],
      basket: playerView?.basket ?? [],
      inventory: playerView?.inventory ?? [],
    });

    return logged;
  }

  private drawFromPool<T = any>(meta: PanierExpressMetadata, key: string): { card: T | null; metadata: PanierExpressMetadata } {
    const { card, pool } = this.deckPool.draw<T>(meta.decks as any, key);
    return {
      card: card as T | null,
      metadata: { ...meta, decks: pool as any },
    };
  }

}
