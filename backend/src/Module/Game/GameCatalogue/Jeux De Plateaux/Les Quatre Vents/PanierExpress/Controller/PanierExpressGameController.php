<?php

namespace App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Controller;

use App\Module\Game\Entity\Game;
use App\Module\Game\Entity\Room;
use App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Service\PanierExpressGameService;
use App\Module\Game\Realtime\RoomRealtimeNotifier;
use App\Module\Game\Service\StatsAggregator;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
final class PanierExpressGameController extends AbstractController
{
    public function __construct(
        private readonly PanierExpressGameService $service,
        private readonly StatsAggregator $stats,
        private readonly RoomRealtimeNotifier $realtime
    ) {
    }

    public function state(int $id, EntityManagerInterface $em): Response
    {
        $room = $em->getRepository(Room::class)->find($id);
        if (!$room) {
            return $this->json(['error' => 'Not found'], Response::HTTP_NOT_FOUND);
        }

        $game = $em->getRepository(Game::class)->findOneBy(['room' => $room]);
        if (!$game) {
            $state = $this->service->defaultState($room);
            $game = (new Game())
                ->setRoom($room)
                ->setState($state)
                ->setCurrentRound($this->service->currentRound($state))
                ->setStartedAt(new \DateTimeImmutable());
            $em->persist($game);
            $em->flush();
        }

        /** @var \App\Module\User\Entity\User $viewer */
        $viewer = $this->getUser();

        return $this->json($this->service->presentState($game->getState(), $viewer));
    }

    public function move(int $id, Request $request, EntityManagerInterface $em): Response
    {
        $room = $em->getRepository(Room::class)->find($id);
        if (!$room) {
            return $this->json(['error' => 'Not found'], Response::HTTP_NOT_FOUND);
        }

        $game = $em->getRepository(Game::class)->findOneBy(['room' => $room]);
        if (!$game) {
            $state = $this->service->defaultState($room);
            $game = (new Game())
                ->setRoom($room)
                ->setState($state)
                ->setCurrentRound($this->service->currentRound($state))
                ->setStartedAt(new \DateTimeImmutable());
            $em->persist($game);
        }

        /** @var \App\Module\User\Entity\User $player */
        $player = $this->getUser();
        $payload = json_decode($request->getContent() ?: '{}', true);

        $state = $this->service->apply($game->getState(), is_array($payload) ? $payload : [], $room, $player);
        $game
            ->setState($state)
            ->setCurrentRound($this->service->currentRound($state));

        if (($state['status'] ?? null) === 'ended' && !$game->getEndedAt()) {
            $game->setEndedAt(new \DateTimeImmutable());
        }

        $em->flush();
        $this->stats->onStateUpdated($game, $state);
        $this->realtime->notify($room, 'state-updated', ['game' => $game->getId()]);

        return $this->json($this->service->presentState($state, $player));
    }
}
