<?php

namespace App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Service;

use App\Module\Game\Entity\Room;
use App\Module\Game\Service\Initializer\GameInitializationResult;
use App\Module\Game\Service\Initializer\GameInitializerInterface;

final class PanierExpressGameInitializer implements GameInitializerInterface
{
    public function __construct(private readonly PanierExpressGameService $gameService)
    {
    }

    public function supports(Room $room): bool
    {
        return $room->getGameType() === 'panier-express';
    }

    public function initialize(Room $room): GameInitializationResult
    {
        $state = $this->gameService->defaultState($room);
        // Le démarrage explicite (room.start) place l'état en mode "playing".
        $state = $this->gameService->startState($state);

        return new GameInitializationResult(
            $state,
            $this->gameService->currentRound($state)
        );
    }
}
