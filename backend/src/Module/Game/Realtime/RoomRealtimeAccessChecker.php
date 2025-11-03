<?php

namespace App\Module\Game\Realtime;

use App\Module\Game\Entity\Room;
use App\Module\Game\Entity\RoomParticipant;
use App\Module\Game\Repository\RoomParticipantRepository;
use App\Module\User\Entity\User;
use Doctrine\Persistence\ManagerRegistry;

class RoomRealtimeAccessChecker
{
    public function __construct(private readonly ManagerRegistry $registry)
    {
    }

    public function canAccess(User $user, Room $room): bool
    {
        $userId = $user->getId();
        if ($userId === null) {
            return false;
        }

        if ($room->getOwner()?->getId() === $userId) {
            return true;
        }

        foreach ($room->getPlayers() as $player) {
            if ($player->getId() === $userId) {
                return true;
            }
        }

        $participantRepo = $this->getParticipantRepository();
        $active = $participantRepo->createQueryBuilder('p')
            ->andWhere('p.room = :room')
            ->andWhere('p.user = :user')
            ->andWhere('p.leftAt IS NULL')
            ->setParameter('room', $room)
            ->setParameter('user', $user)
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
        if ($active instanceof RoomParticipant) {
            return true;
        }

        // Allow non-private rooms to be observed without explicit membership.
        return !$room->isPrivate();
    }

    private function getParticipantRepository(): RoomParticipantRepository
    {
        /** @var RoomParticipantRepository $repo */
        $repo = $this->registry->getRepository(RoomParticipant::class);
        return $repo;
    }
}
