<?php

namespace App\Module\Game\GameCatalogue\Actions\VentsInfinis\MissionNemesis\Service;

use App\Module\Game\Bot\BotAllocator;
use App\Module\Game\Engine\GameEngineInterface;
use App\Module\Game\Entity\Room;
use App\Module\Game\Service\Participant;
use App\Module\Game\Service\ParticipantResolver;
use App\Module\Game\GameCatalogue\Actions\VentsInfinis\MissionNemesis\Service\Support\MissionNemesisBotEngine;
use App\Module\Game\GameCatalogue\Actions\VentsInfinis\MissionNemesis\Service\Support\MissionNemesisFleetFactory;
use App\Module\Game\GameCatalogue\Actions\VentsInfinis\MissionNemesis\Service\Support\MissionNemesisShotResolver;
use App\Module\User\Entity\User;

final class MissionNemesisService implements GameEngineInterface
{
    private const BOARD_SIZE = 10;

    private const SHIPS = [
        'Station spatiale' => 5,
        'Trou noir stabilise' => 4,
        'Asteroide defensif' => 3,
        'Satellite longue portee' => 3,
        'Sonde de reconnaissance' => 2,
    ];

    private ParticipantResolver $participantResolver;
    private BotAllocator $botAllocator;
    private MissionNemesisFleetFactory $fleetFactory;
    private MissionNemesisShotResolver $shotResolver;
    private MissionNemesisBotEngine $botEngine;

    public function __construct(
        ParticipantResolver $participantResolver,
        BotAllocator $botAllocator
    ) {
        $this->participantResolver = $participantResolver;
        $this->botAllocator = $botAllocator;
        $this->fleetFactory = new MissionNemesisFleetFactory(self::BOARD_SIZE, self::SHIPS);
        $this->shotResolver = new MissionNemesisShotResolver();
        $this->botEngine = new MissionNemesisBotEngine($this->fleetFactory, self::BOARD_SIZE);
    }

    public function getType(): string
    {
        return 'mission-nemesis';
    }

    public function defaultState(Room $room): array
    {
        $participants = $this->participantResolver->resolve($room);
        if ($participants === []) {
            throw new \RuntimeException('Aucun participant disponible pour lancer Mission Nemesis.');
        }

        $players = $this->initialPlayers($participants);
        if (count($players) < 2) {
            $players[] = $this->createEphemeralBot($players);
        }

        $state = [
            'type' => $this->getType(),
            'players' => $players,
            'turnIndex' => 0,
            'status' => 'placement',
            'winner' => null,
            'round' => 1,
            'log' => [],
        ];

        $this->executeBotTurns($state);

        return $state;
    }

    /**
     * @param Participant[] $participants
     * @return array<int,array<string,mixed>>
     */
    private function initialPlayers(array $participants): array
    {
        $players = [];
        foreach ($participants as $participant) {
            if (!$participant instanceof Participant) {
                continue;
            }
            $players[] = [
                'id' => $participant->id(),
                'username' => $participant->username(),
                'ships' => [],
                'shots' => [],
                'status' => 'placing',
                'isBot' => $participant->isBot(),
            ];
        }

        return $players;
    }

    /**
     * @param array<int,array<string,mixed>> $existing
     */
    private function createEphemeralBot(array $existing): array
    {
        $excluded = array_map(
            static fn(array $player): string => (string) ($player['username'] ?? ''),
            $existing
        );
        $name = $this->botAllocator->pick($excluded);

        return [
            'id' => $this->generateBotId($existing),
            'username' => $name,
            'ships' => [],
            'shots' => [],
            'status' => 'placing',
            'isBot' => true,
        ];
    }

    /**
     * @param array<int,array<string,mixed>> $existing
     */
    private function generateBotId(array $existing): int
    {
        $used = array_map(
            static fn(array $player): int => (int) ($player['id'] ?? 0),
            $existing
        );

        do {
            $id = -1 * random_int(1000, 1_000_000);
        } while (in_array($id, $used, true));

        return $id;
    }

