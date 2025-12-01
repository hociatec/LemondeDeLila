<?php

namespace App\Module\Game\Repository;

use App\Module\Game\Entity\Room;
use App\Module\Game\Entity\RoomBot;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<RoomBot>
 */
final class RoomBotRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, RoomBot::class);
    }

    /**
     * @return list<RoomBot>
     */
    public function findByRoom(Room $room): array
    {
        return $this->createQueryBuilder('bot')
            ->andWhere('bot.room = :room')
            ->setParameter('room', $room)
            ->orderBy('bot.createdAt', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
