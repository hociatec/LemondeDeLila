<?php

namespace App\Module\Game\Controller;

use App\Module\Game\Entity\Game;
use App\Module\Game\Entity\Room;
use App\Module\Game\Engine\EngineRegistry;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/rooms')]
class ScoreController extends AbstractController
{
    #[Route('/{id}/score', name: 'rooms_score', methods: ['GET'])]
    public function score(int $id, EntityManagerInterface $em, EngineRegistry $registry)
    {
        $room = $em->getRepository(Room::class)->find($id);
        if (!$room) return $this->json(['error' => 'Not found'], 404);
        $game = $em->getRepository(Game::class)->findOneBy(['room' => $room]);
        if (!$game) return $this->json(['type' => $room->getGameType(), 'score' => null, 'currentRound' => 0]);
        $state = $game->getState();
        $type = $state['type'] ?? $room->getGameType();
        $engine = $registry->get($type);
        $score = $engine ? $engine->computeScore($state) : null;
        $round = method_exists($game, 'getCurrentRound') ? $game->getCurrentRound() : ($engine ? $engine->currentRound($state) : 0);
        return $this->json(['type' => $type, 'score' => $score, 'currentRound' => $round]);
    }
}