    public function apply(array $state, array $payload, Room $room, User $user): array
    {
        $players = &$state['players'];
        $state['round'] = max(1, (int)($state['round'] ?? 1));
        if (!isset($state['log']) || !is_array($state['log'])) {
            $state['log'] = [];
        }

        $playerIndex = $this->findPlayerIndex($players, $user->getId());
        if ($playerIndex === -1) {
            return $state;
        }

        if (!isset($players[$playerIndex]['shots']) || !is_array($players[$playerIndex]['shots'])) {
            $players[$playerIndex]['shots'] = [];
        }
        if (!isset($players[$playerIndex]['status'])) {
            $players[$playerIndex]['status'] = $state['status'] === 'playing' ? 'alive' : 'placing';
        }

        $action = $payload['action'] ?? null;

        if ($state['status'] === 'placement' && $action === 'place_ships') {
            $state = $this->handlePlacement($state, $players, $playerIndex, $payload);
            $this->executeBotTurns($state);
            return $state;
        }

        if ($state['status'] === 'playing' && $action === 'fire') {
            $state = $this->handleFire($state, $players, $playerIndex, $payload);
            $this->executeBotTurns($state);
            return $state;
        }

        $this->executeBotTurns($state);

        return $state;
    }

    public function currentRound(array $state): int
    {
        return max(1, (int)($state['round'] ?? 1));
    }

    public function computeScore(array $state): ?array
    {
        $players = $state['players'] ?? [];
        $summary = array_map(function (array $player): array {
            return [
                'id' => $player['id'] ?? null,
                'status' => $player['status'] ?? 'unknown',
                'segmentsRemaining' => $this->shotResolver->countRemainingSegments($player),
            ];
        }, $players);

        if (($state['status'] ?? null) === 'ended') {
            return [
                'winnerId' => $state['winner'] ?? null,
                'rounds' => max(1, (int)($state['round'] ?? 1)),
                'players' => $summary,
            ];
        }

        $turnIndex = (int)($state['turnIndex'] ?? 0);

        return [
            'rounds' => max(1, (int)($state['round'] ?? 1)),
            'turnPlayerId' => $players[$turnIndex]['id'] ?? null,
            'players' => $summary,
        ];
    }

    public function presentState(array $state, User $viewer): array
    {
        $public = $state;
        $viewerId = (int) $viewer->getId();

        $publicPlayers = [];
        foreach ($state['players'] ?? [] as $player) {
            if (!is_array($player)) {
                continue;
            }
            $publicPlayers[] = $this->presentPlayer($player, $viewerId);
        }

        $public['players'] = $publicPlayers;
        $public['turnIndex'] = (int)($state['turnIndex'] ?? 0);
        $public['round'] = max(1, (int)($state['round'] ?? 1));
        $public['status'] = (string)($state['status'] ?? 'placement');

        if (isset($state['winner'])) {
            $public['winner'] = $state['winner'];
        }

        $log = [];
        foreach ($state['log'] ?? [] as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $log[] = [
                'type' => (string)($entry['type'] ?? ''),
                'message' => $entry['message'] ?? null,
                'from' => isset($entry['from']) ? (int)$entry['from'] : null,
                'target' => isset($entry['target']) ? (int)$entry['target'] : null,
                'x' => isset($entry['x']) ? (int)$entry['x'] : null,
                'y' => isset($entry['y']) ? (int)$entry['y'] : null,
                'result' => $entry['result'] ?? null,
            ];
        }

        if ($log !== []) {
            $public['log'] = array_slice($log, -40);
        } else {
            $public['log'] = [];
        }

        return $public;
    }

