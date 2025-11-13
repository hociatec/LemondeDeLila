<?php

namespace App\Module\Game\Realtime;

use Amp\Promise;
use Amp\Success;
use Amp\Websocket\Client;
use Amp\Websocket\Server\Gateway;
use App\Module\Chat\Service\ChatService;

class PresenceRealtimeBroker
{
    public function __construct(private readonly ChatService $chatService)
    {
    }

    /** @var array<int, Client> */
    private array $clients = [];

    /** @var array<int, array{userId:int, username:string}> */
    private array $clientUsers = [];

    /** @var array<int, array{username:string, connections:int}> */
    private array $userPresence = [];

    /** @var array<int, \DateTimeImmutable> */
    private array $clientConnectedAt = [];

    private ?Gateway $gateway = null;

    /** @var callable|null */
    private $roomInfoProvider = null;

    /** @var array<string, mixed> */
    private array $lastSnapshot = [
        'type' => 'presence-update',
        'players' => [],
        'generatedAt' => null,
    ];

    private const MAX_CHAT_MESSAGES = 200;

    public function setGateway(Gateway $gateway): void
    {
        $this->gateway = $gateway;
    }

    public function setRoomInfoProvider(callable $provider): void
    {
        $this->roomInfoProvider = $provider;
    }

    /**
     * @param array<string, mixed> $meta
     */
    public function register(Client $client, array $meta): void
    {
        $clientId = $client->getId();
        $userId = $meta['userId'] ?? null;
        $username = $meta['username'] ?? null;
        if (!is_int($userId) || !is_string($username)) {
            return;
        }

        $this->clients[$clientId] = $client;
        $this->clientUsers[$clientId] = [
            'userId' => $userId,
            'username' => $username,
        ];
        $this->clientConnectedAt[$clientId] = new \DateTimeImmutable();

        if (!isset($this->userPresence[$userId])) {
            $this->userPresence[$userId] = [
                'username' => $username,
                'connections' => 0,
            ];
        }
        $this->userPresence[$userId]['connections']++;

        $client->onClose(function () use ($client): void {
            $this->unregister($client);
        });

        $this->broadcastPresence();
    }

    public function unregister(Client $client): void
    {
        $clientId = $client->getId();
        $meta = $this->clientUsers[$clientId] ?? null;

        unset($this->clients[$clientId], $this->clientUsers[$clientId], $this->clientConnectedAt[$clientId]);

        if ($meta) {
            $userId = $meta['userId'];
            if (isset($this->userPresence[$userId])) {
                $this->userPresence[$userId]['connections']--;
                if ($this->userPresence[$userId]['connections'] <= 0) {
                    unset($this->userPresence[$userId]);
                }
            }
        }

        $this->broadcastPresence();
    }

    /**
     * @return array<string, mixed>
     */
    public function getLastSnapshot(): array
    {
        return $this->lastSnapshot;
    }

    public function broadcastPresence(): Promise
    {
        $players = $this->computeSnapshot();

        $snapshot = [
            'type' => 'presence-update',
            'players' => $players,
            'generatedAt' => (new \DateTimeImmutable())->format(\DATE_ATOM),
        ];
        $this->lastSnapshot = $snapshot;

        return $this->broadcastPayload($snapshot);
    }

    public function sendSnapshotTo(Client $client): Promise
    {
        $snapshot = [
            'type' => 'presence-update',
            'players' => $this->computeSnapshot(),
            'generatedAt' => (new \DateTimeImmutable())->format(\DATE_ATOM),
        ];
        $this->lastSnapshot = $snapshot;

        return $this->sendPayload($client, $snapshot);
    }


    /**
     * @return array<string, mixed>
     */
    public function getConnectedUsers(): array
    {
        $users = [];
        foreach ($this->userPresence as $userId => $data) {
            $users[$userId] = [
                'id' => $userId,
                'username' => $data['username'],
            ];
        }
        return $users;
    }

    public function appendChatMessage(int $userId, string $text): void
    {
        $message = $this->chatService->recordMessage($userId, $text);
        $this->broadcastPayload($message);
    }

    /**
     * @return Promise<mixed>
     */
    public function sendChatHistoryTo(Client $client): Promise
    {
        $connectedAt = $this->clientConnectedAt[$client->getId()] ?? new \DateTimeImmutable();

        return $this->sendPayload($client, [
            'type' => 'chat-history',
            'messages' => $this->chatService->getRecentMessages(self::MAX_CHAT_MESSAGES, $connectedAt),
        ]);
    }

    /**
     * @return Promise<mixed>
     */
    private function broadcastPayload(array $payload): Promise
    {
        if (!$this->gateway || empty($this->clients)) {
            return new Success([]);
        }

        try {
            $encoded = json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (\JsonException) {
            return new Success([]);
        }

        return $this->gateway->multicast($encoded, array_keys($this->clients));
    }

    /**
     * @return Promise<mixed>
     */
    private function sendPayload(Client $client, array $payload): Promise
    {
        try {
            $encoded = json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (\JsonException) {
            return new Success();
        }

        return $client->send($encoded);
    }

    /**
     * @return array<int, array{ id:int, username:string, rooms:array<int, array{id:int, name:string}> }>
     */
    private function computeSnapshot(): array
    {
        $players = [];

        foreach ($this->userPresence as $userId => $data) {
            $players[$userId] = [
                'id' => $userId,
                'username' => $data['username'],
                'rooms' => [],
            ];
        }

        if ($this->roomInfoProvider) {
            $roomsByUser = \call_user_func($this->roomInfoProvider);
            if (is_array($roomsByUser)) {
                foreach ($roomsByUser as $userId => $rooms) {
                    if (!isset($players[$userId])) {
                        continue;
                    }
                    $players[$userId]['rooms'] = array_values($rooms);
                    usort($players[$userId]['rooms'], static fn(array $a, array $b) => strcmp($a['name'], $b['name']));
                }
            }
        }

        $list = array_values($players);
        usort($list, static fn(array $a, array $b) => strcmp($a['username'], $b['username']));
        return $list;
    }
}
