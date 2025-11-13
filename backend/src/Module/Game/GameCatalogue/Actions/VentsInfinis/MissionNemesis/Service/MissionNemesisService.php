<?php

namespace App\Module\Game\GameCatalogue\Actions\VentsInfinis\MissionNemesis\Service;

use App\Module\Game\Engine\GameEngineInterface;
use App\Module\Game\Entity\Room;
use App\Module\User\Entity\User;

final class MissionNemesisService implements GameEngineInterface
{
    private const BOARD_SIZE = 10;
    private const BOT_ID = -1;
    private const BOT_NAME = 'IA Nemesis';

    private const SHIPS = [
        'Station spatiale' => 5,
        'Trou noir stabilise' => 4,
        'Asteroide defensif' => 3,
        'Satellite longue portee' => 3,
        'Sonde de reconnaissance' => 2,
    ];

    public function getType(): string
    {
        return 'mission-nemesis';
    }

    public function defaultState(Room $room): array
    {
        $players = [];
        foreach ($room->getPlayers()->toArray() as $participant) {
            if (!$participant instanceof User) {
                continue;
            }
            $players[] = [
                'id' => $participant->getId(),
                'username' => $participant->getUsername(),
                'ships' => [],
                'shots' => [],
                'status' => 'placing',
                'isBot' => false,
            ];
        }

        if (count($players) < 2) {
            $players[] = $this->createBotPlayer();
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
                'segmentsRemaining' => $this->countRemainingSegments($player),
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

    private function createBotPlayer(): array
    {
        return [
            'id' => self::BOT_ID,
            'username' => self::BOT_NAME,
            'ships' => [],
            'shots' => [],
            'status' => 'placing',
            'isBot' => true,
        ];
    }

    private function executeBotTurns(array &$state): void
    {
        if (!isset($state['players']) || !is_array($state['players'])) {
            return;
        }

        $players = &$state['players'];

        while (true) {
            $botIndex = $this->findBotIndex($players);
            if ($botIndex === null) {
                return;
            }

            $status = $state['status'] ?? 'placement';

            if ($status === 'placement') {
                if (($players[$botIndex]['status'] ?? 'placing') !== 'ready') {
                    $fleet = $this->generateBotFleet();
                    $this->handlePlacement($state, $players, $botIndex, [
                        'action' => 'place_ships',
                        'ships' => $fleet,
                    ]);
                    continue;
                }
            }

            if ($status === 'playing' && ($state['turnIndex'] ?? -1) === $botIndex) {
                $target = $this->chooseBotShot($players, $botIndex);
                if ($target === null) {
                    break;
                }
                $this->handleFire($state, $players, $botIndex, [
                    'action' => 'fire',
                    'coordinates' => $target,
                ]);
                continue;
            }

            break;
        }
    }

    private function findBotIndex(array $players): ?int
    {
        foreach ($players as $index => $player) {
            if (($player['isBot'] ?? false) === true || ($player['id'] ?? null) === self::BOT_ID) {
                return $index;
            }
        }
        return null;
    }

    private function generateBotFleet(): array
    {
        $occupied = [];
        $fleet = [];
        foreach (self::SHIPS as $name => $size) {
            $fleet[] = [
                'name' => $name,
                'coords' => $this->generateShipCoordinates($size, $occupied),
            ];
        }
        return $fleet;
    }

    private function generateShipCoordinates(int $size, array &$occupied): array
    {
        for ($attempt = 0; $attempt < 100; $attempt++) {
            $horizontal = random_int(0, 1) === 1;
            $coords = [];
            $collision = false;

            if ($horizontal) {
                $startX = random_int(0, self::BOARD_SIZE - $size);
                $startY = random_int(0, self::BOARD_SIZE - 1);
                for ($i = 0; $i < $size; $i++) {
                    $x = $startX + $i;
                    $y = $startY;
                    $key = $x . '-' . $y;
                    if (isset($occupied[$key])) {
                        $collision = true;
                        break;
                    }
                    $coords[] = ['x' => $x, 'y' => $y];
                }
            } else {
                $startX = random_int(0, self::BOARD_SIZE - 1);
                $startY = random_int(0, self::BOARD_SIZE - $size);
                for ($i = 0; $i < $size; $i++) {
                    $x = $startX;
                    $y = $startY + $i;
                    $key = $x . '-' . $y;
                    if (isset($occupied[$key])) {
                        $collision = true;
                        break;
                    }
                    $coords[] = ['x' => $x, 'y' => $y];
                }
            }

            if ($collision) {
                continue;
            }

            foreach ($coords as $coord) {
                $occupied[$coord['x'] . '-' . $coord['y']] = true;
            }

            return $coords;
        }

        // Fallback: sequential placement to guarantee a result.
        $coords = [];
        for ($i = 0; $i < $size; $i++) {
            $coords[] = ['x' => $i, 'y' => 0];
            $occupied[$i . '-0'] = true;
        }
        return $coords;
    }

    private function chooseBotShot(array $players, int $botIndex): ?array
    {
        $targetIndex = $this->nextAliveOpponentIndex($players, $botIndex);
        if ($targetIndex === null) {
            return null;
        }

        $targetId = $players[$targetIndex]['id'] ?? null;
        $shots = $players[$botIndex]['shots'] ?? [];
        $used = [];
        foreach ($shots as $shot) {
            if (($shot['targetId'] ?? null) === $targetId) {
                $used[$shot['x'] . '-' . $shot['y']] = true;
            }
        }

        $available = [];
        for ($x = 0; $x < self::BOARD_SIZE; $x++) {
            for ($y = 0; $y < self::BOARD_SIZE; $y++) {
                $key = $x . '-' . $y;
                if (!isset($used[$key])) {
                    $available[] = ['x' => $x, 'y' => $y];
                }
            }
        }

        if (empty($available)) {
            return null;
        }

        return $available[random_int(0, count($available) - 1)];
    }

    private function handlePlacement(array &$state, array &$players, int $playerIndex, array $payload): array
    {
        $shipsPayload = $payload['ships'] ?? null;
        if (!is_array($shipsPayload) || !$this->validateShips($shipsPayload)) {
            return $state;
        }

        $players[$playerIndex]['ships'] = $this->prepareShips($shipsPayload);
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
        if ($this->hasShotAt($players[$playerIndex]['shots'], $coord, $targetId)) {
            return $state;
        }

        $result = $this->registerShot($players[$targetIndex]['ships'], $coord);

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

        if ($result !== 'miss' && $this->playerHasNoShipsRemaining($players[$targetIndex])) {
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

    private function validateShips(array $ships): bool
    {
        if (count($ships) !== count(self::SHIPS)) {
            return false;
        }

        $usedCoords = [];
        $usedNames = [];

        foreach ($ships as $ship) {
            if (
                !isset($ship['name'], $ship['coords'])
                || !isset(self::SHIPS[$ship['name']])
                || !is_array($ship['coords'])
            ) {
                return false;
            }

            if (isset($usedNames[$ship['name']])) {
                return false;
            }
            $usedNames[$ship['name']] = true;

            $coords = $this->normalizeCoords($ship['coords']);
            if (count($coords) !== self::SHIPS[$ship['name']]) {
                return false;
            }

            if (!$this->isAligned($coords) || !$this->isConsecutive($coords)) {
                return false;
            }

            foreach ($coords as $coord) {
                if (!$this->isWithinBoard($coord)) {
                    return false;
                }
                $key = $coord['x'] . '-' . $coord['y'];
                if (isset($usedCoords[$key])) {
                    return false;
                }
                $usedCoords[$key] = true;
            }
        }

        return true;
    }

    private function normalizeCoords(array $coords): array
    {
        $normalized = [];
        foreach ($coords as $coord) {
            if (!is_array($coord) || !isset($coord['x'], $coord['y'])) {
                return [];
            }
            $normalized[] = [
                'x' => (int)$coord['x'],
                'y' => (int)$coord['y'],
            ];
        }

        usort(
            $normalized,
            static function (array $a, array $b): int {
                return $a['x'] <=> $b['x'] ?: $a['y'] <=> $b['y'];
            }
        );

        return $normalized;
    }

    private function prepareShips(array $ships): array
    {
        $prepared = [];
        foreach ($ships as $ship) {
            $coords = $this->normalizeCoords($ship['coords']);
            $prepared[] = [
                'name' => $ship['name'],
                'coords' => $coords,
                'hits' => array_fill(0, count($coords), false),
            ];
        }

        return $prepared;
    }

    private function isAligned(array $coords): bool
    {
        if (count($coords) < 2) {
            return true;
        }

        $horizontal = true;
        $vertical = true;
        $firstX = $coords[0]['x'];
        $firstY = $coords[0]['y'];

        foreach ($coords as $coord) {
            if ($coord['y'] !== $firstY) {
                $horizontal = false;
            }
            if ($coord['x'] !== $firstX) {
                $vertical = false;
            }
        }

        return $horizontal || $vertical;
    }

    private function isConsecutive(array $coords): bool
    {
        if (count($coords) < 2) {
            return true;
        }

        $horizontal = $this->isHorizontal($coords);
        $vertical = $this->isVertical($coords);

        if (!$horizontal && !$vertical) {
            return false;
        }

        for ($i = 1, $count = count($coords); $i < $count; $i++) {
            if ($horizontal) {
                if (
                    $coords[$i]['x'] !== $coords[$i - 1]['x'] + 1
                    || $coords[$i]['y'] !== $coords[$i - 1]['y']
                ) {
                    return false;
                }
            } else {
                if (
                    $coords[$i]['y'] !== $coords[$i - 1]['y'] + 1
                    || $coords[$i]['x'] !== $coords[$i - 1]['x']
                ) {
                    return false;
                }
            }
        }

        return true;
    }

    private function isHorizontal(array $coords): bool
    {
        if (count($coords) < 2) {
            return false;
        }
        $firstY = $coords[0]['y'];
        foreach ($coords as $coord) {
            if ($coord['y'] !== $firstY) {
                return false;
            }
        }
        return true;
    }

    private function isVertical(array $coords): bool
    {
        if (count($coords) < 2) {
            return false;
        }
        $firstX = $coords[0]['x'];
        foreach ($coords as $coord) {
            if ($coord['x'] !== $firstX) {
                return false;
            }
        }
        return true;
    }

    private function isWithinBoard(array $coord): bool
    {
        return $coord['x'] >= 0
            && $coord['x'] < self::BOARD_SIZE
            && $coord['y'] >= 0
            && $coord['y'] < self::BOARD_SIZE;
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

    private function hasShotAt(array $shots, array $coord, int $targetId): bool
    {
        foreach ($shots as $shot) {
            if (
                ($shot['targetId'] ?? null) === $targetId
                && (int)$shot['x'] === $coord['x']
                && (int)$shot['y'] === $coord['y']
            ) {
                return true;
            }
        }

        return false;
    }

    private function registerShot(array &$ships, array $coord): string
    {
        foreach ($ships as &$ship) {
            foreach ($ship['coords'] as $index => $shipCoord) {
                if ($shipCoord['x'] === $coord['x'] && $shipCoord['y'] === $coord['y']) {
                    if (!isset($ship['hits'][$index])) {
                        $ship['hits'][$index] = false;
                    }
                    if ($ship['hits'][$index]) {
                        return 'hit';
                    }
                    $ship['hits'][$index] = true;
                    return $this->shipSunk($ship) ? 'sunk' : 'hit';
                }
            }
        }

        return 'miss';
    }

    private function shipSunk(array $ship): bool
    {
        foreach ($ship['hits'] ?? [] as $hit) {
            if ($hit === false) {
                return false;
            }
        }
        return true;
    }

    private function playerHasNoShipsRemaining(array $player): bool
    {
        return $this->countRemainingSegments($player) === 0;
    }

    private function countRemainingSegments(array $player): int
    {
        $remaining = 0;
        foreach ($player['ships'] ?? [] as $ship) {
            foreach ($ship['hits'] ?? [] as $hit) {
                if ($hit === false) {
                    $remaining++;
                }
            }
        }

        return $remaining;
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
}
