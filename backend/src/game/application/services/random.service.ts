import { Injectable } from '@nestjs/common';
import { nextRngFloat, nextRngInt } from '../../../common/utils/public-api';

@Injectable()
export class RandomService {
  createMetaRng<TMeta extends Record<string, unknown>>(
    meta: TMeta,
  ): {
    rng: () => number;
    getMeta: () => TMeta;
  } {
    let current = meta;
    return {
      rng: () => {
        const out = this.nextFloat(current);
        current = out.meta;
        return out.value;
      },
      getMeta: () => current,
    };
  }

  nextFloat<TMeta extends Record<string, unknown>>(
    meta: TMeta,
  ): {
    value: number;
    meta: TMeta;
  } {
    const out = nextRngFloat(meta);
    return { value: out.value, meta: out.meta as TMeta };
  }

  nextInt<TMeta extends Record<string, unknown>>(
    meta: TMeta,
    maxExclusive: number,
  ): { value: number; meta: TMeta } {
    const out = nextRngInt(meta, maxExclusive);
    return { value: out.value, meta: out.meta as TMeta };
  }

  rollDice<TMeta extends Record<string, unknown>>(
    meta: TMeta,
    sides: number,
  ): { roll: number; meta: TMeta } {
    const safeSides = Math.max(1, Math.floor(sides));
    const out = this.nextInt(meta, safeSides);
    return { roll: out.value + 1, meta: out.meta };
  }

  pickIndex<TMeta extends Record<string, unknown>>(
    meta: TMeta,
    length: number,
  ): { index: number; meta: TMeta } {
    const safeLen = Math.max(0, Math.floor(length));
    if (safeLen <= 0) return { index: 0, meta };
    const out = this.nextInt(meta, safeLen);
    return { index: out.value, meta: out.meta };
  }

  pickOne<T, TMeta extends Record<string, unknown>>(
    meta: TMeta,
    values: readonly T[],
  ): { value: T | null; meta: TMeta } {
    const safe = Array.isArray(values) ? values : [];
    if (!safe.length) return { value: null, meta };
    const { index, meta: updated } = this.pickIndex(meta, safe.length);
    return { value: safe[index] ?? null, meta: updated };
  }

  shuffle<T, TMeta extends Record<string, unknown>>(
    meta: TMeta,
    values: readonly T[],
  ): { values: T[]; meta: TMeta } {
    const copy = [...(Array.isArray(values) ? values : [])];
    let next = meta;
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const out = this.pickIndex(next, i + 1);
      next = out.meta;
      const j = out.index;
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return { values: copy, meta: next };
  }
}
