import type { GameStateEntity } from '../../../../core/application/models/game-state.model';
import type { SacCard, SacMetadata } from '../model/sac-a-malices.types';

function extractMoneyDelta(text: string): number {
  const gain = text.match(/(?:recevez|reçois|recois|gagnez|gagne)\s+(\d+)/i);
  if (gain) {
    const n = Number(gain[1]);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  const pay = text.match(/(?:payez|paie|paye)\s+(\d+)/i);
  if (pay) {
    const n = Number(pay[1]);
    if (Number.isFinite(n)) return -Math.trunc(n);
  }
  return 0;
}

function extractMoveDelta(text: string): number {
  const parse = (raw: string) => {
    const v = raw.trim().toLowerCase();
    const n = Number(v);
    if (Number.isFinite(n)) return n;
    const map: Record<string, number> = {
      un: 1,
      une: 1,
      deux: 2,
      trois: 3,
      quatre: 4,
      cinq: 5,
      six: 6,
    };
    return map[v] ?? 0;
  };
  const forward = text.match(
    /avance(?:z)?\s+de\s+([0-9]+|un|une|deux|trois|quatre|cinq|six)\s+case/i,
  );
  if (forward) return parse(forward[1]);
  const backward = text.match(
    /recule(?:z)?\s+de\s+([0-9]+|un|une|deux|trois|quatre|cinq|six)\s+case/i,
  );
  if (backward) return -parse(backward[1]);
  return 0;
}

function extractSkipTurns(text: string): number {
  if (/Passez trois tours/i.test(text)) return 3;
  if (/Passez deux tours/i.test(text)) return 2;
  if (
    /Passez votre prochain tour/i.test(text) ||
    /Passez votre tour/i.test(text)
  ) {
    return 1;
  }
  return 0;
}

function extractTargetPlace(text: string): string | null {
  const m1 = text.match(/avancez\s+jusqu[’']?à\s+la\s+gare\s+de\s+([^.,]+)/i);
  if (m1?.[1]) return `Gare de ${m1[1].trim()}`;
  const m2 = text.match(/avancez\s+(?:directement\s+)?à\s+([^.,]+)/i);
  if (m2?.[1]) return m2[1].trim();
  return null;
}

function isGetOutOfJailCard(text: string): boolean {
  return /Sortie de prison/i.test(text) || /Lib[ée]ration/i.test(text);
}

function extractAllPlayersMoney(
  textRaw: string,
): null | { kind: 'pay' | 'receive'; amount: number; toBank: boolean } {
  const text = String(textRaw ?? '');
  const toBank = /banque/i.test(text);

  const pay = text.match(/Tous\s+les\s+joueurs\s+(?:paient|payent)\s+(\d+)/i);
  if (pay?.[1]) {
    const n = Number(pay[1]);
    if (Number.isFinite(n) && n > 0) {
      return { kind: 'pay', amount: Math.trunc(n), toBank };
    }
  }

  const receive = text.match(/Tous\s+les\s+joueurs\s+re[çc]oivent\s+(\d+)/i);
  if (receive?.[1]) {
    const n = Number(receive[1]);
    if (Number.isFinite(n) && n > 0) {
      return { kind: 'receive', amount: Math.trunc(n), toBank };
    }
  }

  return null;
}

function mentionsInfrastructureLoss(text: string): boolean {
  return (
    /perd(?:ez|s)?\s+une\s+infrastructure/i.test(text) ||
    /perds\s+une\s+infrastructure/i.test(text)
  );
}

export function shouldKeepSacAMalicesCard(card: SacCard): boolean {
  return isGetOutOfJailCard(String(card.text ?? ''));
}

export function applySacAMalicesCardEffect(input: {
  state: GameStateEntity;
  playerId: number;
  card: SacCard;
  getMeta: (state: GameStateEntity) => SacMetadata;
  getRules: (
    meta: SacMetadata,
  ) => NonNullable<SacMetadata['rules']>;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  setGetOutOfJail: (
    state: GameStateEntity,
    playerId: number,
    count: number,
  ) => GameStateEntity;
  addMoney: (
    state: GameStateEntity,
    playerId: number,
    delta: number,
    options: { toPot: boolean },
  ) => GameStateEntity;
  loseOneInfrastructure: (
    state: GameStateEntity,
    playerId: number,
  ) => GameStateEntity;
  moveForward: (
    state: GameStateEntity,
    playerId: number,
    delta: number,
  ) => GameStateEntity;
  applyLanding: (
    state: GameStateEntity,
    playerId: number,
  ) => GameStateEntity;
  moveTo: (
    state: GameStateEntity,
    playerId: number,
    pos: number,
    options: { collectStart: boolean },
  ) => GameStateEntity;
  findTileByName: (
    tiles: SacMetadata['tiles'] | undefined,
    rawName: string,
  ) => number | null;
  addSkip: (
    state: GameStateEntity,
    playerId: number,
    turns: number,
  ) => GameStateEntity;
}): GameStateEntity {
  let next = input.state;
  const text = String(input.card.text ?? '');

  if (isGetOutOfJailCard(text)) {
    const meta = input.getMeta(next);
    const current = meta.statuses?.getOutOfJail?.[input.playerId] ?? 0;
    next = input.appendLog(next, 'Vous gardez cette carte.');
    return input.setGetOutOfJail(next, input.playerId, current + 1);
  }

  const everyone = extractAllPlayersMoney(text);
  if (everyone) {
    const meta0 = input.getMeta(next);
    const rules = input.getRules(meta0);
    const players = Array.isArray(next.players) ? next.players : [];
    const alive = players
      .map((player) => player?.id)
      .filter(
        (id): id is number => typeof id === 'number' && Number.isFinite(id),
      )
      .filter((id) => !meta0.statuses?.eliminated?.[id]);

    if (everyone.kind === 'pay') {
      next = input.appendLog(
        next,
        `Tous les joueurs paient ${everyone.amount} €.`,
      );
      for (const id of alive) {
        next = input.addMoney(next, id, -everyone.amount, {
          toPot: rules.potEnabled && !everyone.toBank,
        });
      }
      return next;
    }

    next = input.appendLog(
      next,
      `Tous les joueurs reçoivent ${everyone.amount} €.`,
    );
    for (const id of alive) {
      next = input.addMoney(next, id, everyone.amount, { toPot: false });
    }
    return next;
  }

  if (mentionsInfrastructureLoss(text)) {
    next = input.appendLog(next, 'Vous perdez une infrastructure.');
    return input.loseOneInfrastructure(next, input.playerId);
  }

  const delta = extractMoveDelta(text);
  if (delta !== 0) {
    next = input.appendLog(
      next,
      `Déplacement : ${delta > 0 ? '+' : ''}${delta}.`,
    );
    next = input.moveForward(next, input.playerId, delta);
    return input.applyLanding(next, input.playerId);
  }

  if (/retournez\s+à\s+la\s+case\s+départ/i.test(text)) {
    next = input.appendLog(next, 'Retour à Départ.');
    return input.moveTo(next, input.playerId, 0, { collectStart: false });
  }

  const targetName = extractTargetPlace(text);
  if (targetName) {
    const target = input.findTileByName(input.getMeta(next).tiles, targetName);
    if (target != null) {
      next = input.appendLog(next, `Déplacement : vers "${targetName}".`);
      next = input.moveTo(next, input.playerId, target, { collectStart: true });
      return input.applyLanding(next, input.playerId);
    }
  }

  const skip = extractSkipTurns(text);
  if (skip > 0) {
    next = input.appendLog(next, `Vous perdez ${skip} tour(s).`);
    return input.addSkip(next, input.playerId, skip);
  }

  const money = extractMoneyDelta(text);
  if (money !== 0) {
    next = input.appendLog(
      next,
      `Caisse : ${money > 0 ? '+' : ''}${money} €.`,
    );
    return input.addMoney(next, input.playerId, money, { toPot: money < 0 });
  }

  return next;
}




