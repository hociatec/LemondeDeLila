/** Single-consumer JSON authoring extension; prefer shared effects and patterns for new rules. */
export type NatureFamiliesCard =
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

export type NatureFamiliesProgram = {
  deckId: string;
  handId: string;
  setsId: string;
  cards: readonly NatureFamiliesCard[];
  pollutionCounter: string;
  pollutionLimit: number;
  familiesToWin: number;
  pollutionFinishReason: string;
  familyFinishReason: string;
  eventNamespace: string;
};
