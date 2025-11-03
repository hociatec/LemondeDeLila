<?php

namespace App\Module\Rules\Controller;

use App\Module\Rules\Entity\RuleSet;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/games')]
class RulesController extends AbstractController
{
    #[Route('/{type}/rules', name: 'game_rules', methods: ['GET'])]
    public function rules(string $type, EntityManagerInterface $em): Response
    {
        $rules = $em->getRepository(RuleSet::class)->findOneBy(['gameId' => $type]);
        if (!$rules) {
            return $this->json(['gameId' => $type, 'data' => []]);
        }
        return $this->json(['gameId' => $rules->getGameId(), 'data' => $rules->getData()]);
    }
}

