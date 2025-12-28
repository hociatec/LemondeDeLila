import { PanierExpressTile } from './panier-express-state.entity';

export type PanierExpressBoardJsonV1 = {
  version: 1;
  tiles: PanierExpressTile[];
};

export type PanierExpressCoursesJsonV1 = {
  version: 1;
  items: string[];
};

export type PanierExpressStandsJsonV1 = {
  version: 1;
  stands: Array<{ id: string; items: string[] }>;
};

export type PanierExpressEventsJsonV1 = {
  version: 1;
  events: string[];
};

export type PanierExpressExchangesJsonV1 = {
  version: 1;
  exchanges: string[];
};

export type PanierExpressQuizCardDef = {
  id: string;
  question: string;
  answer: string;
  choices: string[];
};

export type PanierExpressQuizzesJsonV1 = {
  version: 1;
  quizzes: PanierExpressQuizCardDef[];
};

export type PanierExpressShoppingListsJsonV1 = {
  version: 1;
  lists: string[][];
};
