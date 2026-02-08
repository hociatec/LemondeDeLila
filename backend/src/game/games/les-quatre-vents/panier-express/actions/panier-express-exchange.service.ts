import { Injectable } from '@nestjs/common';
import { GameCoreService } from '../../../../core/services/game-core.service';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { playingLog } from '../../../../../common/utils/playing-logger';
import type { PanierExpressMetadata } from '../model/panier-express-state.entity';
import { PanierExpressUtils } from '../model/panier-express-utils.service';
import { PanierExpressDeckService } from './panier-express-deck.service';
import { PanierExpressDrawService } from './panier-express-draw.service';
import type { InteractiveExchangeAdapter } from '../../../../modules/exchange/model/interactive-exchange.model';
import { defaultExchangeTargets } from '../../../../modules/exchange/model/interactive-exchange.model';
import { InteractiveExchangeService } from '../../../../modules/exchange/services/interactive-exchange.service';
import { PanierExpressSetupService } from '../setup/panier-express-setup.service';
import { RandomService } from '../../../../modules/random/services/random.service';

@Injectable()
export class PanierExpressExchangeService {
  constructor(
    private readonly core: GameCoreService,
    private readonly utils: PanierExpressUtils,
    private readonly deckHelper: PanierExpressDeckService,
    private readonly drawSvc: PanierExpressDrawService,
    private readonly exchangeFlow: InteractiveExchangeService,
    private readonly setup: PanierExpressSetupService,
    private readonly random: RandomService,
  ) {}

  applyExchange(state: GameStateEntity, playerId: number): GameStateEntity {
    if (state.pending) {
      return this.core.appendLog(
        state,
        `[Panier Express] Un autre événement est déjà en attente.`,
      );
    }
    return this.requestExchange(state, playerId);
  }

  chooseTarget(
    state: GameStateEntity,
    playerId: number,
    targetPlayerId: number,
  ): GameStateEntity {
    const result = this.exchangeFlow.chooseTarget(
      state,
      playerId,
      targetPlayerId,
      this.adapter(),
    );
    if (result.kind === 'updated') return result.state;
    return this.core.appendLog(
      state,
      "[Panier Express] Cible d'échange invalide.",
    );
  }

  chooseGive(
    state: GameStateEntity,
    playerId: number,
    give: string,
  ): GameStateEntity {
    const result = this.exchangeFlow.chooseGive(
      state,
      playerId,
      give,
      this.adapter(),
    );
    if (result.kind !== 'offered') {
      return this.core.appendLog(state, '[Panier Express] Échange invalide.');
    }

    const offer = result.offer;
    const giveLabel = this.utils.formatCourseLabel(offer.give);
    const takeLabel =
      offer.take != null ? this.utils.formatCourseLabel(offer.take) : null;
    const takeText = takeLabel != null ? `"${takeLabel}"` : 'aucune carte';
    return this.core.appendLog(
      result.state,
      `[Panier Express] ${offer.initiatorUsername} propose un échange à ${offer.targetUsername} : il donne "${giveLabel}" et recevra ${takeText}.`,
    );
  }

  acceptOffer(state: GameStateEntity, targetPlayerId: number): GameStateEntity {
    const result = this.exchangeFlow.acceptOffer(
      state,
      targetPlayerId,
      this.adapter(),
    );
    if (result.kind !== 'resolved') {
      return this.core.appendLog(
        state,
        "[Panier Express] Acceptation d'échange invalide.",
      );
    }

    const offer = result.offer;
    const giveLabel = this.utils.formatCourseLabel(offer.give);
    const takeLabel =
      offer.take != null ? this.utils.formatCourseLabel(offer.take) : null;
    if (offer.bonusRequested) {
      const after = this.core.appendLog(
        result.state,
        `[Panier Express] Échange accepté : ${offer.initiatorUsername} donne "${giveLabel}" à ${offer.targetUsername}. ${offer.targetUsername} n'a aucune carte et perd 2 tours.`,
      );
      return {
        ...after,
        pending: {
          type: 'draw',
          playerId: offer.initiatorPlayerId,
          blocking: true,
          label: 'Piocher une course bonus (Espace).',
          data: {
            kind: 'queue',
            queue: [{ playerId: offer.initiatorPlayerId, standId: 'bonus' }],
            cursor: 0,
          },
        },
      } as any;
    }

    playingLog('panier.exchange.resolve', {
      roomId: (state.metadata as any)?.roomId ?? null,
      gameType: (state.metadata as any)?.gameType ?? null,
      userId: offer.initiatorPlayerId,
      type: 'exchange_resolve',
      playerId: offer.initiatorPlayerId,
      targetPlayerId: offer.targetPlayerId,
    });

    return this.core.appendLog(
      result.state,
      `[Panier Express] Échange accepté : ${offer.initiatorUsername} donne "${giveLabel}" et reçoit "${takeLabel ?? ''}" de ${offer.targetUsername}.`,
    );
  }

