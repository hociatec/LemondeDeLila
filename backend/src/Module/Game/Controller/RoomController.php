<?php

namespace App\Module\Game\Controller;

use App\Module\Game\Bot\BotAllocator;
use App\Module\Game\Entity\Room;
use App\Module\Game\Entity\RoomBot;
use App\Module\Game\Entity\RoomParticipant;
use App\Module\Game\Entity\TableSnapshot;
use App\Module\Game\Realtime\RoomRealtimeNotifier;
use App\Module\Game\Service\TableManager;
use App\Module\User\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/rooms')]
class RoomController extends AbstractController
{
    public function __construct(
        private readonly RoomRealtimeNotifier $realtime,
        private readonly BotAllocator $botAllocator,
    ) {
    }

    #[Route('/{id}', name: 'rooms_get', methods: ['GET'])]
    public function getOne(int $id, EntityManagerInterface $em): Response
    {
        $room = $em->getRepository(Room::class)->find($id);
        if (!$room) {
            return $this->json(['error' => 'Not found'], 404);
        }

        return $this->json($this->serializeRoom($room, $em));
    }

    #[Route('/', name: 'rooms_list', methods: ['GET'])]
    public function list(EntityManagerInterface $em): Response
    {
        $rooms = $em->getRepository(Room::class)->findBy([], ['id' => 'DESC']);
        $data = array_map(fn(Room $room) => $this->serializeRoom($room, $em), $rooms);
        return $this->json($data);
    }

    #[Route('/', name: 'rooms_create', methods: ['POST'])]
    public function create(Request $request, EntityManagerInterface $em): Response
    {
        try {
            /** @var User $me */
            $me = $this->getUser();
            $payload = json_decode($request->getContent(), true) ?? [];
            $gameType = $payload['gameType'] ?? 'tictactoe';

            // Default maxPlayers and name based on shared catalog when not provided
            $defaultName = 'Table';
            $defaultMax = 4;
            foreach (\App\Module\Game\Shared\Catalog::categories() as $cat) {
                foreach ($cat['games'] as $g) {
                    if ($g['id'] === $gameType) { $defaultName = 'Table '.$g['name']; $defaultMax = (int)$g['maxPlayers']; }
                }
            }

            $room = (new Room())
                ->setName($payload['name'] ?? $defaultName)
                ->setIsPrivate((bool)($payload['isPrivate'] ?? false))
                ->setMaxPlayers((int)($payload['maxPlayers'] ?? $defaultMax))
                ->setGameType($gameType)
                ->setOwner($me);
            $room->addPlayer($me);
            $em->persist($room);
            $em->flush();
            $this->realtime->notify($room, 'created');
            return $this->json(['id' => $room->getId()], 201);
        } catch (\Throwable $e) {
            // Log diagnostic details to ease production debugging when stderr is not collected.
            $message = sprintf(
                "[%s] %s in %s:%d\nPayload: %s\nTrace:\n%s\n\n",
                (new \DateTimeImmutable())->format(\DATE_ATOM),
                $e->getMessage(),
                $e->getFile(),
                $e->getLine(),
                $request->getContent(),
                $e->getTraceAsString()
            );
            @file_put_contents('/tmp/room_create_error.log', $message, FILE_APPEND);
            throw $e;
        }
    }

    #[Route('/{id}/join', name: 'rooms_join', methods: ['POST'])]
    public function join(int $id, EntityManagerInterface $em): Response
    {
        /** @var User $me */
        $me = $this->getUser();
        $room = $em->getRepository(Room::class)->find($id);
        if (!$room) { return $this->json(['error' => 'Not found'], 404); }
        if ($this->totalPlayers($room, $em) >= $room->getMaxPlayers()) {
            return $this->json(['error' => 'Room full'], 400);
        }
        $room->addPlayer($me);
        // Trace participant join as player
        $p = (new RoomParticipant())
            ->setRoom($room)
            ->setUser($me)
            ->setRole('player');
        $em->persist($p);
        $em->flush();
        $this->realtime->notify($room, 'player-joined');
        return $this->json(['message' => 'Joined']);
    }

    #[Route('/{id}/leave', name: 'rooms_leave', methods: ['POST'])]
    public function leave(int $id, EntityManagerInterface $em): Response
    {
        /** @var User $me */
        $me = $this->getUser();
        $room = $em->getRepository(Room::class)->find($id);
        if (!$room) { return $this->json(['error' => 'Not found'], 404); }
        $room->removePlayer($me);
        $repo = $em->getRepository(RoomParticipant::class);
        $active = $repo->findOneBy(['room' => $room, 'user' => $me, 'leftAt' => null]);
        if ($active) { $active->leave(); }
        $em->flush();
        $this->realtime->notify($room, 'player-left');
        return $this->json(['message' => 'Left']);
    }

