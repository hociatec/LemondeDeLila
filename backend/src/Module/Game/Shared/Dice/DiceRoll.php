<?php

namespace App\Module\Game\Shared\Dice;

/**
 * Configuration d'un lancer de d�.
 */
final class DiceRoll
{
    public function __construct(
        public readonly int $diceCount = 1,
        public readonly int $faces = 6,
        public readonly int $modifier = 0,
    ) {
    }
}
