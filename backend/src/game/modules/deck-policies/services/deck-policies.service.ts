import { Injectable } from '@nestjs/common';
import { RandomService } from '../../random/services/random.service';

type AnyMeta = Record<string, any>;

@Injectable()
export class DeckPoliciesService {
  constructor(private readonly random: RandomService) {}

  drawFromPile<TCard = unknown, TMeta extends AnyMeta = AnyMeta>(params: {
    meta: TMeta;
    pile: TCard[];
    discard: TCard[];
    rngKey?: keyof TMeta & string;
    useWholeMetaRng?: boolean;
    discardDrawnCard?: boolean;
  }): {
    meta: TMeta;
    pile: TCard[];
    discard: TCard[];
    card: TCard | null;
    reshuffled: boolean;
  } {
    let nextMeta = { ...(params.meta ?? {}) };
    let drawPile = Array.isArray(params.pile) ? [...params.pile] : [];
    let drawDiscard = Array.isArray(params.discard) ? [...params.discard] : [];
    let reshuffled = false;

    if (drawPile.length === 0 && drawDiscard.length > 0) {
      if (params.useWholeMetaRng) {
        const shuffled = this.random.shuffle(nextMeta as any, drawDiscard);
        nextMeta = { ...nextMeta, ...(shuffled.meta as TMeta) };
        drawPile = shuffled.values;
      } else {
        const rngKey = (params.rngKey ?? 'rng') as keyof TMeta & string;
        const shuffled = this.random.shuffle(
          (nextMeta as any)[rngKey] ?? {},
          drawDiscard,
        );
        nextMeta = { ...nextMeta, [rngKey]: shuffled.meta };
        drawPile = shuffled.values;
      }
      drawDiscard = [];
      reshuffled = true;
    }

    if (!drawPile.length) {
      return {
        meta: nextMeta,
        pile: drawPile,
        discard: drawDiscard,
        card: null,
        reshuffled,
      };
    }

    const [card, ...rest] = drawPile;
    drawPile = rest;
    if (params.discardDrawnCard && card != null) {
      drawDiscard = [...drawDiscard, card];
    }
    return {
      meta: nextMeta,
      pile: drawPile,
      discard: drawDiscard,
      card: (card ?? null) as TCard | null,
      reshuffled,
    };
  }

  drawOne<TCard = unknown, TMeta extends AnyMeta = AnyMeta>(params: {
    meta: TMeta;
    deckKey: keyof TMeta & string;
    discardKey: keyof TMeta & string;
    rngKey?: keyof TMeta & string;
  }): { meta: TMeta; card: TCard | null; reshuffled: boolean } {
    const sourceMeta = params.meta ?? {};
    const out = this.drawFromPile<TCard, TMeta>({
      meta: sourceMeta,
      pile: Array.isArray(sourceMeta[params.deckKey])
        ? (sourceMeta[params.deckKey] as TCard[])
        : [],
      discard: Array.isArray(sourceMeta[params.discardKey])
        ? (sourceMeta[params.discardKey] as TCard[])
        : [],
      rngKey: params.rngKey,
      discardDrawnCard: false,
    });
    const updatedMeta: TMeta = {
      ...out.meta,
      [params.deckKey]: out.pile,
      [params.discardKey]: out.discard,
    };
    return {
      meta: updatedMeta,
      card: out.card,
      reshuffled: out.reshuffled,
    };
  }
}