    #[Route('/{id}/spectate', name: 'rooms_spectate', methods: ['POST'])]
    public function spectate(int $id, EntityManagerInterface $em): Response
    {
        /** @var User $me */
        $me = $this->getUser();
        $room = $em->getRepository(Room::class)->find($id);
        if (!$room) { return $this->json(['error' => 'Not found'], 404); }
        $p = (new RoomParticipant())
            ->setRoom($room)
            ->setUser($me)
            ->setRole('spectator');
        $em->persist($p);
        $em->flush();
        $this->realtime->notify($room, 'spectator-joined');
        return $this->json(['message' => 'Spectating']);
    }

    #[Route('/{id}/unspectate', name: 'rooms_unspectate', methods: ['POST'])]
    public function unspectate(int $id, EntityManagerInterface $em): Response
    {
        /** @var User $me */
        $me = $this->getUser();
        $room = $em->getRepository(Room::class)->find($id);
        if (!$room) { return $this->json(['error' => 'Not found'], 404); }
        $repo = $em->getRepository(RoomParticipant::class);
        $active = $repo->findOneBy(['room' => $room, 'user' => $me, 'role' => 'spectator', 'leftAt' => null]);
        if ($active) { $active->leave(); }
        $em->flush();
        $this->realtime->notify($room, 'spectator-left');
        return $this->json(['message' => 'Stopped spectating']);
    }

    #[Route('/{id}/start', name: 'rooms_start', methods: ['POST'])]
    public function start(int $id, EntityManagerInterface $em, TableManager $tables): Response
    {
        $room = $em->getRepository(Room::class)->find($id);
        if (!$room) { return $this->json(['error' => 'Not found'], 404); }
        $game = $tables->ensureGame($room);
        $this->realtime->notify($room, 'started');
        return $this->json(['message' => 'Started', 'gameId' => $game->getId()]);
    }

    #[Route('/{id}/snapshot', name: 'rooms_snapshot', methods: ['POST'])]
    public function snapshot(int $id, EntityManagerInterface $em, TableManager $tables, Request $request): Response
    {
        /** @var User $me */ $me = $this->getUser();
        $room = $em->getRepository(Room::class)->find($id);
        if (!$room) { return $this->json(['error' => 'Not found'], 404); }
        $payload = json_decode($request->getContent() ?: '{}', true);
        $snap = $tables->snapshot($room, $payload['label'] ?? null, $me?->getId());
        $this->realtime->notify($room, 'snapshot-created');
        return $this->json(['id' => $snap->getId(), 'createdAt' => $snap->getCreatedAt()->format(DATE_ATOM)]);
    }

    #[Route('/{id}/snapshots', name: 'rooms_snapshots', methods: ['GET'])]
    public function listSnapshots(int $id, EntityManagerInterface $em): Response
    {
        $room = $em->getRepository(Room::class)->find($id);
        if (!$room) { return $this->json(['error' => 'Not found'], 404); }
        $snaps = $em->getRepository(TableSnapshot::class)->findBy(['room' => $room], ['id' => 'DESC']);
        $data = array_map(function (TableSnapshot $s) {
            return [
                'id' => $s->getId(),
                'label' => $s->getLabel(),
                'createdAt' => $s->getCreatedAt()->format(DATE_ATOM),
            ];
        }, $snaps);
        return $this->json($data);
    }

    #[Route('/{id}/restore/{snapshotId}', name: 'rooms_restore_snapshot', methods: ['POST'])]
    public function restoreSnapshot(int $id, int $snapshotId, EntityManagerInterface $em, TableManager $tables): Response
    {
        $room = $em->getRepository(Room::class)->find($id);
        if (!$room) { return $this->json(['error' => 'Not found'], 404); }
        $snap = $em->getRepository(TableSnapshot::class)->find($snapshotId);
        if (!$snap || $snap->getRoom()->getId() !== $room->getId()) {
            return $this->json(['error' => 'Snapshot not found'], 404);
        }
        $game = $tables->restore($room, $snap);
        $this->realtime->notify($room, 'snapshot-restored');
        return $this->json(['message' => 'Restored', 'gameId' => $game->getId()]);
    }

