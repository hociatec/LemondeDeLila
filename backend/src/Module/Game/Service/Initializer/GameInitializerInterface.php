<?php

namespace App\Module\Game\Service\Initializer;

use App\Module\Game\Entity\Room;

interface GameInitializerInterface
{
    public function supports(Room $room): bool;

    public function initialize(Room $room): GameInitializationResult;
}
