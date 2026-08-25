import type { GameStateEntity } from '../../../core/application/models/game-state.model';
import { stringOrEmpty } from '@common/utils/public-api';
import type {
  MnemoAdminPage,
  MnemoPrompt,
  MnemoQuestionStatus,
  MnemoQuizMetadata,
} from './model/mnemo-quiz.model';
import type { MnemoQuizStore } from './application/ports/mnemo-quiz-store.port';

export function applyArcheMnemoAdminAction(input: {
  state: GameStateEntity;
  type: string;
  payload: Record<string, unknown>;
  meta: MnemoQuizMetadata;
  store: MnemoQuizStore;
  back: (view: MnemoAdminPage) => MnemoAdminPage;
  normalizeStatus: (value: unknown) => MnemoQuestionStatus;
  statusLabel: (value: unknown) => string;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
}): GameStateEntity | null {
  if (input.type === 'mnemo_open_admin') {
    return {
      ...input.state,
      metadata: {
        ...input.meta,
        adminView: { page: 'categories' },
        prompt: null,
      },
    };
  }

  if (input.type === 'mnemo_open_all_questions') {
    const raw = stringOrEmpty(input.payload.status).trim() || 'all';
    const status =
      raw === 'validated' ||
      raw === 'pending' ||
      raw === 'to_edit' ||
      raw === 'trash'
        ? (raw as MnemoQuestionStatus)
        : 'all';
    return {
      ...input.state,
      metadata: {
        ...input.meta,
        adminView: { page: 'all_questions', status },
        prompt: null,
      },
    };
  }

  if (input.type === 'mnemo_back') {
    const back = input.back(input.meta.adminView);
    return {
      ...input.state,
      metadata: { ...input.meta, adminView: back, prompt: null },
    };
  }

  if (input.type === 'mnemo_open_add_category') {
    const prompt: MnemoPrompt = {
      type: 'text_prompt',
      title: 'Ajouter une catégorie',
      label: 'Nom de catégorie',
      actionType: 'mnemo_add_category',
      payloadKey: 'name',
      cancelActionType: 'mnemo_prompt_cancel',
    };
    return { ...input.state, metadata: { ...input.meta, prompt } };
  }

  if (input.type === 'mnemo_add_category') {
    try {
      input.store.createCategory(stringOrEmpty(input.payload.name));
      return input.appendLog(
        { ...input.state, metadata: { ...input.meta, prompt: null } },
        'Catégorie ajoutée.',
      );
    } catch (err) {
      return input.appendLog(
        { ...input.state, metadata: { ...input.meta, prompt: null } },
        `Erreur: ${(err as Error).message}`,
      );
    }
  }

  if (input.type === 'mnemo_open_rename_category') {
    const categoryId = stringOrEmpty(input.payload.categoryId).trim();
    const category = input.store
      .listCategories()
      .find((entry) => entry.id === categoryId);
    if (!category) return input.state;
    const prompt: MnemoPrompt = {
      type: 'text_prompt',
      title: 'Renommer une catégorie',
      label: 'Nouveau nom',
      actionType: 'mnemo_rename_category',
      payloadKey: 'name',
      initialText: category.name,
      cancelActionType: 'mnemo_prompt_cancel',
    };
    return {
      ...input.state,
      metadata: {
        ...input.meta,
        prompt,
        adminView: { page: 'category', categoryId },
      },
    };
  }

  if (input.type === 'mnemo_rename_category') {
    const view = input.meta.adminView;
    if (view.page !== 'category') return input.state;
    try {
      input.store.renameCategory(
        view.categoryId,
        stringOrEmpty(input.payload.name),
      );
      return input.appendLog(
        { ...input.state, metadata: { ...input.meta, prompt: null } },
        'Catégorie renommée.',
      );
    } catch (err) {
      return input.appendLog(
        { ...input.state, metadata: { ...input.meta, prompt: null } },
        `Erreur: ${(err as Error).message}`,
      );
    }
  }

  if (input.type === 'mnemo_delete_category') {
    const categoryId = stringOrEmpty(input.payload.categoryId).trim();
    try {
      input.store.deleteCategory(categoryId);
      return input.appendLog(
        {
          ...input.state,
          metadata: {
            ...input.meta,
            adminView: { page: 'categories' },
            prompt: null,
          },
        },
        'Catégorie supprimée (questions mises à la corbeille).',
      );
    } catch (err) {
      return input.appendLog(
        { ...input.state, metadata: { ...input.meta, prompt: null } },
        `Erreur: ${(err as Error).message}`,
      );
    }
  }

  if (input.type === 'mnemo_open_category') {
    const categoryId = stringOrEmpty(input.payload.categoryId).trim();
    if (
      !input.store.listCategories().some((entry) => entry.id === categoryId)
    ) {
      return input.state;
    }
    return {
      ...input.state,
      metadata: {
        ...input.meta,
        adminView: { page: 'category', categoryId },
        prompt: null,
      },
    };
  }

  if (input.type === 'mnemo_open_add_question') {
    const categoryId = stringOrEmpty(input.payload.categoryId).trim();
    const category = input.store
      .listCategories()
      .find((entry) => entry.id === categoryId);
    if (!category) return input.state;
    const prompt: MnemoPrompt = {
      type: 'config_prompt',
      title: `Ajouter une question (${category.name})`,
      actionType: 'mnemo_add_question',
      cancelActionType: 'mnemo_prompt_cancel',
      fields: [
        { key: 'question', label: 'Question', kind: 'text', initialText: '' },
        {
          key: 'correct',
          label: 'Bonne réponse',
          kind: 'text',
          initialText: '',
        },
        {
          key: 'wrong1',
          label: 'Mauvaise réponse 1',
          kind: 'text',
          initialText: '',
        },
        {
          key: 'wrong2',
          label: 'Mauvaise réponse 2',
          kind: 'text',
          initialText: '',
        },
        {
          key: 'wrong3',
          label: 'Mauvaise réponse 3',
          kind: 'text',
          initialText: '',
        },
      ],
    };
    return {
      ...input.state,
      metadata: {
        ...input.meta,
        prompt,
        adminView: { page: 'category', categoryId },
      },
    };
  }

  if (input.type === 'mnemo_add_question') {
    const view = input.meta.adminView;
    if (view.page !== 'category') return input.state;
    try {
      input.store.createQuestion({
        categoryId: view.categoryId,
        question: stringOrEmpty(input.payload.question),
        correct: stringOrEmpty(input.payload.correct),
        wrong1: stringOrEmpty(input.payload.wrong1),
        wrong2: stringOrEmpty(input.payload.wrong2),
        wrong3: stringOrEmpty(input.payload.wrong3),
        status: 'validated',
      });
      return input.appendLog(
        { ...input.state, metadata: { ...input.meta, prompt: null } },
        'Question ajoutée.',
      );
    } catch (err) {
      return input.appendLog(
        { ...input.state, metadata: { ...input.meta, prompt: null } },
        `Erreur: ${(err as Error).message}`,
      );
    }
  }

  if (input.type === 'mnemo_open_questions') {
    const categoryId = stringOrEmpty(input.payload.categoryId).trim();
    const status = input.normalizeStatus(input.payload.status);
    return {
      ...input.state,
      metadata: {
        ...input.meta,
        adminView: { page: 'questions', categoryId, status },
        prompt: null,
      },
    };
  }

  if (input.type === 'mnemo_open_question') {
    const questionId = stringOrEmpty(input.payload.questionId).trim();
    const categoryId = stringOrEmpty(input.payload.categoryId).trim();
    return {
      ...input.state,
      metadata: {
        ...input.meta,
        adminView: { page: 'question', categoryId, questionId },
        prompt: null,
      },
    };
  }

  if (input.type === 'mnemo_set_question_status') {
    const questionId = stringOrEmpty(input.payload.questionId).trim();
    const status = input.normalizeStatus(input.payload.status);
    try {
      input.store.updateQuestion(questionId, { status });
      return input.appendLog(
        { ...input.state, metadata: { ...input.meta, prompt: null } },
        `Statut mis à jour (${input.statusLabel(status)}).`,
      );
    } catch (err) {
      return input.appendLog(
        { ...input.state, metadata: { ...input.meta, prompt: null } },
        `Erreur: ${(err as Error).message}`,
      );
    }
  }

  if (input.type === 'mnemo_open_edit_question') {
    const questionId = stringOrEmpty(input.payload.questionId).trim();
    const question = input.store
      .listQuestions()
      .find((entry) => entry.id === questionId);
    if (!question) return input.state;
    const prompt: MnemoPrompt = {
      type: 'config_prompt',
      title: 'Modifier la question',
      actionType: 'mnemo_edit_question',
      cancelActionType: 'mnemo_prompt_cancel',
      fields: [
        {
          key: 'questionId',
          label: 'Id (ne pas modifier)',
          kind: 'text',
          initialText: question.id,
        },
        {
          key: 'question',
          label: 'Question',
          kind: 'text',
          initialText: question.question,
        },
        {
          key: 'correct',
          label: 'Bonne réponse',
          kind: 'text',
          initialText: question.correct,
        },
        {
          key: 'wrong1',
          label: 'Mauvaise réponse 1',
          kind: 'text',
          initialText: question.wrong1,
        },
        {
          key: 'wrong2',
          label: 'Mauvaise réponse 2',
          kind: 'text',
          initialText: question.wrong2,
        },
        {
          key: 'wrong3',
          label: 'Mauvaise réponse 3',
          kind: 'text',
          initialText: question.wrong3,
        },
      ],
    };
    return { ...input.state, metadata: { ...input.meta, prompt } };
  }

  if (input.type === 'mnemo_edit_question') {
    const questionId = stringOrEmpty(input.payload.questionId).trim();
    try {
      input.store.updateQuestion(questionId, {
        question: stringOrEmpty(input.payload.question),
        correct: stringOrEmpty(input.payload.correct),
        wrong1: stringOrEmpty(input.payload.wrong1),
        wrong2: stringOrEmpty(input.payload.wrong2),
        wrong3: stringOrEmpty(input.payload.wrong3),
      });
      return input.appendLog(
        { ...input.state, metadata: { ...input.meta, prompt: null } },
        'Question modifiée.',
      );
    } catch (err) {
      return input.appendLog(
        { ...input.state, metadata: { ...input.meta, prompt: null } },
        `Erreur: ${(err as Error).message}`,
      );
    }
  }

  return null;
}