  refuseOffer(state: GameStateEntity, targetPlayerId: number): GameStateEntity {
    const pending = state.pending as any;
    const offer =
      pending && pending.type === 'exchange' && pending.step === 'confirm'
        ? pending
        : null;
    const cleared = this.exchangeFlow.refuseOffer(state, targetPlayerId);
    if (!offer) {
      return this.core.appendLog(
        state,
        "[Panier Express] Refus d'échange invalide.",
      );
    }
    return this.core.appendLog(
      cleared,
      `[Panier Express] ${offer.targetUsername} refuse l'échange proposé par ${offer.initiatorUsername}.`,
    );
  }

  applyExchangeCard(
    state: GameStateEntity,
    initiatorPlayerId: number,
    targetPlayerId: number,
    card: string,
  ): GameStateEntity {
    const kind = String(card ?? '').trim();
    if (!kind) return state;

    if (kind === 'vol-discret') {
      const meta = (state.metadata ?? {}) as any;
      const target = (state.players ?? []).find(
        (p) => p.id === targetPlayerId,
      ) as any;
      const inv = this.utils.toStringArray(target?.inventory);
      if (!inv.length) {
        return this.core.appendLog(
          state,
          `[Panier Express] Vol discret : ${this.utils.playerName(state, targetPlayerId)} n'a aucune carte.`,
        );
      }
      const metaRng = this.random.createMetaRng(meta);
      const picked = this.random.pickOne(metaRng.getMeta(), inv);
      const stolen = String(picked.value ?? '').trim();
      if (!stolen) return state;

      let next: GameStateEntity = { ...state, metadata: picked.meta };
      next = removeFromInventoryState(this.utils, next, targetPlayerId, stolen);
      next = addCardToPlayerState(this.utils, next, initiatorPlayerId, stolen);

      return this.core.appendLog(
        next,
        `[Panier Express] Vol discret : ${this.utils.playerName(
          state,
          initiatorPlayerId,
        )} vole "${stolen}" à ${this.utils.playerName(state, targetPlayerId)}.`,
      );
    }

    if (kind === 'chariot-echange') {
      const initiator = (state.players ?? []).find(
        (p) => p.id === initiatorPlayerId,
      ) as any;
      const target = (state.players ?? []).find(
        (p) => p.id === targetPlayerId,
      ) as any;
      const initiatorInv = this.utils.toStringArray(initiator?.inventory);
      const targetInv = this.utils.toStringArray(target?.inventory);
      let next: GameStateEntity = state;
      next = setInventoryState(this.utils, next, initiatorPlayerId, []);
      next = setInventoryState(this.utils, next, targetPlayerId, []);
      targetInv.forEach((card) => {
        next = addCardToPlayerState(this.utils, next, initiatorPlayerId, card);
      });
      initiatorInv.forEach((card) => {
        next = addCardToPlayerState(this.utils, next, targetPlayerId, card);
      });
      return this.core.appendLog(
        next,
        `[Panier Express] Chariot échangé : ${this.utils.playerName(
          state,
          initiatorPlayerId,
        )} échange son inventaire avec ${this.utils.playerName(state, targetPlayerId)}.`,
      );
    }

    if (kind === 'echange-force') {
      const initiator = (state.players ?? []).find(
        (p) => p.id === initiatorPlayerId,
      ) as any;
      const target = (state.players ?? []).find(
        (p) => p.id === targetPlayerId,
      ) as any;
      const initiatorInv = this.utils.toStringArray(initiator?.inventory);
      const targetInv = this.utils.toStringArray(target?.inventory);
      if (!initiatorInv.length || !targetInv.length) {
        return this.core.appendLog(
          state,
          `[Panier Express] Échange forcé : inventaire vide.`,
        );
      }

      let next: GameStateEntity = state;
      const metaRng = this.random.createMetaRng((next.metadata as any) ?? {});
      const pickA = this.random.pickOne(metaRng.getMeta(), initiatorInv);
      next = { ...next, metadata: pickA.meta };
      const aCard = String(pickA.value ?? '').trim();
      const pickB = this.random.pickOne(
        (next.metadata as any) ?? {},
        targetInv,
      );
      next = { ...next, metadata: pickB.meta };
      const bCard = String(pickB.value ?? '').trim();

      if (aCard)
        next = removeFromInventoryState(
          this.utils,
          next,
          initiatorPlayerId,
          aCard,
        );
      if (bCard)
        next = removeFromInventoryState(
          this.utils,
          next,
          targetPlayerId,
          bCard,
        );
      if (aCard)
        next = addCardToPlayerState(this.utils, next, targetPlayerId, aCard);
      if (bCard)
        next = addCardToPlayerState(this.utils, next, initiatorPlayerId, bCard);

      return this.core.appendLog(
        next,
        `[Panier Express] Échange forcé : échange au hasard entre ${this.utils.playerName(
          state,
          initiatorPlayerId,
        )} et ${this.utils.playerName(state, targetPlayerId)}.`,
      );
    }

    if (kind === 'echange-impose') {
      const target = (state.players ?? []).find(
        (p) => p.id === targetPlayerId,
      ) as any;
      const inv = this.utils.toStringArray(target?.inventory);
      if (!inv.length) {
        return this.core.appendLog(
          state,
          `[Panier Express] Échange imposé : ${this.utils.playerName(state, targetPlayerId)} n'a aucune carte.`,
        );
      }
      return {
        ...state,
        pending: {
          type: 'pick',
          playerId: targetPlayerId,
          blocking: true,
          label: `Choisissez une carte à donner à ${this.utils.playerName(
            state,
            initiatorPlayerId,
          )}, puis Entrée.`,
          choices: inv,
          data: {
            kind: 'exchange.impose.choose_card',
            initiatorId: initiatorPlayerId,
            cards: inv,
          },
        } as any,
      };
    }

    return this.core.appendLog(
      state,
      `[Panier Express] Carte d'échange non gérée : ${kind}.`,
    );
  }

