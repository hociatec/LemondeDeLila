export function movementDelta(text: string): number {
  const match = text.match(
    /(avancez|reculez) (?:de |d['’])?(\d+|un|une|deux|trois|quatre|cinq|six) cases?/i,
  );
  if (!match) return 0;
  const values: Record<string, number> = {
    un: 1,
    une: 1,
    deux: 2,
    trois: 3,
    quatre: 4,
    cinq: 5,
    six: 6,
  };
  const amount = Number(match[2]) || values[match[2]] || 0;
  return match[1].startsWith('recule') ? -amount : amount;
}

export function moneyDelta(text: string): number {
  const gain = text.match(/(?:recevez|recois|gagnez|gagne|empochez) (\d+)/i);
  if (gain) return Number(gain[1]);
  const loss = text.match(/(?:payez|paie|paye|perdez) (\d+)/i);
  return loss ? -Number(loss[1]) : 0;
}

export function skipTurns(text: string): number {
  if (
    !text.includes('passez') &&
    !text.includes('passe ton') &&
    !text.includes('passe votre')
  ) {
    return 0;
  }
  if (text.includes('trois tour')) return 3;
  if (text.includes('deux tour')) return 2;
  return 1;
}

export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'`]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
