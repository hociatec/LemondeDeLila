<?php

namespace App\Module\Game\Controller;

use App\Module\Game\Entity\GameStat;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/games')]
class StatsController extends AbstractController
{
    #[Route('/{type}/stats', name: 'game_stats', methods: ['GET'])]
    public function stats(string $type, EntityManagerInterface $em): Response
    {
        $stat = $em->getRepository(GameStat::class)->findOneBy(['gameType' => $type]);
        return $this->json(['gameType' => $type, 'data' => $stat?->getData() ?? []]);
    }
}

