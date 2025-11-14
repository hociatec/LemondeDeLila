<?php

namespace App\Module\Game\Service;

use App\Module\Game\Entity\Room;
use App\Module\Game\Entity\RoomBot;

final class ParticipantResolver
{
    /**
     * @return Participant[]
     */
    public function resolve(Room $room): array
    {
        $participants = [];

        foreach ($room->getPlayers() as $user) {
            $participants[] = new Participant(
                (int) $user->getId(),
                (string) $user->getUsername(),
                false,
                $user
            );
        }

        foreach ($room->getBots() as $bot) {
            if (!$bot instanceof RoomBot) {
                continue;
            }
            $participants[] = new Participant(
                -1 * (int) $bot->getId(),
                (string) $bot->getName(),
                true
            );
        }

        return $participants;
    }
}