    private function executeBotTurns(array &$state): void
    {
        if (!isset($state['players']) || !is_array($state['players'])) {
            return;
        }

        $players = &$state['players'];
        $status = $state['status'] ?? 'placement';

        $changed = true;
        while ($status === 'placement' && $changed) {
            $changed = false;
            foreach ($players as $index => $player) {
                if (($player['isBot'] ?? false) !== true) {
                    continue;
                }
                if (($players[$index]['status'] ?? 'placing') === 'ready') {
                    continue;
                }
                $fleet = $this->botEngine->buildFleet();
                $state = $this->handlePlacement($state, $players, $index, [
                    'action' => 'place_ships',
                    'ships' => $fleet,
                ]);
                $players = &$state['players'];
                $status = $state['status'] ?? 'placement';
                $changed = true;
            }
        }

        while (($state['status'] ?? null) === 'playing') {
            $turnIndex = (int) ($state['turnIndex'] ?? -1);
            if (!isset($players[$turnIndex]) || ($players[$turnIndex]['isBot'] ?? false) !== true) {
                break;
            }

            $target = $this->botEngine->selectShot($players, $turnIndex);
            if ($target === null) {
                break;
            }

            $previousTurn = $turnIndex;
            $state = $this->handleFire($state, $players, $turnIndex, [
                'action' => 'fire',
                'coordinates' => $target,
            ]);

            if (($state['status'] ?? null) !== 'playing') {
                break;
            }

            $players = &$state['players'];
            if ((int) ($state['turnIndex'] ?? -1) === $previousTurn) {
                break;
            }
        }
    }

    private function handlePlacement(array &$state, array &$players, int $playerIndex, array $payload): array
    {
        $shipsPayload = $payload['ships'] ?? null;
        if (!is_array($shipsPayload) || !$this->fleetFactory->validate($shipsPayload)) {
            return $state;
        }

        $players[$playerIndex]['ships'] = $this->fleetFactory->prepare($shipsPayload);
        $players[$playerIndex]['status'] = 'ready';

        if ($this->allPlayersReady($players)) {
            foreach ($players as &$player) {
                if (!isset($player['shots']) || !is_array($player['shots'])) {
                    $player['shots'] = [];
                }
                $player['status'] = 'alive';
            }
            unset($player);

            $state['status'] = 'playing';
            $state['turnIndex'] = $this->nextActivePlayerIndex($players, -1) ?? 0;
            $state['round'] = 1;
            $state['log'][] = [
                'type' => 'phase',
                'message' => 'combat',
            ];
        }

        return $state;
    }

    private function handleFire(array &$state, array &$players, int $playerIndex, array $payload): array
    {
        $coordsPayload = $payload['coordinates'] ?? null;
        if (!$this->isValidCoordinatePayload($coordsPayload)) {
            return $state;
        }

        $turnIdx = (int)($state['turnIndex'] ?? 0);
        if ($playerIndex !== $turnIdx) {
            return $state;
        }

        $targetIndex = $this->nextAliveOpponentIndex($players, $playerIndex);
        if ($targetIndex === null) {
            return $state;
        }

        $coord = $this->normalizeCoordinate($coordsPayload);
        $targetId = $players[$targetIndex]['id'];
        if ($this->shotResolver->hasShotAt($players[$playerIndex]['shots'], $coord, $targetId)) {
            return $state;
        }

        $result = $this->shotResolver->registerShot($players[$targetIndex]['ships'], $coord);

        $players[$playerIndex]['shots'][] = [
            'x' => $coord['x'],
            'y' => $coord['y'],
            'targetId' => $targetId,
            'result' => $result,
        ];

        $state['log'][] = [
            'type' => 'shot',
            'from' => $players[$playerIndex]['id'],
            'target' => $targetId,
            'x' => $coord['x'],
            'y' => $coord['y'],
            'result' => $result,
        ];

        if ($result !== 'miss' && $this->shotResolver->playerHasNoShipsRemaining($players[$targetIndex])) {
            $players[$targetIndex]['status'] = 'eliminated';
            $state['log'][] = [
                'type' => 'elimination',
                'playerId' => $targetId,
            ];
        }

        if ($this->countAlivePlayers($players) <= 1) {
            $state['status'] = 'ended';
            $state['winner'] = $players[$playerIndex]['id'];
            return $state;
        }

        $nextIndex = $this->nextActivePlayerIndex($players, $playerIndex);
        if ($nextIndex !== null) {
            if ($nextIndex <= $playerIndex) {
                $state['round'] = (int)$state['round'] + 1;
            }
            $state['turnIndex'] = $nextIndex;
        }

        return $state;
    }

