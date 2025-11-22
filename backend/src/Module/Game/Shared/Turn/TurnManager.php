<?php

namespace App\Module\Game\Shared\Turn;

/**
 * Gestionnaire générique des tours en round-robin avec sens, skip, extra-turn.
 */
final class TurnManager
{
    private TurnState $state;

    public function __construct(TurnState $state)
    {
        $this->state = $state;
    }

    public function state(): TurnState
    {
        return $this->state;
    }

    /**
     * Avance au prochain joueur en tenant compte des skips et de la direction.
     * @param int $playerCount
     * @return int nouvel index courant
     */
    public function next(int $playerCount): int
    {
        if ($playerCount <= 0) {
            $this->state->index = 0;
            return 0;
        }

        // Extra-turn prioritaire : on reste sur le même index une fois si défini.
        if ($this->state->extraTurnFor !== null && $this->state->extraTurnFor === $this->state->index) {
            $this->state->extraTurnFor = null;
            return $this->state->index;
        }

        $dir = $this->state->direction === -1 ? -1 : 1;
        $idx = $this->state->index;
        $round = $this->state->round;

        $safety = 0;
        do {
            $idx = ($idx + $dir + $playerCount) % $playerCount;
            if ($dir === 1 && $idx === 0) {
                $round++;
            } elseif ($dir === -1 && $idx === ($playerCount - 1)) {
                $round++;
            }
            $safety++;
            if ($safety > $playerCount + 1) {
                break;
            }
        } while ($this->consumeSkip($idx));

        $this->state->index = $idx;
        $this->state->round = $round;
        return $idx;
    }

    /**
     * Décrémente un skip s’il existe pour ce joueur. Retourne true si le tour est sauté.
     */
    private function consumeSkip(int $playerIndex): bool
    {
        if (($this->state->skips[$playerIndex] ?? 0) > 0) {
            $this->state->skips[$playerIndex]--;
            if ($this->state->skips[$playerIndex] <= 0) {
                unset($this->state->skips[$playerIndex]);
            }
            return true;
        }
        return false;
    }

    public function addSkip(int $playerIndex, int $count = 1): void
    {
        if ($count <= 0) {
            return;
        }
        $this->state->skips[$playerIndex] = ($this->state->skips[$playerIndex] ?? 0) + $count;
    }

    public function grantExtraTurn(): void
    {
        $this->state->extraTurnFor = $this->state->index;
    }

    public function invertDirection(): void
    {
        $this->state->direction = $this->state->direction === -1 ? 1 : -1;
    }
}
