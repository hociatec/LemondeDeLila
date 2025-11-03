<?php

namespace App\Module\Game\Realtime;

use Amp\Promise;
use Amp\Success;
use Amp\Websocket\Client;
use Amp\Websocket\Server\Gateway;

class RoomRealtimeBroker
{
    public function __construct(private readonly PresenceRealtimeBroker $presenceBroker)
    {
        $this->presenceBroker->setRoomInfoProvider(function () {
            return $this->getRoomsByUser();
        });
    }

    /** @var array<int, array<int, Client>> */
    private array $roomClients = [];

    /** @var array<int, int> */
    private array $clientRooms = [];

    /** @var array<int, array<string, mixed>> */
    private array $clientMeta = [];

    private ?Gateway $gateway = null;

    public function setGateway(Gateway $gateway): void
    {
        $this->gateway = $gateway;
    }

    public function register(int $roomId, Client $client, array $meta = []): void
    {
        $clientId = $client->getId();
        $this->roomClients[$roomId][$clientId] = $client;
        $this->clientRooms[$clientId] = $roomId;
        $this->clientMeta[$clientId] = $meta;

        $client->onClose(function () use ($client) {
            $this->unregister($client);
        });
        $this->notifyPresenceListeners();
    }

    public function unregister(Client $client): void
    {
        $clientId = $client->getId();
        if (!isset($this->clientRooms[$clientId])) {
            return;
        }
        $roomId = $this->clientRooms[$clientId];
        unset($this->roomClients[$roomId][$clientId], $this->clientRooms[$clientId], $this->clientMeta[$clientId]);
        if (empty($this->roomClients[$roomId])) {
            unset($this->roomClients[$roomId]);
        }
        $this->notifyPresenceListeners();
    }

    /**
     * @return Promise<array<mixed>>
     */
    public function broadcast(int $roomId, array $message): Promise
    {
        if (!$this->gateway) {
            return new Success([]);
        }
        $clientIds = array_keys($this->roomClients[$roomId] ?? []);
        if (empty($clientIds)) {
            return new Success([]);
        }
        try {
            $payload = json_encode($message, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (\JsonException) {
            return new Success([]);
        }
        return $this->gateway->multicast($payload, $clientIds);
    }

    public function countRoomClients(int $roomId): int
    {
        return isset($this->roomClients[$roomId]) ? count($this->roomClients[$roomId]) : 0;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function getClientMeta(Client $client): ?array
    {
        return $this->clientMeta[$client->getId()] ?? null;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function getPresenceSnapshot(): array
    {
        $presence = [];

        foreach ($this->clientMeta as $clientId => $meta) {
            $userId = $meta['userId'] ?? null;
            $username = $meta['username'] ?? null;
            if ($userId === null || $username === null) {
                continue;
            }

            if (!isset($presence[$userId])) {
                $presence[$userId] = [
                    'id' => $userId,
                    'username' => $username,
                    'rooms' => [],
                ];
            }

            $roomId = $this->clientRooms[$clientId] ?? null;
            if ($roomId !== null) {
                $roomName = $meta['roomName'] ?? null;
                $presence[$userId]['rooms'][$roomId] = [
                    'id' => $roomId,
                    'name' => $roomName ?? sprintf('Table #%d', $roomId),
                ];
            }
        }

        $players = array_map(static function (array $entry): array {
            $rooms = array_values($entry['rooms']);
            usort($rooms, static fn(array $a, array $b) => strcmp($a['name'], $b['name']));
            return [
                'id' => $entry['id'],
                'username' => $entry['username'],
                'rooms' => $rooms,
            ];
        }, array_values($presence));

        usort($players, static fn(array $a, array $b) => strcmp($a['username'], $b['username']));

        return $players;
    }

    /**
     * @return array<int, array<int, array{id:int, name:string}>>
     */
    public function getRoomsByUser(): array
    {
        $mapping = [];

        foreach ($this->clientMeta as $clientId => $meta) {
            $userId = $meta['userId'] ?? null;
            $roomId = $this->clientRooms[$clientId] ?? null;
            if (!is_int($userId) || !is_int($roomId)) {
                continue;
            }
            $roomName = $meta['roomName'] ?? sprintf('Table #%d', $roomId);
            if (!isset($mapping[$userId])) {
                $mapping[$userId] = [];
            }
            $mapping[$userId][$roomId] = [
                'id' => $roomId,
                'name' => $roomName,
            ];
        }

        return $mapping;
    }

    private function notifyPresenceListeners(): void
    {
        $this->presenceBroker->broadcastPresence();
    }
}
