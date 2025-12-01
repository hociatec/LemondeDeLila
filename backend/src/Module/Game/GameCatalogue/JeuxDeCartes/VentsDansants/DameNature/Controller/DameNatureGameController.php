<?php

namespace App\Module\Game\GameCatalogue\JeuxDeCartes\VentsDansants\DameNature\Controller;

use App\Module\Game\Entity\Game;
use App\Module\Game\Entity\Room;
use App\Module\Game\GameCatalogue\JeuxDeCartes\VentsDansants\DameNature\Service\DameNatureGameService;
use App\Module\Game\Realtime\RoomRealtimeNotifier;
use App\Module\Game\Service\StatsAggregator;
use App\Module\Game\Service\TableManager;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

final class DameNatureGameController extends AbstractController
{
    public function __construct(
        private readonly DameNatureGameService $service,
        private readonly StatsAggregator $stats,
        private readonly RoomRealtimeNotifier $realtime,
        private readonly TableManager $tables
    ) {
    }

    public function actions(int $id, Request $request, EntityManagerInterface $em): Response
    {
        $room = $em->getRepository(Room::class)->find($id);
        if (!$room) {
            return $this->json(['error' => 'Not found'], Response::HTTP_NOT_FOUND);
        }
        if (!$this->isRoomInProgress($room)) {
            return $this->json(['error' => 'Room not started'], Response::HTTP_BAD_REQUEST);
        }

        $game = $em->getRepository(Game::class)->findOneBy(['room' => $room]) ?? $this->tables->ensureGame($room);

        $state = $game->getState();
        if ($this->isRoomInProgress($room) && ($state['status'] ?? '') !== 'playing') {
            $state = $this->service->startState($state);
            $game->setState($state);
        }

        /** @var \App\Module\User\Entity\User $player */
        $player = $this->getUser();
        $payload = json_decode($request->getContent() ?: '{}', true);
        if (!is_array($payload)) {
            $payload = [];
        }

        $actions = [];
        if (is_array($payload['actions'] ?? null)) {
            $actions = $payload['actions'];
        } elseif ($payload !== []) {
            $actions = [$payload];
        }

        $state = $this->service->applyActions($game->getState(), $actions, $room, $player);
        $game
            ->setState($state)
            ->setCurrentRound($this->service->currentRound($state));

        if (($state['status'] ?? null) === 'ended') {
            if (!$game->getEndedAt()) {
                $game->setEndedAt(new \DateTimeImmutable());
            }
            if ($room->getStatus() !== 'ended') {
                $room->setStatus('ended');
            }
        }

        $em->flush();
        $this->stats->onStateUpdated($game, $state);
        $this->realtime->notify($room, 'state-updated', ['game' => $game->getId()]);

        return $this->json($this->service->presentState($state, $player));
    }

    public function state(int $id, EntityManagerInterface $em): Response
    {
        $room = $em->getRepository(Room::class)->find($id);
        if (!$room) {
            return $this->json(['error' => 'Not found'], Response::HTTP_NOT_FOUND);
        }

        /** @var \App\Module\User\Entity\User $viewer */
        $viewer = $this->getUser();

        if (!$this->isRoomInProgress($room)) {
            $state = $this->service->defaultState($room);
            return $this->json($this->service->presentState($state, $viewer));
        }

        $game = $em->getRepository(Game::class)->findOneBy(['room' => $room]);
        if (!$game) {
            $state = $this->service->defaultState($room);
            $game = (new Game())
                ->setRoom($room)
                ->setState($this->service->startState($state))
                ->setCurrentRound($this->service->currentRound($state))
                ->setStartedAt(new \DateTimeImmutable());
            $em->persist($game);
            $em->flush();
        }

        $state = $this->service->advanceBots($game->getState());
        if ($state !== $game->getState()) {
            $game
                ->setState($state)
                ->setCurrentRound($this->service->currentRound($state));
            if (($state['status'] ?? null) === 'ended') {
                if (!$game->getEndedAt()) {
                    $game->setEndedAt(new \DateTimeImmutable());
                }
                if ($room->getStatus() !== 'ended') {
                    $room->setStatus('ended');
                }
            }
            $em->flush();
            $this->stats->onStateUpdated($game, $state);
            $this->realtime->notify($room, 'state-updated', ['game' => $game->getId()]);
        }

        return $this->json($this->service->presentState($state, $viewer));
    }

    private function isRoomInProgress(Room $room): bool
    {
        $status = $room->getStatus();
        return in_array($status, ['started', 'in_progress', 'en_cours'], true);
    }
}
