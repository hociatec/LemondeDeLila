<?php

namespace App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Service\Support;

use App\Module\Game\Shared\Turn\TurnManager;
use App\Module\Game\Shared\Turn\TurnState;

final class PanierExpressTurnCoordinator
{
    private TurnState $turnState;
    private TurnManager $manager;
    private int $playerCount;

    private function __construct(TurnState $turnState, int $playerCount)
    {
        $this->turnState = $turnState;
        $this->playerCount = max(0, $playerCount);
        $this->manager = new TurnManager($this->turnState);
    }

    public static function forState(array &$state, int $currentPlayerIndex): self
    {
        return new self(
            PanierExpressTurnStateFactory::build($state, $currentPlayerIndex),
            count($state['players'] ?? [])
        );
    }

    public function nextIndex(): int
    {
        if ($this->playerCount === 0) {
            $this->turnState->index = 0;
            return 0;
        }

        return $this->manager->next($this->playerCount);
    }

    public function syncSkips(array &$players): void
    {
        foreach ($players as $idx => &$player) {
            $player['skipTurns'] = (int) ($this->turnState->skips[$idx] ?? 0);
        }
        unset($player);
    }

    public function resetDirection(): void
    {
        $this->turnState->direction = 1;
    }

    public function getDirection(): int
    {
        return $this->turnState->direction;
    }

    public function getRound(): int
    {
        return $this->turnState->round;
    }

    public function getTurnState(): TurnState
    {
        return $this->turnState;
    }
}
