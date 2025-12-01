<?php

namespace App\Module\Game\Shared\Deck;

interface Randomizer
{
    public function shuffle(array $items): array;
}
