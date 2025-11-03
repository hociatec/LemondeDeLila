<?php

namespace App\Module\Rules\Repository;

use App\Module\Rules\Entity\RuleSet;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class RuleSetRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, RuleSet::class);
    }

    public function findByGameId(string $gameId): ?RuleSet
    {
        return $this->findOneBy(['gameId' => $gameId]);
    }
}

