<?php

namespace App\Module\Game\Shared\Deck;

final class NativeRandomizer implements Randomizer
{
    public function shuffle(array $items): array
    {
        $copy = $items;
        shuffle($copy);
        return $copy;
    }
}