    #[Route('/{id}/bots', name: 'rooms_add_bot', methods: ['POST'])]
    public function addBot(int $id, Request $request, EntityManagerInterface $em): Response
    {
        $room = $em->getRepository(Room::class)->find($id);
        if (!$room) {
            return $this->json(['error' => 'Not found'], 404);
        }

        /** @var User $me */
        $me = $this->getUser();
        if ($room->getOwner()?->getId() !== $me->getId()) {
            return $this->json(['error' => 'Forbidden'], 403);
        }

        if ($room->getStatus() !== 'open') {
            return $this->json(['error' => 'Room already started'], 400);
        }

        if ($this->totalPlayers($room, $em) >= $room->getMaxPlayers()) {
            return $this->json(['error' => 'Room full'], 400);
        }

        $payload = json_decode($request->getContent() ?: '{}', true) ?? [];
        $requestedName = isset($payload['name']) ? trim((string) $payload['name']) : '';

        $usedNames = array_map(
            fn(RoomBot $bot) => $bot->getName(),
            $room->getBots()->toArray()
        );
        $playerNames = array_map(
            fn(User $user) => $user->getUsername(),
            $room->getPlayers()->toArray()
        );
        $excluded = array_merge($usedNames, $playerNames);

        if ($requestedName !== '' && in_array($requestedName, $excluded, true)) {
            return $this->json(['error' => 'Bot name already used'], 400);
        }

        $name = $requestedName !== '' ? $requestedName : $this->botAllocator->pick($excluded);

        $bot = (new RoomBot())->setName($name);
        $room->addBot($bot);
        $em->persist($bot);
        $em->flush();

        $this->realtime->notify($room, 'bot-added', ['bot' => $this->serializeBot($bot)]);

        return $this->json(['bot' => $this->serializeBot($bot)], 201);
    }

    #[Route('/{id}/bots/{botId}', name: 'rooms_remove_bot', methods: ['DELETE'])]
    public function removeBot(int $id, int $botId, EntityManagerInterface $em): Response
    {
        $room = $em->getRepository(Room::class)->find($id);
        if (!$room) {
            return $this->json(['error' => 'Not found'], 404);
        }

        /** @var User $me */
        $me = $this->getUser();
        if ($room->getOwner()?->getId() !== $me->getId()) {
            return $this->json(['error' => 'Forbidden'], 403);
        }

        $bot = $em->getRepository(RoomBot::class)->find($botId);
        if (!$bot || $bot->getRoom()->getId() !== $room->getId()) {
            return $this->json(['error' => 'Bot not found'], 404);
        }

        $room->removeBot($bot);
        $em->remove($bot);
        $em->flush();

        $this->realtime->notify($room, 'bot-removed', ['botId' => $botId]);

        return $this->json(['message' => 'Bot removed']);
    }

    #[Route('/{id}', name: 'rooms_delete', methods: ['DELETE'])]
    public function delete(int $id, EntityManagerInterface $em): Response
    {
        /** @var User $me */
        $me = $this->getUser();
        $room = $em->getRepository(Room::class)->find($id);
        if (!$room) return $this->json(['error' => 'Not found'], 404);
        if ($room->getOwner()?->getId() !== $me->getId()) {
            return $this->json(['error' => 'Forbidden'], 403);
        }
        $this->realtime->notify($room, 'deleted');
        $em->remove($room);
        $em->flush();
        return $this->json(['message' => 'Deleted']);
    }

    private function serializeRoom(Room $room, EntityManagerInterface $em): array
    {
        $partRepo = $em->getRepository(RoomParticipant::class);
        $humanPlayers = method_exists($partRepo, 'countActiveByRoomAndRole')
            ? $partRepo->countActiveByRoomAndRole($room, 'player')
            : $room->getPlayers()->count();
        $spectators = method_exists($partRepo, 'countActiveByRoomAndRole')
            ? $partRepo->countActiveByRoomAndRole($room, 'spectator')
            : 0;

        $bots = array_map(
            fn(RoomBot $bot) => $this->serializeBot($bot),
            $room->getBots()->toArray()
        );

        return [
            'id' => $room->getId(),
            'name' => $room->getName(),
            'isPrivate' => $room->isPrivate(),
            'maxPlayers' => $room->getMaxPlayers(),
            'status' => $room->getStatus(),
            'gameType' => $room->getGameType(),
            'counts' => [
                'players' => $humanPlayers + count($bots),
                'spectators' => $spectators,
            ],
            'owner' => $room->getOwner()
                ? [
                    'id' => $room->getOwner()->getId(),
                    'username' => $room->getOwner()->getUsername(),
                ]
                : null,
            'players' => array_map(
                fn(User $user) => [
                    'id' => $user->getId(),
                    'username' => $user->getUsername(),
                ],
                $room->getPlayers()->toArray()
            ),
            'bots' => $bots,
        ];
    }

    private function serializeBot(RoomBot $bot): array
    {
        return [
            'id' => $bot->getId(),
            'name' => $bot->getName(),
        ];
    }

    private function totalPlayers(Room $room, EntityManagerInterface $em): int
    {
        $partRepo = $em->getRepository(RoomParticipant::class);
        $humanPlayers = method_exists($partRepo, 'countActiveByRoomAndRole')
            ? $partRepo->countActiveByRoomAndRole($room, 'player')
            : $room->getPlayers()->count();

        return $humanPlayers + $room->getBots()->count();
    }
}
