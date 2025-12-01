<?php

namespace App\Module\Game\Shared\Deck;

final class Card
{
    public function __construct(
        public readonly int|string $id,
        public readonly string $type,
        public readonly mixed $payload = null,
    ) {
    }
}
