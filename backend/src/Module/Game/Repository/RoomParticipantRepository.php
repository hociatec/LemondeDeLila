<?php

namespace App\Module\Game\Repository;

use App\Module\Game\Entity\Room;
use App\Module\Game\Entity\RoomParticipant;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<RoomParticipant>
 */
class RoomParticipantRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, RoomParticipant::class);
    }

    public function countActiveByRoomAndRole(Room $room, string $role): int
    {
        return (int) $this->createQueryBuilder('p')
            ->select('COUNT(p.id)')
            ->andWhere('p.room = :room')
            ->andWhere('p.role = :role')
            ->andWhere('p.leftAt IS NULL')
            ->setParameter('room', $room)
            ->setParameter('role', $role)
            ->getQuery()->getSingleScalarResult();
    }
}