  private requestExchange(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const meta = state.metadata as PanierExpressMetadata;
    if (!meta.decks) {
      return this.core.appendLog(
        state,
        '[Panier Express] Decks indisponibles pour les échanges.',
      );
    }

    const draw = this.deckHelper.drawWithReplenish<string>(
      meta,
      'exchanges',
      () => this.setup.exchangeCards(),
    );
    const metadata = draw.metadata;
    const resolvedCard = draw.card ?? 'exchange';

    // Certaines cartes d'échange ont des effets directs / choix spécifiques.
    // On utilise `pending: pick` pour les cartes nécessitant un choix simple, sinon fallback sur l'échange interactif.
    if (
      [
        'vol-discret',
        'chariot-echange',
        'echange-impose',
        'echange-force',
      ].includes(resolvedCard)
    ) {
      const targets = (state.players ?? [])
        .filter((p) => p.id !== playerId)
        .map((p) => ({ playerId: p.id, username: p.username }));
      const choices = targets
        .map((t) => String(t.username ?? ''))
        .filter((v) => v.length > 0);
      if (!choices.length) {
        return this.core.appendLog(
          { ...state, metadata },
          `[Panier Express] Aucun joueur disponible pour ${resolvedCard}.`,
        );
      }
      const exchangeLabel = this.utils.formatEventLabel(resolvedCard) || resolvedCard;
      return {
        ...state,
        metadata,
        pending: {
          type: 'pick',
          playerId,
          blocking: true,
          label: `Choisissez un joueur pour ${exchangeLabel}, puis Entrée.`,
          choices,
          data: { kind: 'exchange.choose_target', card: resolvedCard, targets },
        } as any,
      };
    }

    if (resolvedCard === 'troc-rapide') {
      const players = state.players ?? [];
      if (players.length < 2) {
        return this.core.appendLog(
          { ...state, metadata },
          `[Panier Express] Troc rapide : aucun joueur disponible.`,
        );
      }
      const idx = players.findIndex((p) => p.id === playerId);
      const targetPlayerId = Number(
        players[(idx - 1 + players.length) % players.length]?.id,
      );
      const me = (state.players ?? []).find((p) => p.id === playerId) as any;
      const inv = this.utils.toStringArray(me?.inventory);
      if (!inv.length) {
        return this.core.appendLog(
          { ...state, metadata },
          `[Panier Express] Troc rapide : inventaire vide.`,
        );
      }
      return {
        ...state,
        metadata,
        pending: {
          type: 'pick',
          playerId,
          blocking: true,
          label: `Choisissez une carte à échanger avec ${this.utils.playerName(state, targetPlayerId)}, puis Entrée.`,
          choices: inv,
          data: { kind: 'exchange.troc_rapide.choose_give', targetPlayerId },
        } as any,
      };
    }

    if (resolvedCard === 'troc-fruit-legume') {
      const targets = (state.players ?? [])
        .filter((p) => p.id !== playerId)
        .map((p) => ({ playerId: p.id, username: p.username }));
      const choices = targets
        .map((t) => String(t.username ?? ''))
        .filter((v) => v.length > 0);
      if (!choices.length) {
        return this.core.appendLog(
          { ...state, metadata },
          `[Panier Express] Troc fruit/l?gume : aucun joueur disponible.`,
        );
      }
      return {
        ...state,
        metadata,
        pending: {
          type: 'pick',
          playerId,
          blocking: true,
          label: 'Choisissez un joueur pour le troc, puis Entrée.',
          choices,
          data: { kind: 'exchange.troc_fruit_legume.choose_target', targets },
        } as any,
      };
    }

    if (resolvedCard === 'echange-saison') {
      const targets = (state.players ?? [])
        .filter((p) => p.id !== playerId)
        .map((p) => ({ playerId: p.id, username: p.username }));
      const choices = targets
        .map((t) => String(t.username ?? ''))
        .filter((v) => v.length > 0);
      if (!choices.length) {
        return this.core.appendLog(
          { ...state, metadata },
          `[Panier Express] Échange de saison : aucun joueur disponible.`,
        );
      }
      return {
        ...state,
        metadata,
        pending: {
          type: 'pick',
          playerId,
          blocking: true,
          label: 'Choisissez un joueur pour l’échange de saison, puis Entrée.',
          choices,
          data: { kind: 'exchange.echange_saison.choose_target', targets },
        } as any,
      };
    }

    if (resolvedCard === 'echange-strategique') {
      const targets = (state.players ?? [])
        .filter((p) => p.id !== playerId)
        .map((p) => ({ playerId: p.id, username: p.username }));
      const choices = targets
        .map((t) => String(t.username ?? ''))
        .filter((v) => v.length > 0);
      if (!choices.length) {
        return this.core.appendLog(
          { ...state, metadata },
          `[Panier Express] Échange stratégique : aucun joueur disponible.`,
        );
      }

      const exchangeIdOut = this.random.nextInt(metadata as any, 1_000_000_000);
      const nextMetadata = exchangeIdOut.meta;
      const exchangeId = exchangeIdOut.value;

      return {
        ...state,
        metadata: nextMetadata,
        pending: {
          type: 'pick',
          playerId,
          blocking: true,
          label:
            "Choisissez un joueur pour l'échange stratégique, puis Entrée.",
          choices,
          data: {
            kind: 'exchange.strategique.choose_target',
            exchangeId,
            targets,
          },
        } as any,
      };
    }

    if (resolvedCard === 'marche-noir') {
      const me = (state.players ?? []).find((p) => p.id === playerId) as any;
      const cards = this.utils.toStringArray(me?.inventory);
      if (!cards.length) {
        return this.core.appendLog(
          { ...state, metadata },
          `[Panier Express] Marché noir : aucune carte à défausser.`,
        );
      }
      return {
        ...state,
        metadata,
        pending: {
          type: 'pick',
          playerId,
          blocking: true,
          label: 'Choisissez une carte à défausser, puis Entrée.',
          choices: cards,
          data: { kind: 'exchange.marche_noir.discard' },
        } as any,
      };
    }

    if (
      resolvedCard === 'echange-devant' ||
      resolvedCard === 'echange-derriere'
    ) {
      const exchangeLabel = this.utils.formatEventLabel(resolvedCard);
      const players = state.players ?? [];
      if (players.length < 2) {
        return this.core.appendLog(
          { ...state, metadata },
          `[Panier Express] ${exchangeLabel} : aucun joueur disponible.`,
        );
      }
      const idx = players.findIndex((p) => p.id === playerId);
      const targetPlayerId = Number(
        players[
          resolvedCard === 'echange-devant'
            ? (idx + 1) % players.length
            : (idx - 1 + players.length) % players.length
        ]?.id,
      );
      const me = (state.players ?? []).find((p) => p.id === playerId) as any;
      const target = (state.players ?? []).find(
        (p) => p.id === targetPlayerId,
      ) as any;
      const myInv = this.utils.toStringArray(me?.inventory);
      const theirInv = this.utils.toStringArray(target?.inventory);
      if (!myInv.length || !theirInv.length) {
        return this.core.appendLog(
          { ...state, metadata },
          `[Panier Express] ${exchangeLabel} : inventaire vide.`,
        );
      }
      let next: GameStateEntity = { ...state, metadata };
      const metaRng = this.random.createMetaRng((next.metadata as any) ?? {});
      const pickA = this.random.pickOne(metaRng.getMeta(), myInv);
      next = { ...next, metadata: pickA.meta };
      const aCard = String(pickA.value ?? '').trim();
      const pickB = this.random.pickOne((next.metadata as any) ?? {}, theirInv);
      next = { ...next, metadata: pickB.meta };
      const bCard = String(pickB.value ?? '').trim();
      if (aCard)
        next = removeFromInventoryState(this.utils, next, playerId, aCard);
      if (bCard)
        next = removeFromInventoryState(
          this.utils,
          next,
          targetPlayerId,
          bCard,
        );
      if (aCard)
        next = addCardToPlayerState(this.utils, next, targetPlayerId, aCard);
      if (bCard) next = addCardToPlayerState(this.utils, next, playerId, bCard);
      const positionLabel =
        resolvedCard === 'echange-devant'
          ? 'juste devant vous'
          : 'juste derrière vous';
      return this.core.appendLog(
        next,
        `[Panier Express] ${exchangeLabel} : échange au hasard avec le joueur ${positionLabel} (${this.utils.playerName(state, targetPlayerId)}).`,
      );
    }

    if (resolvedCard === 'panier-mixe') {
      const metaAny = metadata as any;
      const positions = (metaAny.positions ?? {}) as Record<number, number>;
      const tiles = Array.isArray(metaAny.tiles) ? metaAny.tiles : [];
      const total = tiles.length || 1;
      const others = (state.players ?? []).filter((p) => p.id !== playerId);
      if (!others.length) {
        return this.core.appendLog(
          { ...state, metadata },
          `[Panier Express] Panier mixé : aucun joueur disponible.`,
        );
      }
      const mePos = positions[playerId] ?? 0;
      let targetPlayerId = others[0].id;
      let bestDist = Number.POSITIVE_INFINITY;
      others.forEach((p) => {
        const pos = positions[p.id] ?? 0;
        const forward = (pos - mePos + total) % total;
        const backward = (mePos - pos + total) % total;
        const dist = Math.min(forward, backward);
        if (dist < bestDist) {
          bestDist = dist;
          targetPlayerId = p.id;
        }
      });
      const me = (state.players ?? []).find((p) => p.id === playerId) as any;
      const target = (state.players ?? []).find(
        (p) => p.id === targetPlayerId,
      ) as any;
      const aInv = this.utils.toStringArray(me?.inventory);
      const bInv = this.utils.toStringArray(target?.inventory);
      const combined = [...aInv, ...bInv];
      if (!combined.length) {
        return this.core.appendLog(
          { ...state, metadata },
          `[Panier Express] Panier mixé : aucun inventaire à mélanger.`,
        );
      }
      const shuffled = this.random.shuffle((metadata as any) ?? {}, combined);
      let next: GameStateEntity = { ...state, metadata: shuffled.meta };
      next = setInventoryState(this.utils, next, playerId, []);
      next = setInventoryState(this.utils, next, targetPlayerId, []);

      const half = Math.floor(shuffled.values.length / 2);
      const aCards = shuffled.values.slice(0, half);
      const bCards = shuffled.values.slice(half, half * 2);
      const leftover = shuffled.values.slice(half * 2);

      aCards.forEach((c) => {
        next = addCardToPlayerState(this.utils, next, playerId, c);
      });
      bCards.forEach((c) => {
        next = addCardToPlayerState(this.utils, next, targetPlayerId, c);
      });
      leftover.forEach((c) => {
        next = addToDiscardState(next, c);
      });

      return this.core.appendLog(
        next,
        `[Panier Express] Panier mixé : mélange avec ${this.utils.playerName(state, targetPlayerId)}.`,
      );
    }

    if (resolvedCard === 'echange-masque') {
      const eligible = (state.players ?? []).filter(
        (p: any) => this.utils.toStringArray(p.inventory).length > 0,
      );
      if (eligible.length < 2) {
        return this.core.appendLog(
          { ...state, metadata },
          `[Panier Express] Échange masqué : pas assez de joueurs avec des cartes.`,
        );
      }
      const shuffledPlayers = this.random.shuffle(
        (metadata as any) ?? {},
        eligible.map((p) => p.id),
      );
      let next: GameStateEntity = {
        ...state,
        metadata: shuffledPlayers.meta,
      };
      const pickedByPlayer: Record<number, string> = {};
      for (const pid of shuffledPlayers.values) {
        const inv = this.utils.toStringArray(
          (next.players ?? []).find((p: any) => p.id === pid)?.inventory,
        );
        const pick = this.random.pickOne((next.metadata as any) ?? {}, inv);
        next = { ...next, metadata: pick.meta };
        const card = String(pick.value ?? '').trim();
        if (!card) continue;
        pickedByPlayer[pid] = card;
        next = removeFromInventoryState(this.utils, next, pid, card);
      }
      const ids = shuffledPlayers.values;
      for (let i = 0; i < ids.length; i += 1) {
        const giverId = ids[i];
        const receiverId = ids[(i + 1) % ids.length];
        const card = pickedByPlayer[giverId];
        if (card) {
          next = addCardToPlayerState(this.utils, next, receiverId, card);
        }
      }
      return this.core.appendLog(
        next,
        `[Panier Express] Échange masqué : échange réalisé.`,
      );
    }

    if (resolvedCard === 'panier-collectif') {
      const players = state.players ?? [];
      const contributors: number[] = [];
      let pot: string[] = [];
      let next: GameStateEntity = { ...state, metadata };

      for (const p of players) {
        const inv = this.utils.toStringArray((p as any).inventory);
        if (!inv.length) continue;
        const pick = this.random.pickOne((next.metadata as any) ?? {}, inv);
        next = { ...next, metadata: pick.meta };
        const card = String(pick.value ?? '').trim();
        if (!card) continue;
        contributors.push(p.id);
        pot.push(card);
        next = removeFromInventoryState(this.utils, next, p.id, card);
      }
      if (!pot.length || contributors.length < 2) {
        return this.core.appendLog(
          next,
          `[Panier Express] Inventaire collectif : pas assez de cartes dans le pot.`,
        );
      }
      const shuffledPot = this.random.shuffle(
        (next.metadata as any) ?? {},
        pot,
      );
      next = { ...next, metadata: shuffledPot.meta };
      pot = shuffledPot.values;
      for (let i = 0; i < contributors.length; i += 1) {
        next = addCardToPlayerState(this.utils, next, contributors[i], pot[i]);
      }
      return this.core.appendLog(
        next,
        `[Panier Express] Inventaire collectif : redistribution d'inventaire effectuée.`,
      );
    }

    if (resolvedCard === 'echange-simultane') {
      const players = state.players ?? [];
      if (players.length < 2) {
        return this.core.appendLog(
          { ...state, metadata },
          `[Panier Express] Échange simultané : aucun joueur disponible.`,
        );
      }
      let next: GameStateEntity = { ...state, metadata };
      const toPass: Array<{ from: number; card: string }> = [];
      for (const p of players) {
        const inv = this.utils.toStringArray((p as any).inventory);
        if (!inv.length) continue;
        const pick = this.random.pickOne((next.metadata as any) ?? {}, inv);
        next = { ...next, metadata: pick.meta };
        const card = String(pick.value ?? '').trim();
        if (!card) continue;
        toPass.push({ from: p.id, card });
        next = removeFromInventoryState(this.utils, next, p.id, card);
      }
      for (const entry of toPass) {
        const idx = players.findIndex((p) => p.id === entry.from);
        const targetId = players[(idx + 1) % players.length].id;
        next = addCardToPlayerState(this.utils, next, targetId, entry.card);
      }
      for (const entry of toPass) {
        const idx = players.findIndex((p) => p.id === entry.from);
        const targetId = players[(idx + 1) % players.length].id;
        next = this.core.appendLog(
          next,
          `[Panier Express] Échange simultané : ${this.utils.playerName(
            state,
            entry.from,
          )} donne "${this.utils.formatCourseLabel(
            entry.card,
          )}" à ${this.utils.playerName(state, targetId)}.`,
        );
      }
      return next;
    }

    if (resolvedCard === 'defausse-aleatoire') {
      const inventory = this.utils.toStringArray(
        (state.players ?? []).find((p) => p.id === playerId)?.inventory,
      );
      if (!inventory.length) {
        return this.core.appendLog(
          { ...state, metadata },
          `[Panier Express] Défausse aléatoire : inventaire vide.`,
        );
      }
      const metaRng = this.random.createMetaRng(metadata as any);
      const picked = this.random.pickOne(metaRng.getMeta(), inventory);
      const card = String(picked.value ?? '').trim();
      const updatedMeta = picked.meta;
      const players = (state.players ?? []).map((p: any) => {
        if (p.id !== playerId) return p;
        const nextInv = this.utils.removeOne(inventory, card);
        return { ...p, inventory: nextInv };
      });
      const cardLabel = this.utils.formatCourseLabel(card);
      return this.core.appendLog(
        addToDiscardState({ ...state, players, metadata: updatedMeta }, card),
        `[Panier Express] Défausse aléatoire : ${this.utils.playerName(state, playerId)} défausse "${cardLabel}".`,
      );
    }

    const started = this.exchangeFlow.start(
      { ...state, metadata },
      playerId,
      resolvedCard,
      this.adapter(),
    );

    if (started.kind === 'started') {
      const pending = started.pending as any;
      const targetsCount = Array.isArray(pending?.targets)
        ? pending.targets.length
        : 0;
      playingLog('panier.exchange.pending', {
        roomId: (state.metadata as any)?.roomId ?? null,
        gameType: (state.metadata as any)?.gameType ?? null,
        userId: playerId,
        type: 'exchange_pending',
        playerId,
        card: resolvedCard,
        targets: targetsCount,
      });
      return started.state;
    }

    const reason =
      started.kind === 'no_targets'
        ? `[Panier Express] Aucun joueur disponible pour un échange (${resolvedCard}).`
        : `[Panier Express] Pas d'échange possible (${resolvedCard}).`;
    return this.core.appendLog({ ...state, metadata }, reason);
  }

