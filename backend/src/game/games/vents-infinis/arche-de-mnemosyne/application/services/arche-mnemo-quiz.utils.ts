import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import { resolvePlayerNameFromState } from '../../../../../application/helpers/player-name.helper';
import { stringOrEmpty } from '@common/utils/string-value.utils';
import type { MnemoQuizMetadata } from '../../model/mnemo-quiz.model';
import type { MnemoQuizStore } from '../ports/mnemo-quiz-store.port';
import type { ArcheMnemoStateService } from './arche-mnemo-state.service';
import type { RandomService } from '../../../../../application/services/random.service';
import type { TurnFlowService } from '../../../../../application/services/turn-flow.service';

const ARCHE_PLAYER_NAME_OPTIONS = {
  collapseWhitespace: true,
  unwrapDoubleQuotes: true,
} as const;

type ArcheQuizDeps = {
  stateSvc: ArcheMnemoStateService;
  store: MnemoQuizStore;
  random: RandomService;
  turns: TurnFlowService;
  now: () => number;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
};

export function resolveArcheQuizIfReady(
  deps: ArcheQuizDeps,
  state: GameStateEntity,
  force = false,
  timedOutPlayerIds: number[] = [],
): GameStateEntity {
  const meta = deps.stateSvc.getMeta(state);
  const q = meta.currentQuestion;
  if (!q) return state;

  const currentRoundRaw = Number(state?.round ?? 1);
  const currentRound =
    Number.isFinite(currentRoundRaw) && currentRoundRaw > 0
      ? Math.trunc(currentRoundRaw)
      : 1;

  const players = Array.isArray(state.players) ? state.players : [];
  const playerIds = players
    .map((p) => Number(p?.id))
    .filter((id: number) => Number.isFinite(id));
  if (!playerIds.length) return state;

  const answers = deps.stateSvc.getQuizAnswers(meta);
  const allAnswered = playerIds.every((id) => answers[id] != null);
  if (!force && !allAnswered) {
    return state;
  }

  const endedBecauseAllAnswered = !force && allAnswered;

  const correctIds = playerIds.filter((id) => {
    const idx = Number(answers[id]);
    if (!Number.isFinite(idx)) return false;
    const choice = q.choices[idx] ?? '';
    return choice === q.correctChoice;
  });
  const answeredIds = playerIds.filter((id) => answers[id] != null);
  const wrongAnsweredIds = answeredIds.filter((id) => !correctIds.includes(id));

  const correctSoloPoints = deps.stateSvc.clampInt(
    meta.config?.correctSoloPoints,
    -50,
    50,
    2,
  );
  const correctMultiPoints = deps.stateSvc.clampInt(
    meta.config?.correctMultiPoints,
    -50,
    50,
    1,
  );
  const wrongPoints = deps.stateSvc.clampInt(
    meta.config?.wrongPoints,
    -50,
    50,
    0,
  );
  const timeoutPoints = deps.stateSvc.clampInt(
    meta.config?.timeoutPoints,
    -50,
    50,
    -1,
  );

  const nextScores = { ...(meta.scoresByPlayerId ?? {}) } as Record<
    number,
    number
  >;
  let next = state;

  if (correctIds.length === 0) {
    next = deps.appendLog(next, `Personne n'a trouvÃƒÂ© la bonne rÃƒÂ©ponse.`);
  } else if (correctIds.length === 1) {
    const id = correctIds[0];
    nextScores[id] = (nextScores[id] ?? 0) + correctSoloPoints;
    const msg =
      correctSoloPoints === 0
        ? `${resolvePlayerNameFromState(state, id, ARCHE_PLAYER_NAME_OPTIONS)} ne marque aucun point.`
        : correctSoloPoints > 0
          ? `${resolvePlayerNameFromState(state, id, ARCHE_PLAYER_NAME_OPTIONS)} gagne +${correctSoloPoints} points.`
          : `${resolvePlayerNameFromState(state, id, ARCHE_PLAYER_NAME_OPTIONS)} perd ${Math.abs(correctSoloPoints)} points.`;
    next = deps.appendLog(next, msg);
  } else {
    for (const id of correctIds) {
      nextScores[id] = (nextScores[id] ?? 0) + correctMultiPoints;
    }
    const labels = correctIds
      .map((id) => resolvePlayerNameFromState(state, id, ARCHE_PLAYER_NAME_OPTIONS))
      .join(', ');
    const msg =
      correctMultiPoints === 0
        ? `Plusieurs bonnes rÃƒÂ©ponses (${labels}) : aucun point.`
        : correctMultiPoints > 0
          ? `Plusieurs bonnes rÃƒÂ©ponses (${labels}) : +${correctMultiPoints} points chacun.`
          : `Plusieurs bonnes rÃƒÂ©ponses (${labels}) : -${Math.abs(correctMultiPoints)} points chacun.`;
    next = deps.appendLog(next, msg);
  }

  if (wrongAnsweredIds.length && wrongPoints !== 0) {
    for (const id of wrongAnsweredIds) {
      nextScores[id] = (nextScores[id] ?? 0) + wrongPoints;
    }
  }

  if (force) {
    const timedOut = (Array.isArray(timedOutPlayerIds) ? timedOutPlayerIds : [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id));
    const unique = [...new Set(timedOut)]
      .filter((id) => playerIds.includes(id))
      .filter((id) => answers[id] == null);
    if (unique.length) {
      for (const id of unique) {
        nextScores[id] = (nextScores[id] ?? 0) + timeoutPoints;
      }
      const labels = unique
        .map((id) => resolvePlayerNameFromState(state, id, ARCHE_PLAYER_NAME_OPTIONS))
        .join(', ');
      const msg =
        timeoutPoints === 0
          ? `Temps ÃƒÂ©coulÃƒÂ©: ${labels} ne marque aucun point.`
          : timeoutPoints > 0
            ? `Temps ÃƒÂ©coulÃƒÂ©: ${labels} gagne +${timeoutPoints} points.`
            : `Temps ÃƒÂ©coulÃƒÂ©: ${labels} perd ${Math.abs(timeoutPoints)} points.`;
      next = deps.appendLog(next, msg);
    }
  }

  const target = meta.config?.targetPoints ?? 20;
  const willFinish = playerIds.some((id) => Number(nextScores[id] ?? 0) >= target);

  if (force || endedBecauseAllAnswered) {
    for (const id of playerIds) {
      const idx = answers[id];
      const who = resolvePlayerNameFromState(state, id, ARCHE_PLAYER_NAME_OPTIONS);
      if (idx == null) {
        next = deps.appendLog(next, `${who} rÃƒÂ©pond : Temps ÃƒÂ©coulÃƒÂ©.`);
        continue;
      }
      const choice = q.choices[Number(idx)] ?? '';
      const correct = choice === q.correctChoice;
      next = deps.appendLog(
        next,
        correct
          ? `${who} rÃƒÂ©pond : Bonne rÃƒÂ©ponse.`
          : `${who} rÃƒÂ©pond : Mauvaise rÃƒÂ©ponse.`,
      );
    }

    if (wrongAnsweredIds.length && correctIds.length > 0) {
      next = deps.appendLog(
        next,
        `La bonne rÃƒÂ©ponse ÃƒÂ©tait : ${q.correctChoice}.`,
      );
    }
    next = deps.appendLog(next, `Fin de la manche ${currentRound}.`);
    if (!willFinish) {
      const interSeconds = deps.stateSvc.clampInt(
        meta.config?.interQuestionSeconds,
        1,
        60,
        15,
      );
      next = deps.appendLog(
        next,
        `Prochaine question dans ${interSeconds} secondes. Appuyez sur Espace.`,
      );
    }
  }

  const interQuestionSeconds = deps.stateSvc.clampInt(
    meta.config?.interQuestionSeconds,
    1,
    60,
    15,
  );
  const afterMeta: MnemoQuizMetadata = {
    ...meta,
    scoresByPlayerId: nextScores,
    currentQuestion: null,
    quizAnswersByPlayerId: {},
    quizDeadlineAtMs: null,
    interQuestionUntilMs: willFinish
      ? null
      : deps.now() + Math.max(1, interQuestionSeconds) * 1000,
  };

  const reached = playerIds
    .map((id) => ({
      id,
      score: Number(afterMeta.scoresByPlayerId?.[id] ?? 0),
    }))
    .filter((x) => x.score >= target);

  if (reached.length) {
    reached.sort((a, b) => b.score - a.score || a.id - b.id);
    const winnerId = reached[0].id;
    const finished = deps.appendLog(
      next,
      `${resolvePlayerNameFromState(next, winnerId, ARCHE_PLAYER_NAME_OPTIONS)} a gagnÃƒÂ© !`,
    );
    return {
      ...finished,
      status: 'finished',
      round: currentRound,
      metadata: { ...afterMeta, winnerId },
    };
  }

  const cleared: GameStateEntity = {
    ...next,
    metadata: afterMeta,
  };
  const advanced = deps.turns.advanceTurn(cleared);
  if (force || endedBecauseAllAnswered) {
    return {
      ...advanced,
      round: currentRound + 1,
      metadata: afterMeta,
      pending: null,
    };
  }
  return advanced;
}

