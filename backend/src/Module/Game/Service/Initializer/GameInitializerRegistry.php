<?php

namespace App\Module\Game\Service\Initializer;

use App\Module\Game\Entity\Room;

final class GameInitializerRegistry
{
    /**
     * @param iterable<GameInitializerInterface> $initializers
     */
    public function __construct(private iterable $initializers)
    {
    }

    public function initialize(Room $room): GameInitializationResult
    {
        foreach ($this->initializers as $initializer) {
            if ($initializer->supports($room)) {
                return $initializer->initialize($room);
            }
        }

        return new GameInitializationResult([
            'type' => $room->getGameType() ?? 'unknown',
        ]);
    }
}
