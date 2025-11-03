<?php

namespace App\Module\Game\Repository;

use App\Module\Game\Entity\TableSnapshot;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<TableSnapshot>
 */
class TableSnapshotRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, TableSnapshot::class);
    }
}

