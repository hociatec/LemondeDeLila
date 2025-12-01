<?php

namespace App\Module\Game\Realtime;

use Amp\Http\Server\Request;
use Amp\Http\Server\Response;
use Amp\Http\Status;
use Amp\Promise;
use Amp\Loop;
use Amp\Websocket\Client;
use Amp\Websocket\Code;
use Amp\Websocket\Message;
use Amp\Websocket\Server\ClientHandler;
use Amp\Websocket\Server\Gateway;
use App\Module\Game\Bot\BotAllocator;
use App\Module\Game\Entity\Room;
use App\Module\Game\Entity\RoomBot;
use App\Module\Game\Entity\RoomParticipant;
use App\Module\Game\Repository\RoomRepository;
use App\Module\Game\Service\Initializer\GameInitializerRegistry;
use App\Module\Game\Service\TableManager;
use App\Module\User\Entity\User;
use App\Module\User\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Exception\JWTDecodeFailureException;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Psr\Log\LoggerInterface;
use function Amp\asyncCall;
use function Amp\call;

class RoomRealtimeClientHandler implements ClientHandler
{
    private const ATTR_ROOM_ID = 'app.realtime.room_id';
    private const ATTR_USER_ID = 'app.realtime.user_id';
    private const ATTR_USERNAME = 'app.realtime.username';
    private const ATTR_TOKEN_EXP = 'app.realtime.token_exp';
    private const ATTR_ROOM_NAME = 'app.realtime.room_name';

    public function __construct(
        private readonly JWTTokenManagerInterface $jwtManager,
        private readonly UserRepository $userRepository,
        private readonly RoomRepository $roomRepository,
        private readonly RoomRealtimeAccessChecker $accessChecker,
        private readonly RoomRealtimeBroker $broker,
        private readonly RoomRealtimePayloadBuilder $payloadBuilder,
        private readonly BotAllocator $botAllocator,
        private readonly TableManager $tables,
        private readonly GameInitializerRegistry $initializerRegistry,
        private readonly EntityManagerInterface $entityManager,
        private readonly LoggerInterface $logger
    ) {
    }

    public function handleHandshake(Gateway $gateway, Request $request, Response $response): Promise
    {
        return call(function () use ($gateway, $request, $response) {
            $roomId = $this->extractRoomId($request);

            $token = $this->extractToken($request);
            if ($token === null) {
                return yield $this->rejectHandshake($gateway, $request, Status::UNAUTHORIZED, 'Token manquant', [
                    'roomId' => $roomId,
                ]);
            }

            try {
                $payload = $this->jwtManager->parse($token);
            } catch (JWTDecodeFailureException $exception) {
                $this->logger->warning('Handshake rejete (token invalide)', ['exception' => $exception]);
                return yield $this->rejectHandshake($gateway, $request, Status::UNAUTHORIZED, 'Token invalide', [
                    'roomId' => $roomId,
                ]);
            }

            $identifierClaim = $this->jwtManager->getUserIdClaim();
            $identifier = $payload[$identifierClaim] ?? null;
            if (!is_string($identifier) || $identifier === '') {
                $this->logger->warning('Handshake refusé : identifiant token invalide', ['identifier'=>$identifier]);
                return yield $this->rejectHandshake($gateway, $request, Status::UNAUTHORIZED, 'Identifiant token invalide', [
                    'roomId' => $roomId,
                ]);
            }

            /** @var User|null $user */
            $user = $this->userRepository->findOneBy(['username' => $identifier]) ??
                $this->userRepository->find($identifier);
            if (!$user) {
                return yield $this->rejectHandshake($gateway, $request, Status::UNAUTHORIZED, 'Utilisateur introuvable', [
                    'roomId' => $roomId,
                    'username' => $identifier,
                ]);
            }

            $room = null;
            if ($roomId !== null && $roomId > 0) {
                /** @var Room|null $room */
                $room = $this->roomRepository->find($roomId);
                if (!$room) {
                $this->logger->warning('Handshake refusé : table introuvable', ['roomId'=>$roomId]);
                 return yield $this->rejectHandshake($gateway, $request, Status::NOT_FOUND, 'Table introuvable', [
                    'roomId' => $roomId,
                ]);
            }
                if (!$this->accessChecker->canAccess($user, $room)) {
                $this->logger->warning('Handshake refusé : accès refusé', ['roomId'=>$roomId, 'user'=>$userId]);
                 return yield $this->rejectHandshake($gateway, $request, Status::FORBIDDEN, 'Acces refuse', [
                    'roomId' => $roomId,
                    'userId' => $user->getId(),
                ]);
            }
            }

            $expiresAt = null;
            if (isset($payload['exp']) && is_numeric($payload['exp'])) {
                $expiresAt = (int) $payload['exp'];
            }
            if ($expiresAt !== null && $expiresAt <= time()) {
                return yield $this->rejectHandshake($gateway, $request, Status::UNAUTHORIZED, 'Session expiree', [
                    'roomId' => $roomId,
                    'userId' => $user->getId(),
                ]);
            }

            $this->logger->info('Handshake accepte pour la table', [
                'roomId' => $roomId,
                'userId' => $user->getId(),
                'username' => $user->getUsername(),
                'query' => $request->getUri()->getQuery(),
            ]);

            $request->setAttribute(self::ATTR_ROOM_ID, $roomId);
            $request->setAttribute(self::ATTR_USER_ID, $user->getId());
            $request->setAttribute(self::ATTR_USERNAME, $user->getUsername());
            $request->setAttribute(self::ATTR_TOKEN_EXP, $expiresAt);
            $request->setAttribute(self::ATTR_ROOM_NAME, $room?->getName() ?? '');

            return $response;
        });
    }