export function drawNextArcheQuestionOrStay(
  deps: ArcheQuizDeps,
  state: GameStateEntity,
): GameStateEntity {
  const meta = deps.stateSvc.getMeta(state);
  const categories = deps.store.listCategories();

  const all = deps.store
    .listQuestions()
    .filter((q) => stringOrEmpty(q.status) !== 'trash');

  const selected =
    meta.selectedCategoryId &&
    categories.some((c) => c.id === meta.selectedCategoryId)
      ? meta.selectedCategoryId
      : null;

  const pool = all.filter((q) => (selected ? q.categoryId === selected : true));

  if (categories.length === 0) {
    return deps.appendLog(
      state,
      'Aucune catÃƒÂ©gorie : utilisez Administration > Ajouter une catÃƒÂ©gorie.',
    );
  }
  if (all.length === 0) {
    return deps.appendLog(
      state,
      'Aucune question disponible : utilisez Administration > Ajouter une question.',
    );
  }

  if (pool.length === 0 && selected) {
    return drawNextArcheQuestionOrStay(deps, {
      ...state,
      metadata: { ...meta, selectedCategoryId: null },
    });
  }

  const used = new Set(meta.usedQuestionIds ?? []);
  const remaining = pool.filter((q) => !used.has(q.id));
  const pickFrom = remaining.length ? remaining : pool;
  const pick = deps.random.pickIndex(meta, pickFrom.length);
  const picked = pickFrom[pick.index];
  let rngMeta = pick.meta;

  try {
    if (picked.status !== 'validated') {
      deps.store.updateQuestion(picked.id, { status: 'validated' });
    }
  } catch {
    // best effort
  }

  const normalizeKey = (value: unknown) =>
    stringOrEmpty(value).trim().toLocaleLowerCase('fr');

  const rawChoices = [picked.correct, picked.wrong1, picked.wrong2, picked.wrong3].map(
    (s) => stringOrEmpty(s).trim(),
  );

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const c of rawChoices) {
    const key = normalizeKey(c);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
  }
  if (unique.length < 4) {
    const candidateQuestions = [
      ...all.filter((q) => q.categoryId === picked.categoryId),
      ...all,
    ];
    const candidatesRaw = candidateQuestions
      .flatMap((q) => [q.correct, q.wrong1, q.wrong2, q.wrong3])
      .map((s) => stringOrEmpty(s).trim())
      .filter((s) => s.length > 0);
    const candidatesShuffled = deps.random.shuffle(rngMeta, candidatesRaw);
    rngMeta = candidatesShuffled.meta;
    for (const c of candidatesShuffled.values) {
      if (unique.length >= 4) break;
      const key = normalizeKey(c);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      unique.push(c);
    }
  }
  while (unique.length < 4 && rawChoices[unique.length]) {
    unique.push(rawChoices[unique.length]);
  }

  const shuffled = deps.random.shuffle(rngMeta, unique.length ? unique : rawChoices);
  rngMeta = shuffled.meta;
  const choices = shuffled.values;
  const currentQuestion = {
    id: picked.id,
    categoryId: picked.categoryId,
    question: picked.question,
    choices,
    correctChoice: String(picked.correct ?? '').trim(),
  };

  const nextUsed = remaining.length ? [...used, picked.id] : [picked.id];

  const timerSeconds = Number(rngMeta.config?.timerSeconds ?? 30);
  const useTimer = Boolean(rngMeta.config?.useTimer);
  const quizDeadlineAtMs = useTimer
    ? deps.now() + Math.max(1, timerSeconds) * 1000
    : null;

  return {
    ...state,
    metadata: {
      ...rngMeta,
      usedQuestionIds: nextUsed,
      currentQuestion,
      quizAnswersByPlayerId: {},
      quizDeadlineAtMs,
    },
  };
}
