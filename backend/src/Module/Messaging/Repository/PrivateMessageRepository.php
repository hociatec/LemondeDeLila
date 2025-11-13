<?php

namespace App\Module\Messaging\Repository;

use App\Module\Messaging\Entity\PrivateMessage;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<PrivateMessage>
 */
class PrivateMessageRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, PrivateMessage::class);
    }

    /**
     * @return PrivateMessage[]
     */
    public function findConversation(int $userA, int $userB, int $limit = 100): array
    {
        return $this->createQueryBuilder('m')
            ->andWhere('(m.sender = :userA AND m.recipient = :userB) OR (m.sender = :userB AND m.recipient = :userA)')
            ->setParameter('userA', $userA)
            ->setParameter('userB', $userB)
            ->orderBy('m.createdAt', 'DESC')
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }

    /**
     * @return PrivateMessage[]
     */
    public function findInbox(int $userId, int $limit = 100): array
    {
        return $this->createQueryBuilder('m')
            ->andWhere('m.recipient = :user')
            ->setParameter('user', $userId)
            ->orderBy('m.createdAt', 'DESC')
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }

    /**
     * @return PrivateMessage[]
     */
    public function findOutbox(int $userId, int $limit = 100): array
    {
        return $this->createQueryBuilder('m')
            ->andWhere('m.sender = :user')
            ->setParameter('user', $userId)
            ->orderBy('m.createdAt', 'DESC')
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }
}