    public function handleClient(Gateway $gateway, Client $client, Request $request, Response $response): Promise
    {
        return call(function () use ($client, $request) {
            $roomId = $request->getAttribute(self::ATTR_ROOM_ID);
            $userId = $request->getAttribute(self::ATTR_USER_ID);
            $username = $request->getAttribute(self::ATTR_USERNAME);
            $expiresAt = $request->getAttribute(self::ATTR_TOKEN_EXP);
            $roomName = $request->getAttribute(self::ATTR_ROOM_NAME) ?? '';

            if (!is_int($userId)) {
                yield $client->close();
                return;
            }
            if ($roomId !== null && $roomId < 0) {
                yield $client->close();
                return;
            }

            $targetRoom = $roomId ?? 0;
            $this->broker->register($targetRoom, $client, [
                'userId' => $userId,
                'username' => $username,
                'roomName' => $roomId === null ? 'lobby' : $roomName,
            ]);

            $expiryWatcher = null;
            if (is_int($expiresAt)) {
                $remainingMs = max(0, ($expiresAt - time()) * 1000);
                if ($remainingMs <= 0) {
                    try {
                        yield $client->send(json_encode([
                            'type' => 'auth-invalid',
                            'reason' => 'expired',
                        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
                    } catch (\Throwable) {
                    }
                    try {
                        yield $client->close(Code::POLICY_ERROR, 'auth-invalid');
                    } catch (\Throwable) {
                    }
                    $this->broker->unregister($client);
                    return;
                }

                $expiryWatcher = Loop::delay($remainingMs, function (string $watcherId) use ($client, &$expiryWatcher): void {
                    $expiryWatcher = null;
                    \Amp\asyncCall(function () use ($client): \Generator {
                        try {
                            yield $client->send(json_encode([
                                'type' => 'auth-invalid',
                                'reason' => 'expired',
                            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
                        } catch (\Throwable) {
                            // ignore
                        }
                        try {
                            yield $client->close(Code::POLICY_ERROR, 'auth-invalid');
                        } catch (\Throwable) {
                            // ignore
                        }
                        return;
                    });
                });

                $client->onClose(static function (Client $client, int $code, string $reason) use (&$expiryWatcher): void {
                    if ($expiryWatcher !== null) {
                        Loop::cancel($expiryWatcher);
                        $expiryWatcher = null;
                    }
                });
            }

            if ($roomId !== null && $roomId > 0) {
                try {
                    $snapshotPayload = $this->payloadBuilder->buildById($roomId);
                    $initialMessage = [
                        'type' => 'initial',
                        'roomId' => $roomId,
                        'payload' => $snapshotPayload,
                    ];
                    yield $client->send(json_encode($initialMessage, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
                } catch (\Throwable $exception) {
                    $this->logger->error('Impossible de préparer la charge initiale WS', [
                        'exception' => $exception,
                        'roomId' => $roomId,
                    ]);
                }
            }

            try {
                while ($message = yield $client->receive()) {
                    \assert($message instanceof Message);
                    $buffer = null;
                    try {
                        $buffer = yield $message->buffer();
                    } catch (\Throwable) {
                        // ignore invalid
                    }
                    if ($buffer !== null) {
                        $this->processCommand($roomId, $client, $buffer);
                    }
                }
            } catch (\Throwable $exception) {
                $this->logger->debug('Client WS interrompu', [
                    'roomId' => $roomId,
                    'exception' => $exception,
                ]);
            } finally {
                if ($expiryWatcher !== null) {
                    Loop::cancel($expiryWatcher);
                    $expiryWatcher = null;
                }
                $this->broker->unregister($client);
            }
        });
    }

    private function processCommand(int $roomId, Client $client, string $buffer): void
    {
        $decoded = \json_decode($buffer, true);
        if (!is_array($decoded)) {
            return;
        }
        $type = $decoded['type'] ?? '';
        if (!is_string($type) || $type === '') {
            return;
        }
        $payload = $decoded['payload'] ?? [];
        asyncCall(function () use ($roomId, $client, $type, $payload) {
            try {
                switch ($type) {
                    case 'bot.add':
                        yield $this->handleBotAdd($roomId, $client, $payload);
                        break;
                    case 'bot.remove':
                        yield $this->handleBotRemove($roomId, $client, $payload);
                        break;
                    case 'room.join':
                        yield $this->handleRoomJoin($roomId, $client, $payload);
                        break;
                    case 'room.leave':
                        yield $this->handleRoomLeave($roomId, $client);
                        break;
                    case 'room.start':
                        yield $this->handleRoomStart($roomId, $client);
                        break;
                    case 'room.toggle-privacy':
                        yield $this->handleRoomTogglePrivacy($roomId, $client);
                        break;
                    case 'room.create':
                        yield $this->handleRoomCreate($client, $payload);
                        break;
                    default:
                        yield $this->sendError($client, 'Commande non reconnue : ' . $type);
                        break;
                }
            } catch (\Throwable $exception) {
                $this->logger->error('Erreur commande room WS', [
                    'roomId' => $roomId,
                    'type' => $type,
                    'error' => $exception->getMessage(),
                ]);
                yield $this->sendError($client, 'Erreur interne');
            }
        });
    }

    private function handleBotAdd(int $roomId, Client $client, array $payload): Promise
    {
        return call(function () use ($roomId, $client, $payload) {
            $room = $this->roomRepository->find($roomId);
            if (!$room) {
                yield $this->sendError($client, 'Table introuvable');
                return;
            }

            $ownerId = $room->getOwner()?->getId();
            $userId = $this->getUserIdFromClient($client);
            if ($userId === null || $ownerId !== $userId) {
                yield $this->sendError($client, 'Seul le propriétaire peut gérer les bots');
                return;
            }

            if (!$this->isRoomOpen($room)) {
                yield $this->sendError($client, 'Table déjà démarrée');
                return;
            }

            $currentCount = $room->getPlayers()->count() + $room->getBots()->count();
            if ($currentCount >= $room->getMaxPlayers()) {
                yield $this->sendError($client, 'Table pleine');
                return;
            }

            $requestedName = isset($payload['name']) ? trim((string)$payload['name']) : '';
            $usedNames = [];
            foreach ($room->getBots() as $bot) {
                $usedNames[] = $bot->getName();
            }
            foreach ($room->getPlayers() as $player) {
                $usedNames[] = $player->getUsername();
            }

            if ($requestedName !== '' && \in_array($requestedName, $usedNames, true)) {
                yield $this->sendError($client, 'Nom de bot déjà utilisé');
                return;
            }

            try {
                $name = $requestedName !== '' ? $requestedName : $this->botAllocator->pick($usedNames);
            } catch (\Throwable $exception) {
                yield $this->sendError($client, 'Impossible de générer un bot : ' . $exception->getMessage());
                return;
            }
            $bot = (new RoomBot())->setName($name);
            $room->addBot($bot);
            $this->entityManager->persist($bot);
            $this->entityManager->flush();

            yield $this->broadcastRoomUpdate($roomId, 'bot.added', ['bot' => $this->serializeBot($bot)]);
        });
    }

    private function handleRoomJoin(int $roomId, Client $client, array $payload): Promise
    {
        return call(function () use ($roomId, $client) {
            $room = $this->roomRepository->find($roomId);
            if (!$room) {
                yield $this->sendError($client, 'Table introuvable');
                return;
            }
            if (!$this->isRoomOpen($room)) {
                yield $this->sendError($client, 'Table déjà démarrée');
                return;
            }
            $userId = $this->getUserIdFromClient($client);
            if ($userId === null) {
                yield $this->sendError($client, 'Utilisateur introuvable');
                return;
            }
            $user = $this->userRepository->find($userId);
            if (!$user) {
                yield $this->sendError($client, 'Utilisateur introuvable');
                return;
            }

            $currentCount = $this->totalParticipants($room);
            if ($currentCount >= $room->getMaxPlayers()) {
                yield $this->sendError($client, 'Table pleine');
                return;
            }

            if (!$room->getPlayers()->contains($user)) {
                $room->addPlayer($user);
            }

            $repo = $this->entityManager->getRepository(RoomParticipant::class);
            $active = $repo->createQueryBuilder('p')
                ->andWhere('p.room = :room')
                ->andWhere('p.user = :user')
                ->andWhere('p.leftAt IS NULL')
                ->setParameter('room', $room)
                ->setParameter('user', $user)
                ->setMaxResults(1)
                ->getQuery()
                ->getOneOrNullResult();
            if (!$active) {
                $participant = (new RoomParticipant())
                    ->setRoom($room)
                    ->setUser($user)
                    ->setRole('player');
                $this->entityManager->persist($participant);
            }

            $this->entityManager->flush();
            yield $this->broadcastRoomUpdate($roomId, 'room.joined');
        });
    }

    private function handleRoomLeave(int $roomId, Client $client): Promise
    {
        return call(function () use ($roomId, $client) {
            $room = $this->roomRepository->find($roomId);
            if (!$room) {
                yield $this->sendError($client, 'Table introuvable');
                return;
            }
            $userId = $this->getUserIdFromClient($client);
            if ($userId === null) {
                yield $this->sendError($client, 'Utilisateur introuvable');
                return;
            }
            $user = $this->userRepository->find($userId);
            if (!$user) {
                yield $this->sendError($client, 'Utilisateur introuvable');
                return;
            }

            if ($room->getPlayers()->contains($user)) {
                $room->removePlayer($user);
            }
            $repo = $this->entityManager->getRepository(RoomParticipant::class);
            $active = $repo->createQueryBuilder('p')
                ->andWhere('p.room = :room')
                ->andWhere('p.user = :user')
                ->andWhere('p.leftAt IS NULL')
                ->setParameter('room', $room)
                ->setParameter('user', $user)
                ->setMaxResults(1)
                ->getQuery()
                ->getOneOrNullResult();
            if ($active instanceof RoomParticipant) {
                $active->leave();
            }

            $ownerId = $room->getOwner()?->getId();
            $remainingPlayers = $repo->countActiveByRoomAndRole($room, 'player');

            if ($remainingPlayers === 0) {
                // Aucun joueur : on supprime la table et on arrête là.
                $this->entityManager->remove($room);
                $this->entityManager->flush();
                return;
            }

            $ownerIsStillPlayer = $ownerId !== null && $room->getPlayers()->exists(
                static fn($_, User $u) => $u->getId() === $ownerId
            );
            if (!$ownerIsStillPlayer) {
                $nextOwner = $this->pickNextOwner($room);
                if ($nextOwner) {
                    $room->setOwner($nextOwner);
                }
            }

            $this->entityManager->flush();
            yield $this->broadcastRoomUpdate($roomId, 'room.left');
        });
    }

    private function handleRoomStart(int $roomId, Client $client): Promise
    {
        return call(function () use ($roomId, $client) {
            $room = $this->roomRepository->find($roomId);
            if (!$room) {
                yield $this->sendError($client, 'Table introuvable');
                return;
            }
            if (!$this->isRoomOpen($room)) {
                yield $this->sendError($client, 'Table déjà démarrée');
                return;
            }
            $participants = $this->totalParticipants($room);
            if ($participants < 2) {
                yield $this->sendError($client, 'Au moins deux participants sont requis pour démarrer');
                return;
            }

            $room->setStatus('started');
            $initialization = $this->initializerRegistry->initialize($room);
            $game = $this->tables->ensureGame($room);
            $game
                ->setState($initialization->getState())
                ->setCurrentRound($initialization->getCurrentRound());
            if (!$game->getStartedAt()) {
                $game->setStartedAt(new \DateTimeImmutable());
            }

            $this->entityManager->flush();
            yield $this->broadcastRoomUpdate($roomId, 'room.started');
        });
    }

    private function handleRoomTogglePrivacy(int $roomId, Client $client): Promise
    {
        return call(function () use ($roomId, $client) {
            $room = $this->roomRepository->find($roomId);
            if (!$room) {
                yield $this->sendError($client, 'Table introuvable');
                return;
            }
            $ownerId = $room->getOwner()?->getId();
            $userId = $this->getUserIdFromClient($client);
            if ($userId === null || $ownerId !== $userId) {
                yield $this->sendError($client, 'Seul le propriétaire peut modifier la confidentialité');
                return;
            }
            $room->setIsPrivate(!$room->isPrivate());
            $this->entityManager->flush();
            yield $this->broadcastRoomUpdate($roomId, 'room.privacy', ['isPrivate' => $room->isPrivate()]);
        });
    }

    private function handleRoomCreate(Client $client, array $payload): Promise
    {
        return call(function () use ($client, $payload) {
            $userId = $this->getUserIdFromClient($client);
            if ($userId === null) {
                yield $this->sendError($client, 'Authentification requise');
                return;
            }
            $user = $this->userRepository->find($userId);
            if (!$user) {
                yield $this->sendError($client, 'Utilisateur introuvable');
                return;
            }

            $gameType = isset($payload['gameType']) ? trim((string) $payload['gameType']) : '';
            if ($gameType === '') {
                yield $this->sendError($client, 'Type de jeu requis pour créer une table');
                return;
            }
            $name = trim((string)($payload['name'] ?? ''));
            $maxPlayers = isset($payload['maxPlayers']) ? (int)$payload['maxPlayers'] : 0;
            $isPrivate = isset($payload['isPrivate']) ? (bool)$payload['isPrivate'] : true;

            $defaults = $this->resolveGameDefaults($gameType);
            if ($name === '') {
                $name = $defaults['name'];
            }
            if ($maxPlayers <= 0) {
                $maxPlayers = $defaults['maxPlayers'];
            }

            $room = (new Room())
                ->setName($name)
                ->setGameType($gameType)
                ->setMaxPlayers($maxPlayers)
                ->setIsPrivate($isPrivate)
                ->setOwner($user)
                ->setStatus('setup');
            $room->addPlayer($user);

            $participant = (new RoomParticipant())
                ->setRoom($room)
                ->setUser($user)
                ->setRole('player');
            $this->entityManager->persist($room);
            $this->entityManager->persist($participant);
            $this->entityManager->flush();

            $roomId = $room->getId();
            if ($roomId === null) {
                yield $this->sendError($client, 'Impossible de créer la table');
                return;
            }

            $payload = $this->payloadBuilder->buildById($roomId);
            yield $client->send(json_encode([
                'type' => 'room.created',
                'roomId' => $roomId,
                'payload' => $payload,
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
            yield $this->broadcastRoomUpdate($roomId, 'room.created');
        });
    }

    private function resolveGameDefaults(string $gameType): array
    {
        $name = 'Table ' . $gameType;
        $max = 4;
        foreach (\App\Module\Game\Shared\Catalog::categories() as $category) {
            foreach ($category['games'] ?? [] as $game) {
                if (($game['id'] ?? '') === $gameType) {
                    $name = 'Table ' . ($game['name'] ?? $gameType);
                    $max = (int)($game['maxPlayers'] ?? $max);
                }
            }
        }
        return ['name' => $name, 'maxPlayers' => $max];
    }

    private function handleBotRemove(int $roomId, Client $client, array $payload): Promise
    {
        return call(function () use ($roomId, $client, $payload) {
            $room = $this->roomRepository->find($roomId);
            if (!$room) {
                yield $this->sendError($client, 'Table introuvable');
                return;
            }

            $ownerId = $room->getOwner()?->getId();
            $userId = $this->getUserIdFromClient($client);
            if ($userId === null || $ownerId !== $userId) {
                yield $this->sendError($client, 'Seul le propriétaire peut gérer les bots');
                return;
            }

            if (!$this->isRoomOpen($room)) {
                yield $this->sendError($client, 'Table déjà démarrée');
                return;
            }

            $botId = $payload['botId'] ?? null;
            if (!is_int($botId) && is_numeric($botId)) {
                $botId = (int)$botId;
            }
            if (!is_int($botId)) {
                yield $this->sendError($client, 'Identifiant de bot invalide');
                return;
            }

            $bot = $this->entityManager->getRepository(RoomBot::class)->find($botId);
            if (!$bot || $bot->getRoom()->getId() !== $roomId) {
                yield $this->sendError($client, 'Bot introuvable');
                return;
            }

            $botData = $this->serializeBot($bot);
            $room->removeBot($bot);
            $this->entityManager->remove($bot);
            $this->entityManager->flush();

            yield $this->broadcastRoomUpdate($roomId, 'bot.removed', [
                'botId' => $botId,
                'bot' => $botData,
            ]);
        });
    }

    private function getUserIdFromClient(Client $client): ?int
    {
        $meta = $this->broker->getClientMeta($client);
        if (!is_array($meta)) {
            return null;
        }
        $userId = $meta['userId'] ?? null;
        if (is_int($userId)) {
            return $userId;
        }
        if (is_numeric($userId)) {
            return (int)$userId;
        }
        return null;
    }

    private function broadcastRoomUpdate(int $roomId, string $type, array $extra = []): Promise
    {
        return call(function () use ($roomId, $type, $extra) {
            $payload = $this->payloadBuilder->buildById($roomId);
            foreach ($extra as $key => $value) {
                $payload[$key] = $value;
            }
            yield $this->broker->broadcast($roomId, [
                'type' => $type,
                'roomId' => $roomId,
                'payload' => $payload,
            ]);
        });
    }

    private function pickNextOwner(Room $room): ?User
    {
        $repo = $this->entityManager->getRepository(RoomParticipant::class);
        /** @var RoomParticipant|null $next */
        $next = $repo->createQueryBuilder('p')
            ->andWhere('p.room = :room')
            ->andWhere('p.role = :role')
            ->andWhere('p.leftAt IS NULL')
            ->setParameter('room', $room)
            ->setParameter('role', 'player')
            ->orderBy('p.joinedAt', 'ASC')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
        return $next?->getUser();
    }

    private function totalParticipants(Room $room): int
    {
        $repo = $this->entityManager->getRepository(RoomParticipant::class);
        $humanPlayers = method_exists($repo, 'countActiveByRoomAndRole')
            ? $repo->countActiveByRoomAndRole($room, 'player')
            : $room->getPlayers()->count();
        return $humanPlayers + $room->getBots()->count();
    }

    private function isRoomOpen(Room $room): bool
    {
        $status = strtolower((string) $room->getStatus());
        return \in_array($status, ['setup', 'open', 'ouvert', 'pending', 'preparing'], true);
    }

    private function isRoomInProgress(Room $room): bool
    {
        $status = $room->getStatus();
        return in_array($status, ['in_progress', 'started', 'en_cours'], true);
    }

    private function serializeBot(RoomBot $bot): array
    {
        return [
            'id' => $bot->getId(),
            'name' => $bot->getName(),
        ];
    }

    private function sendError(Client $client, string $message): Promise
    {
        return call(function () use ($client, $message) {
            try {
                yield $client->send(json_encode([
                    'type' => 'error',
                    'payload' => ['message' => $message],
                ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
            } catch (\Throwable) {
                // ignore
            }
        });
    }

    private function extractRoomId(Request $request): ?int
    {
        parse_str($request->getUri()->getQuery(), $query);
        $raw = $query['room'] ?? null;
        if (is_array($raw)) {
            $raw = $raw[0] ?? null;
        }
        if (!is_scalar($raw) || (string) $raw === '') {
            return null;
        }
        $id = (int) $raw;
        return $id >= 0 ? $id : null;
    }

    private function extractToken(Request $request): ?string
    {
        $authorization = $request->getHeader('authorization') ?? $request->getHeader('Authorization');
        if (is_string($authorization) && stripos($authorization, 'bearer ') === 0) {
            return trim(substr($authorization, 7));
        }

        parse_str($request->getUri()->getQuery(), $query);
        $token = $query['token'] ?? null;
        if (is_array($token)) {
            $token = $token[0] ?? null;
        }

        return is_string($token) && $token !== '' ? $token : null;
    }

    private function rejectHandshake(Gateway $gateway, Request $request, int $status, string $reason, array $context = []): Promise
    {
        $payload = array_merge([
            'status' => $status,
            'reason' => $reason,
            'query' => $request->getUri()->getQuery(),
        ], $context);
        $this->logger->warning('Handshake refuse', $payload);
        return $gateway->getErrorHandler()->handleError($status, $reason, $request);
    }
}






