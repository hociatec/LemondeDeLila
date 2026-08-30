/** Stable authoring surface for concrete games. No Nest or infrastructure API. */
export * from '../runtime/public-api';
export {
  GameDomainError,
  GameRuleViolationError,
  rejectContent,
} from '../../core/domain/errors/game-domain.errors';
export * from '../../core/testing/public-api';