    private function findPlayerIndex(array $players, int $userId): int
    {
        foreach ($players as $index => $player) {
            if (($player['id'] ?? null) === $userId) {
                return $index;
            }
        }

        return -1;
    }

    private function allPlayersReady(array $players): bool
    {
        foreach ($players as $player) {
            if (empty($player['ships'])) {
                return false;
            }
        }
        return true;
    }

    private function nextAliveOpponentIndex(array $players, int $current): ?int
    {
        $count = count($players);
        for ($offset = 1; $offset < $count; $offset++) {
            $candidate = ($current + $offset) % $count;
            if (($players[$candidate]['status'] ?? 'placing') === 'alive') {
                return $candidate;
            }
        }

        return null;
    }

    private function nextActivePlayerIndex(array $players, int $current): ?int
    {
        $count = count($players);
        for ($offset = 1; $offset <= $count; $offset++) {
            $candidate = ($current + $offset) % $count;
            if (($players[$candidate]['status'] ?? null) === 'alive') {
                return $candidate;
            }
        }

        return null;
    }

    private function normalizeCoordinate(array $coord): array
    {
        return [
            'x' => (int)$coord['x'],
            'y' => (int)$coord['y'],
        ];
    }

    private function isValidCoordinatePayload($coords): bool
    {
        if (!is_array($coords) || !isset($coords['x'], $coords['y'])) {
            return false;
        }

        $coord = $this->normalizeCoordinate($coords);
        return $this->isWithinBoard($coord);
    }

    private function countAlivePlayers(array $players): int
    {
        $alive = 0;
        foreach ($players as $player) {
            if (($player['status'] ?? null) === 'alive') {
                $alive++;
            }
        }
        return $alive;
    }

    private function presentPlayer(array $player, int $viewerId): array
    {
        $id = isset($player['id']) ? (int) $player['id'] : null;
        $present = [
            'id' => $id,
            'username' => (string) ($player['username'] ?? ''),
            'status' => (string) ($player['status'] ?? 'placing'),
            'isBot' => (bool) ($player['isBot'] ?? false),
            'shots' => $this->presentShots($player),
        ];

        $present['ships'] = $this->presentShips($player, $viewerId);

        return $present;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function presentShips(array $player, int $viewerId): array
    {
        $ships = [];
        $isViewer = ($player['id'] ?? null) === $viewerId;

        foreach ($player['ships'] ?? [] as $ship) {
            if (!is_array($ship)) {
                continue;
            }

            if ($isViewer) {
                $coords = [];
                foreach ($ship['coords'] ?? [] as $coord) {
                    if (!is_array($coord)) {
                        continue;
                    }
                    $coords[] = [
                        'x' => (int) ($coord['x'] ?? 0),
                        'y' => (int) ($coord['y'] ?? 0),
                    ];
                }
                $hits = array_map(
                    static fn($hit) => (bool) $hit,
                    array_values($ship['hits'] ?? [])
                );
                $ships[] = [
                    'name' => (string) ($ship['name'] ?? ''),
                    'coords' => $coords,
                    'hits' => $hits,
                ];
            } else {
                $ships[] = [
                    'name' => (string) ($ship['name'] ?? ''),
                    'coords' => [],
                    'hits' => [],
                ];
            }
        }

        return array_values($ships);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function presentShots(array $player): array
    {
        $shots = [];
        foreach ($player['shots'] ?? [] as $shot) {
            if (!is_array($shot)) {
                continue;
            }

            $shots[] = [
                'x' => (int) ($shot['x'] ?? 0),
                'y' => (int) ($shot['y'] ?? 0),
                'targetId' => isset($shot['targetId']) ? (int) $shot['targetId'] : null,
                'result' => (string) ($shot['result'] ?? 'miss'),
            ];
        }

        return array_values($shots);
    }
}
