<?php

namespace App\Module\Game\Service\Initializer;

final class GameInitializationResult
{
    public function __construct(
        private array $state,
        private int $currentRound = 1
    ) {
    }

    public function getState(): array
    {
        return $this->state;
    }

    public function getCurrentRound(): int
    {
        return $this->currentRound;
    }
}
