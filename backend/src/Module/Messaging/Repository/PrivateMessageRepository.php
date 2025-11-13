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
    public function findConversation(int $currentUserId, int $otherUserId, int $limit = 100): array
    {
        return $this->createQueryBuilder('m')
            ->andWhere('(
                    m.sender = :current AND m.recipient = :other AND m.deletedBySenderAt IS NULL
                ) OR (
                    m.sender = :other AND m.recipient = :current AND m.deletedByRecipientAt IS NULL
                )')
            ->setParameter('current', $currentUserId)
            ->setParameter('other', $otherUserId)
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
            ->andWhere('m.deletedByRecipientAt IS NULL')
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
            ->andWhere('m.deletedBySenderAt IS NULL')
            ->setParameter('user', $userId)
            ->orderBy('m.createdAt', 'DESC')
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }

    /**
     * @return PrivateMessage[]
     */
    public function findDeleted(int $userId, int $limit = 100): array
    {
        return $this->createQueryBuilder('m')
            ->addSelect('CASE WHEN m.deletedBySenderAt IS NOT NULL THEN m.deletedBySenderAt ELSE m.deletedByRecipientAt END AS HIDDEN deletionDate')
            ->andWhere('(
                m.sender = :user AND m.deletedBySenderAt IS NOT NULL
            ) OR (
                m.recipient = :user AND m.deletedByRecipientAt IS NOT NULL
            )')
            ->setParameter('user', $userId)
            ->orderBy('deletionDate', 'DESC')
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }

    public function findOneByMessageId(string $messageId): ?PrivateMessage
    {
        return $this->findOneBy(['messageId' => $messageId]);
    }
}
