import { GameContentValidationError } from '../contracts/game-domain.errors';
import { withAuthoringPath } from '../contracts/authoring-origin';

export function assertStaticObject(value: object, path: string): void {
  const prototype: object | null = Reflect.getPrototypeOf(value);
  if (
    prototype !== null &&
    prototype !== Object.prototype &&
    !(
      Object.getPrototypeOf(prototype) === null &&
      prototype.constructor?.name === 'Object'
    )
  ) {
    throw new GameContentValidationError(`Objet non statique dans ${path}`);
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      !descriptor ||
      typeof key === 'symbol' ||
      descriptor.get ||
      descriptor.set
    ) {
      throw new GameContentValidationError(
        `Propriete non statique dans ${path}`,
      );
    }
  }
}

export function validateStaticQuestion(
  question: Record<string, unknown>,
  path: string,
): void {
  const fail = (field: string): never => {
    throw withAuthoringPath(
      new GameContentValidationError(`Question invalide dans ${path}`),
      `${path}.${field}`,
    );
  };
  const choices = question.choices;
  if (!Array.isArray(choices) || choices.length < 2) return fail('choices');
  for (const [index, choice] of choices.entries())
    if (typeof choice !== 'string' || !choice.trim() || choice.length > 2_000)
      fail(`choices[${index}]`);
  if (
    !Number.isSafeInteger(question.answerIndex) ||
    Number(question.answerIndex) < 0 ||
    Number(question.answerIndex) >= choices.length
  )
    fail('answerIndex');
}