  private adapter(): InteractiveExchangeAdapter {
    return {
      listTargets: defaultExchangeTargets,
      getInventory: (state, playerId) => {
        const player = (state.players ?? []).find(
          (p) => p.id === playerId,
        ) as any;
        return this.utils.toStringArray(player?.inventory);
      },
      removeFromInventory: (state, playerId, card) => {
        const players = (state.players ?? []).map((p: any) => {
          if (p.id !== playerId) return p;
          const inv = this.utils.toStringArray(p.inventory);
          return { ...p, inventory: removeOne(inv, card) };
        });
        return { ...state, players };
      },
      addCardToPlayer: (state, playerId, card) => {
        return addCardToPlayerState(this.utils, state, playerId, card);
      },
      setSkipTurns: (state, playerId, turns) =>
        setSkipTurns(state, playerId, turns),
    };
  }

  private movePlayer(
    state: GameStateEntity,
    playerId: number,
    delta: number,
    metadata: PanierExpressMetadata,
  ): GameStateEntity {
    if (!delta || delta === 0) return { ...state, metadata };
    const positions = { ...(metadata.positions ?? {}) };
    const laps = { ...(metadata.laps ?? {}) };
    const tiles = Array.isArray(metadata.tiles) ? metadata.tiles : [];
    const total = tiles.length || 1;
    const currentPos = positions[playerId] ?? 0;
    const wraps = Math.floor((currentPos + delta) / total);
    const nextPos = (currentPos + delta + total) % total;
    positions[playerId] = nextPos;

    const currentLaps = typeof laps[playerId] === 'number' ? laps[playerId] : 0;
    laps[playerId] = Math.max(-1, currentLaps + wraps);

    return { ...state, metadata: { ...metadata, positions, laps } };
  }

