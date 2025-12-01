<?php

namespace App\Module\Game\Exchange;

final class ExchangePresenter
{
    /**
     * @return array{playerId:int|string|null}
     */
    public function presentPending(ExchangePending $pending): array
    {
        return [
            'playerId' => $pending->playerId(),
        ];
    }

    /**
     * @return array<string,mixed>
     */
    public function presentCard(ExchangeCard $card): array
    {
        return [
            'id' => $card->id(),
            'title' => $card->title(),
            'description' => $card->description(),
            'effect' => $card->description(),
            'metadata' => $card->metadata(),
        ];
    }
}
