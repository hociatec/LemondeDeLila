<?php

namespace App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Controller;

use App\Module\Game\Bot\BotAllocator;
use App\Module\Game\Entity\Room;
use App\Module\Game\Entity\RoomBot;
use App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Service\PanierExpressGameService;
use App\Module\Game\Realtime\RoomRealtimeNotifier;
use App\Module\Game\Service\TableManager;
use App\Module\User\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/games/panier-express')]
final class PanierExpressTableController extends AbstractController
{
    public function __construct(
        private readonly BotAllocator $botAllocator,
        private readonly RoomRealtimeNotifier $realtime,
        private readonly TableManager $tables,
        private readonly PanierExpressGameService $gameService,
    ) {
    }

    #[Route('/table', name: 'panier_express_table_prepare', methods: ['POST'])]
    public function prepare(Request $request, EntityManagerInterface $em): Response
    {
        /** @var User|null $user */
        $user = $this->getUser();
        if (!$user) {
            return $this->json(['error' => 'Unauthorized'], Response::HTTP_UNAUTHORIZED);
        }

        $payload = json_decode($request->getContent() ?: '{}', true) ?? [];
        $maxPlayers = (int) ($payload['maxPlayers'] ?? 6);
        $maxPlayers = max(2, min(6, $maxPlayers));
        $name = (string) ($payload['name'] ?? 'Table Panier Express');

        $room = (new Room())
            ->setName($name === '' ? 'Table Panier Express' : $name)
            ->setIsPrivate(true)
            ->setMaxPlayers($maxPlayers)
            ->setGameType('panier-express')
            ->setOwner($user)
            ->setStatus('open');

        $room->addPlayer($user);
        $em->persist($room);
        $em->flush();

        $this->realtime->notify($room, 'created');

        return $this->json(['table' => $this->serializeTable($room)], Response::HTTP_CREATED);
    }

    #[Route('/table/{id}/bots', name: 'panier_express_table_add_bot', methods: ['POST'])]
    public function addBot(int $id, EntityManagerInterface $em): Response
    {
        $room = $this->findRoom($em, $id);
        if (!$room) {
            return $this->json(['error' => 'Not found'], Response::HTTP_NOT_FOUND);
        }

        if (!$this->isOwner($room)) {
            return $this->json(['error' => 'Forbidden'], Response::HTTP_FORBIDDEN);
        }

        if ($room->getStatus() !== 'open') {
            return $this->json(['error' => 'Room already started'], Response::HTTP_BAD_REQUEST);
        }

        if ($this->totalParticipants($room) >= $room->getMaxPlayers()) {
            return $this->json(['error' => 'Room full'], Response::HTTP_BAD_REQUEST);
        }

        $excluded = array_merge(
            array_map(fn(RoomBot $bot) => $bot->getName(), $room->getBots()->toArray()),
            array_map(fn(User $player) => $player->getUsername(), $room->getPlayers()->toArray())
        );
        $name = $this->botAllocator->pick($excluded);

        $bot = (new RoomBot())
            ->setName($name);
        $room->addBot($bot);
        $em->persist($bot);
        $em->flush();

        $this->realtime->notify($room, 'bot-added', ['bot' => $this->serializeBot($bot)]);

        return $this->json(['table' => $this->serializeTable($room)]);
    }

    #[Route('/table/{id}/bots', name: 'panier_express_table_remove_bot', methods: ['DELETE'])]
    public function removeBot(int $id, EntityManagerInterface $em): Response
    {
        $room = $this->findRoom($em, $id);
        if (!$room) {
            return $this->json(['error' => 'Not found'], Response::HTTP_NOT_FOUND);
        }

        if (!$this->isOwner($room)) {
            return $this->json(['error' => 'Forbidden'], Response::HTTP_FORBIDDEN);
        }

        if ($room->getBots()->isEmpty()) {
            return $this->json(['error' => 'No bot to remove'], Response::HTTP_BAD_REQUEST);
        }

        $bot = $this->latestBot($room);
        if (!$bot) {
            return $this->json(['error' => 'No bot to remove'], Response::HTTP_BAD_REQUEST);
        }

        $room->removeBot($bot);
        $em->remove($bot);
        $em->flush();

        $this->realtime->notify($room, 'bot-removed', ['botId' => $bot->getId()]);

        return $this->json(['table' => $this->serializeTable($room)]);
    }

    #[Route('/table/{id}/launch', name: 'panier_express_table_launch', methods: ['POST'])]
    public function launch(int $id, EntityManagerInterface $em): Response
    {
        $room = $this->findRoom($em, $id);
        if (!$room) {
            return $this->json(['error' => 'Not found'], Response::HTTP_NOT_FOUND);
        }

        if (!$this->isOwner($room)) {
            return $this->json(['error' => 'Forbidden'], Response::HTTP_FORBIDDEN);
        }

        if ($room->getStatus() !== 'open') {
            return $this->json(['error' => 'Room already started'], Response::HTTP_BAD_REQUEST);
        }

        if ($this->totalParticipants($room) < 2) {
            return $this->json(['error' => 'At least two participants are required'], Response::HTTP_BAD_REQUEST);
        }

        $game = $this->tables->ensureGame($room);
        $state = $this->gameService->defaultState($room);
        $game
            ->setState($state)
            ->setCurrentRound($this->gameService->currentRound($state));
        if (!$game->getStartedAt()) {
            $game->setStartedAt(new \DateTimeImmutable());
        }
        $room->setStatus('started');
        $em->flush();

        $this->realtime->notify($room, 'started');

        /** @var User|null $viewer */
        $viewer = $this->getUser();
        $publicState = $viewer ? $this->gameService->presentState($state, $viewer) : $state;

        return $this->json([
            'table' => $this->serializeTable($room),
            'state' => $publicState,
        ]);
    }

    private function findRoom(EntityManagerInterface $em, int $id): ?Room
    {
        return $em->getRepository(Room::class)->find($id);
    }

    private function isOwner(Room $room): bool
    {
        /** @var User|null $user */
        $user = $this->getUser();
        return $user && $room->getOwner()?->getId() === $user->getId();
    }

    private function totalParticipants(Room $room): int
    {
        return $room->getPlayers()->count() + $room->getBots()->count();
    }

    private function latestBot(Room $room): ?RoomBot
    {
        $bots = $room->getBots()->toArray();
        if ($bots === []) {
            return null;
        }
        usort($bots, static fn(RoomBot $a, RoomBot $b) => $a->getCreatedAt() <=> $b->getCreatedAt());
        return end($bots) ?: null;
    }

    private function serializeTable(Room $room): array
    {
        return [
            'id' => $room->getId(),
            'status' => $room->getStatus(),
            'maxPlayers' => $room->getMaxPlayers(),
            'ownerId' => $room->getOwner()?->getId(),
            'players' => array_map(
                static fn(User $player) => [
                    'id' => $player->getId(),
                    'username' => $player->getUsername(),
                ],
                $room->getPlayers()->toArray()
            ),
            'bots' => array_map(
                fn(RoomBot $bot) => $this->serializeBot($bot),
                $room->getBots()->toArray()
            ),
            'counts' => [
                'players' => $room->getPlayers()->count() + $room->getBots()->count(),
            ],
        ];
    }

    private function serializeBot(RoomBot $bot): array
    {
        return [
            'id' => $bot->getId(),
            'name' => $bot->getName(),
        ];
    }
}