  private defaultExchangeDeck(): string[] {
    return this.setup.exchangeCards();
  }
}

function removeOne(collection: string[], value: string): string[] {
  const copy = [...collection];
  const idx = copy.findIndex((entry) => entry === value);
  if (idx >= 0) {
    copy.splice(idx, 1);
  }
  return copy;
}

function addCardToPlayer(
  utils: PanierExpressUtils,
  player: any,
  card: string,
): { player: any; kept: boolean; discarded: boolean } {
  const trimmed = String(card ?? '').trim();
  if (!trimmed || !player) {
    return { player, kept: false, discarded: false };
  }
  const list = utils.toStringArray(player.shoppingList);
  const basket = utils.toStringArray(player.basket);
  const inventory = utils.toStringArray(player.inventory);
  const alreadyInBasket = basket.includes(trimmed);
  const alreadyInInventory = inventory.includes(trimmed);
  const isNeeded = list.includes(trimmed) && !alreadyInBasket;

  // Pas de doublons: si déjà présent, on défausse la carte reçue.
  // Si la carte est nécessaire et déjà dans l'inventaire, on la transfère au panier.
  if (alreadyInBasket || alreadyInInventory) {
    if (isNeeded && alreadyInInventory) {
      return {
        player: {
          ...player,
          basket: [...basket, trimmed],
          inventory: utils.removeOne(inventory, trimmed),
        },
        kept: false,
        discarded: true,
      };
    }
    return { player: { ...player, basket, inventory }, kept: false, discarded: true };
  }

  if (isNeeded) {
    return { player: { ...player, basket: [...basket, trimmed], inventory }, kept: true, discarded: false };
  }

  if (inventory.length >= 5) {
    return { player: { ...player, basket, inventory }, kept: false, discarded: true };
  }

  return { player: { ...player, inventory: [trimmed, ...inventory], basket }, kept: true, discarded: false };
}

