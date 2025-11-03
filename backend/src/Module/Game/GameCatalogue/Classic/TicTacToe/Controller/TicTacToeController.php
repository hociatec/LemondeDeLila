<?php

namespace App\Module\Game\GameCatalogue\Classic\TicTacToe\Controller;

use App\Module\Game\Entity\Room;
use App\Module\Game\Entity\Game;
use App\Module\Game\GameCatalogue\Classic\TicTacToe\Service\TicTacToeService;
use App\Module\Game\Realtime\RoomRealtimeNotifier;
use App\Module\Game\Service\StatsAggregator;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/games/tictactoe')]
class TicTacToeController extends AbstractController
{
    public function __construct(
        private TicTacToeService $svc,
        private StatsAggregator $stats,
        private RoomRealtimeNotifier $realtime
    ) {
    }

    #[Route('/rooms/{id}/state', name: 'tictactoe_state', methods: ['GET'])]
    public function state(int $id, EntityManagerInterface $em)
    {
        $room = $em->getRepository(Room::class)->find($id);
        if (!$room) return $this->json(['error' => 'Not found'], 404);
        $game = $em->getRepository(Game::class)->findOneBy(['room' => $room]);
        if (!$game) {
            $state = $this->svc->defaultState($room);
            $game = (new Game())
                ->setRoom($room)
                ->setState($state)
                ->setCurrentRound((int)($state['round'] ?? 1))
                ->setStartedAt(new \DateTimeImmutable());
            $em->persist($game);
            $em->flush();
        }
        return $this->json($game->getState());
    }

    #[Route('/rooms/{id}/move', name: 'tictactoe_move', methods: ['POST'])]
    public function move(int $id, Request $req, EntityManagerInterface $em)
    {
        $room = $em->getRepository(Room::class)->find($id);
        if (!$room) return $this->json(['error' => 'Not found'], 404);
        $game = $em->getRepository(Game::class)->findOneBy(['room' => $room]);
        if (!$game) {
            $state = $this->svc->defaultState($room);
            $game = (new Game())
                ->setRoom($room)
                ->setState($state)
                ->setCurrentRound((int)($state['round'] ?? 1))
                ->setStartedAt(new \DateTimeImmutable());
            $em->persist($game);
        }
        /** @var \App\Module\User\Entity\User $me */ $me = $this->getUser();
        $state = $this->svc->apply($game->getState(), json_decode($req->getContent(), true) ?? [], $room, $me);
        $game->setState($state)->setCurrentRound((int)($state['round'] ?? $game->getCurrentRound() ?: 1));
        $em->flush();
        $this->stats->onStateUpdated($game, $state);
        $this->realtime->notify($room, 'state-updated');
        return $this->json($state);
    }
}
