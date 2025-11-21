<?php

namespace App\Module\Game\Shared\Dice;

use App\Module\Game\Shared\Deck\Randomizer;
use App\Module\Game\Shared\Deck\NativeRandomizer;

/**
 * Service de lancer de d�s.
 */
final class DiceService
{
    private Randomizer $randomizer;

    public function __construct(?Randomizer $randomizer = null)
    {
        $this->randomizer = $randomizer ?: new NativeRandomizer();
    }

    public function roll(DiceRoll $config): DiceResult
    {
        $values = [];
        for ($i = 0; $i < $config->diceCount; $i++) {
            $values[] = $this->rollOne($config->faces);
        }
        $total = array_sum($values) + $config->modifier;
        return new DiceResult($values, $total);
    }

    private function rollOne(int $faces): int
    {
        $faces = max(2, $faces);
        return random_int(1, $faces);
    }
}