function addCardToPlayerState(
  utils: PanierExpressUtils,
  state: GameStateEntity,
  playerId: number,
  card: string,
): GameStateEntity {
  const trimmed = String(card ?? '').trim();
  if (!trimmed) return state;
  let kept = false;
  let discarded = false;
  const players = (state.players ?? []).map((p: any) => {
    if (p.id !== playerId) return p;
    const result = addCardToPlayer(utils, p, trimmed);
    kept = result.kept;
    discarded = result.discarded;
    return result.player;
  });
  const meta = (state.metadata ?? {}) as any;
  const currentDiscards = Array.isArray(meta?.discards?.courses)
    ? meta.discards.courses.map((v: any) => String(v))
    : [];
  return {
    ...state,
    players,
    metadata: {
      ...meta,
      lastObtainedCourse: {
        ...(meta?.lastObtainedCourse ?? {}),
        [playerId]: kept ? trimmed : null,
      },
      discards: {
        ...(meta?.discards ?? {}),
        courses: discarded ? [...currentDiscards, trimmed] : currentDiscards,
      },
    },
  };
}

function removeFromInventoryState(
  utils: PanierExpressUtils,
  state: GameStateEntity,
  playerId: number,
  card: string,
): GameStateEntity {
  const trimmed = String(card ?? '').trim();
  if (!trimmed) return state;
  const players = (state.players ?? []).map((p: any) => {
    if (p.id !== playerId) return p;
    const inv = utils.toStringArray(p.inventory);
    return { ...p, inventory: removeOne(inv, trimmed) };
  });
  return { ...state, players };
}

