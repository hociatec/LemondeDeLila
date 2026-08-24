export const ABSURDISSIMES_DECK_PORT = Symbol('ABSURDISSIMES_DECK_PORT');

export interface AbsurdissimesDeckPort {
  getWhiteCards(): string[];
  getBlackCards(): string[];
}
