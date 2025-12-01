<?php

namespace App\Module\Game\Shared\Dice;

/**
 * R�sultat d'un lancer de d�s.
 */
final class DiceResult
{
    /**
     * @param int[] $values
     */
    public function __construct(
        public readonly array $values,
        public readonly int $total,
    ) {
    }
}