function setInventoryState(
  utils: PanierExpressUtils,
  state: GameStateEntity,
  playerId: number,
  inventory: string[],
): GameStateEntity {
  const nextInv = utils.toStringArray(inventory);
  const players = (state.players ?? []).map((p: any) => {
    if (p.id !== playerId) return p;
    return { ...p, inventory: nextInv };
  });
  return { ...state, players };
}

function addToDiscardState(
  state: GameStateEntity,
  card: string,
): GameStateEntity {
  const trimmed = String(card ?? '').trim();
  if (!trimmed) return state;
  const meta = (state.metadata ?? {}) as any;
  const current = Array.isArray(meta?.discards?.courses)
    ? meta.discards.courses.map((v: any) => String(v))
    : [];
  return {
    ...state,
    metadata: {
      ...meta,
      discards: {
        ...(meta?.discards ?? {}),
        courses: [...current, trimmed],
      },
    },
  };
}

function setSkipTurns(
  state: GameStateEntity,
  playerId: number,
  turns: number,
): GameStateEntity {
  const meta = (state.metadata ?? {}) as any;
  const current = meta?.statuses?.skipTurn?.[playerId] ?? 0;
  const nextCount = Math.max(current, Math.max(1, turns || 1));
  return {
    ...state,
    metadata: {
      ...meta,
      statuses: {
        ...(meta?.statuses ?? {}),
        skipTurn: {
          ...(meta?.statuses?.skipTurn ?? {}),
          [playerId]: nextCount,
        },
      },
    },
  };
}
