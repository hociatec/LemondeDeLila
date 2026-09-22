export type FamilyRequestCard =
  | {
      id: string;
      type: 'family';
      familyId: string;
      familyName: string;
      memberName: string;
    }
  | {
      id: string;
      type: 'quiz';
      question: string;
      choices: readonly string[];
      answerIndex: number;
    }
  | { id: string; type: 'nature'; description: string; delta: number };

export type FamilyRequestProgram = {
  deckId: string;
  handId: string;
  setsId: string;
  cards: readonly FamilyRequestCard[];
  pollutionCounter: string;
  pollutionLimit: number;
  familiesToWin: number;
  pollutionFinishReason: string;
  familyFinishReason: string;
  eventNamespace: string;
};
