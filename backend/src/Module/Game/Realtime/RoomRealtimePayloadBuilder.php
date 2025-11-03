<?php

namespace App\Module\Game\Realtime;

use App\Module\Game\Entity\Game;
use App\Module\Game\Entity\Room;
use App\Module\Game\Entity\RoomParticipant;
use App\Module\Game\Entity\TableSnapshot;
use App\Module\Game\Engine\EngineRegistry;
use App\Module\User\Entity\User;
use Doctrine\Persistence\ManagerRegistry;

class RoomRealtimePayloadBuilder
{
    public function __construct(
        private readonly ManagerRegistry $registry,
        private readonly EngineRegistry $engineRegistry
    ) {
    }

    public function build(Room $room): array
    {
        return $this->buildById((int) $room->getId());
    }

    public function buildById(int $roomId): array
    {
        $em = $this->registry->getManager();

        /** @var Room|null $room */
        $room = $em->getRepository(Room::class)->find($roomId);
        if (!$room) {
            throw new \RuntimeException(sprintf('Room %d not found', $roomId));
        }

        $participantRepo = $em->getRepository(RoomParticipant::class);
        $playersCount = method_exists($participantRepo, 'countActiveByRoomAndRole')
            ? $participantRepo->countActiveByRoomAndRole($room, 'player')
            : $room->getPlayers()->count();
        $spectatorsCount = method_exists($participantRepo, 'countActiveByRoomAndRole')
            ? $participantRepo->countActiveByRoomAndRole($room, 'spectator')
            : 0;

        $roomData = [
            'id' => $room->getId(),
            'name' => $room->getName(),
            'isPrivate' => $room->isPrivate(),
            'maxPlayers' => $room->getMaxPlayers(),
            'status' => $room->getStatus(),
            'gameType' => $room->getGameType(),
            'counts' => ['players' => $playersCount, 'spectators' => $spectatorsCount],
            'owner' => $room->getOwner()
                ? ['id' => $room->getOwner()->getId(), 'username' => $room->getOwner()->getUsername()]
                : null,
            'players' => array_map(
                static fn(User $u) => ['id' => $u->getId(), 'username' => $u->getUsername()],
                $room->getPlayers()->toArray()
            ),
        ];

        /** @var Game|null $game */
        $game = $em->getRepository(Game::class)->findOneBy(['room' => $room]);
        $state = $game?->getState() ?? null;
        $type = $state['type'] ?? $room->getGameType();
        $engine = $type ? $this->engineRegistry->get($type) : null;

        $score = null;
        $currentRound = $game?->getCurrentRound();
        if ($engine && $state) {
            $score = $engine->computeScore($state);
            $currentRound = $currentRound ?? $engine->currentRound($state);
        }

        $snapshots = $em->getRepository(TableSnapshot::class)
            ->findBy(['room' => $room], ['id' => 'DESC']);
        $snapshotData = array_map(
            static fn(TableSnapshot $snapshot) => [
                'id' => $snapshot->getId(),
                'label' => $snapshot->getLabel(),
                'createdAt' => $snapshot->getCreatedAt()->format(\DATE_ATOM),
            ],
            $snapshots
        );

        return [
            'room' => $roomData,
            'gameState' => $state,
            'snapshots' => $snapshotData,
            'score' => [
                'type' => $type,
                'score' => $score,
                'currentRound' => $currentRound ?? null,
            ],
            'generatedAt' => (new \DateTimeImmutable())->format(\DATE_ATOM),
        ];
    }
}
