<?php

namespace App\Module\Game\Exchange;

final class ExchangePending
{
    public function __construct(
        private readonly int|string|null $playerId,
        private readonly ExchangeCard $card
    ) {
    }

    public function playerId(): int|string|null
    {
        return $this->playerId;
    }

    public function card(): ExchangeCard
    {
        return $this->card;
    }
}
