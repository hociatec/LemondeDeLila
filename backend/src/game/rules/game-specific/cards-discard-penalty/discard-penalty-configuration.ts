import { defineConfiguration, gameInput } from '../../../engine/sdk/public-api';
import type { GamePhaseSet } from '../../../engine/runtime/kits/phase-kit';
import type {
  DiscardPenaltyCardsConfig,
  DiscardPenaltyCardsProgram,
} from './program';
import { rejectRule } from '../../../core/domain/errors/game-domain.errors';
type State = Record<string, never>;
export function discardPenaltyConfiguration(
  program: DiscardPenaltyCardsProgram,
  phases: GamePhaseSet<State, 'setup' | 'turn' | 'return' | 'pause'>,
) {
  return defineConfiguration<State, DiscardPenaltyCardsConfig>({
    input: gameInput.object({
      loseAtScore: gameInput.label(
        "Seuil de jetons d'élimination",
        gameInput.number({ integer: true, min: 5, max: 200 }),
      ),
      roundPauseSeconds: gameInput.label(
        'Pause entre les manches en secondes',
        gameInput.number({ integer: true, min: 0, max: 120 }),
      ),
      allowPlayAfterDraw: gameInput.label(
        'Autoriser à jouer après avoir pioché',
        gameInput.boolean(),
      ),
      startingHandSize: gameInput.label(
        'Nombre de cartes initiales',
        gameInput.number({ integer: true, min: 1, max: 20 }),
      ),
      copiesPerCardValue: gameInput.label(
        'Exemplaires de chaque valeur',
        gameInput.number({ integer: true, min: 1, max: 20 }),
      ),
      returnTokenFromRound: gameInput.label(
        'Rendre un jeton à partir de la manche',
        gameInput.number({ integer: true, min: 1, max: 50 }),
      ),
    }),
    defaults: program.defaults,
    phase: phases.initialPhase,
    permission: 'owner',
    ui: {
      title: 'Configuration des cartes de pénalité',
      submitLabel: 'Démarrer la partie',
    },
    validate: ({ config: values, ctx }) => {
      const requiredCards = ctx.players.count() * values.startingHandSize + 1;
      const availableCards =
        values.copiesPerCardValue * program.orderedValues.length;
      if (requiredCards > availableCards) {
        rejectRule(
          `Paquet insuffisant : ${requiredCards} cartes sont nécessaires pour distribuer ${values.startingHandSize} carte(s) à ${ctx.players.count()} joueur(s) et retourner la première carte, mais la configuration n'en fournit que ${availableCards}.`,
        );
      }
      return true;
    },
    onConfigured: ({ ctx }) => {
      phases.transition(ctx, 'turn');
      ctx.round.start(ctx.players.active()[0]?.id);
    },
  });
}
