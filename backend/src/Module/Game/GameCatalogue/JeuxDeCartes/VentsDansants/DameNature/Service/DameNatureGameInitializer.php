<?php

namespace App\Module\Game\GameCatalogue\JeuxDeCartes\VentsDansants\DameNature\Service;

use App\Module\Game\Entity\Room;
use App\Module\Game\Service\Initializer\GameInitializationResult;
use App\Module\Game\Service\Initializer\GameInitializerInterface;

final class DameNatureGameInitializer implements GameInitializerInterface
{
    public function __construct(private readonly DameNatureGameService $service)
    {
    }

    public function supports(Room $room): bool
    {
        return $room->getGameType() === 'dame-nature';
    }

    public function initialize(Room $room): GameInitializationResult
    {
        $state = $this->service->defaultState($room);
        $state = $this->service->startState($state);

        return new GameInitializationResult(
            $state,
            $this->service->currentRound($state)
        );
    }
}
