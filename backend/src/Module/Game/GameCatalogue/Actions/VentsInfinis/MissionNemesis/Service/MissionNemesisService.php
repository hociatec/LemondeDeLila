<?php

namespace App\Module\Game\GameCatalogue\Actions\VentsInfinis\MissionNemesis\Service;

use App\Module\Game\Entity\Room;
use App\Module\User\Entity\User;
use App\Module\Game\Engine\GameEngineInterface;

final class MissionNemesisService implements GameEngineInterface
{
    public function getType(): string { return 'mission-nemesis'; }

    private const SHIPS = [
        'Station spatiale' => 5,
        'Trou noir stabilisé' => 4,
        'Astéroïde' => 3,
        'Satellite' => 3,
        'Sonde' => 2,
    ];

    public function defaultState(Room $room): array
    {
        $players = array_map(fn($u) => [ 'id' => $u->getId(), 'username' => $u->getUsername() ], $room->getPlayers()->toArray());

        $playerState = fn($p) => [
            'id' => $p['id'],
            'username' => $p['username'],
            'ships' => [], // Ships with their coordinates and hit status
            'shots' => [], // Shots taken by this player
        ];

        return [
            'type' => 'mission-nemesis',
            'players' => array_map($playerState, $players),
            'turnIndex' => 0,
            'status' => 'placement', // Can be 'placement', 'playing', 'ended'
            'winner' => null, // Will contain the winner's ID at the end
            'round' => 1,
        ];
    }

    public function apply(array $state, array $payload, Room $room, User $user): array
    {
        $action = $payload['action'] ?? null;
        $players = &$state['players'];
        $turnIdx = &$state['turnIndex'];

        $findIndex = function(int $uid) use ($players): int {
            foreach ($players as $i => $p) {
                if ($p['id'] === $uid) return $i;
            }
            return -1;
        };

        $playerIndex = $findIndex($user->getId());

        if ($state['status'] === 'placement') {
            if ($action === 'place_ships' && isset($payload['ships']) && $playerIndex !== -1) {
                $ships = $payload['ships'];
                if (!$this->validateShips($ships)) {
                    return $state;
                }
                foreach ($ships as &$ship) {
                    $ship['hits'] = array_fill(0, count($ship['coords']), false);
                }
                $players[$playerIndex]['ships'] = $ships;

                $allPlayersPlaced = true;
                foreach ($players as $p) {
                    if (empty($p['ships'])) {
                        $allPlayersPlaced = false;
                        break;
                    }
                }

                if ($allPlayersPlaced) {
                    $state['status'] = 'playing';
                }
            }
        } elseif ($state['status'] === 'playing') {
            if ($playerIndex !== $turnIdx) {
                return $state; // Not this player's turn
            }

            if ($action === 'fire' && isset($payload['coordinates'])) {
                $coords = $payload['coordinates'];
                $opponentIndex = ($turnIdx + 1) % count($players);

                // Prevent duplicate shots
                foreach ($players[$playerIndex]['shots'] as $shot) {
                    if ($shot['x'] === $coords['x'] && $shot['y'] === $coords['y']) {
                        return $state; // Already shot here, do nothing
                    }
                }

                $opponent = &$players[$opponentIndex];
                $isHit = false;

                foreach ($opponent['ships'] as &$ship) {
                    foreach ($ship['coords'] as $i => $shipCoord) {
                        if ($shipCoord['x'] === $coords['x'] && $shipCoord['y'] === $coords['y']) {
                            $isHit = true;
                            $ship['hits'][$i] = true;
                            break 2;
                        }
                    }
                }

                $players[$playerIndex]['shots'][] = ['x' => $coords['x'], 'y' => $coords['y'], 'hit' => $isHit];

                if ($isHit) {
                    $allShipsNeutralized = true;
                    foreach ($opponent['ships'] as $ship) {
                        if (in_array(false, $ship['hits'], true)) {
                            $allShipsNeutralized = false;
                            break;
                        }
                    }

                    if ($allShipsNeutralized) {
                        $state['status'] = 'ended';
                        $state['winner'] = $players[$playerIndex]['id'];
                        return $state;
                    }
                }

                $state['turnIndex'] = $opponentIndex; // Switch turns
            }
        }

        return $state;
    }

    private function validateShips(array $ships): bool
    {
        if (count($ships) !== count(self::SHIPS)) {
            return false;
        }

        $allCoords = [];
        foreach ($ships as $ship) {
            if (!isset($ship['name']) || !isset(self::SHIPS[$ship['name']]) || count($ship['coords']) !== self::SHIPS[$ship['name']]) {
                return false;
            }

            $coords = $ship['coords'];
            sort($coords);
            $isHorizontal = true;
            $isVertical = true;
            for ($i = 0; $i < count($coords) - 1; $i++) {
                if ($coords[$i]['y'] !== $coords[$i+1]['y']) {
                    $isHorizontal = false;
                }
                if ($coords[$i]['x'] !== $coords[$i+1]['x']) {
                    $isVertical = false;
                }
            }

            if (!$isHorizontal && !$isVertical) {
                return false;
            }

            for ($i = 0; $i < count($coords) - 1; $i++) {
                if ($isHorizontal) {
                    if ($coords[$i+1]['x'] - $coords[$i]['x'] !== 1) {
                        return false;
                    }
                } else {
                    if ($coords[$i+1]['y'] - $coords[$i]['y'] !== 1) {
                        return false;
                    }
                }
            }

            foreach ($coords as $coord) {
                $allCoords[] = $coord['x'] . '-' . $coord['y'];
            }
        }

        return count($allCoords) === count(array_unique($allCoords));
    }

    public function currentRound(array $state): int
    {
        return (int)($state['round'] ?? 1);
    }

    public function computeScore(array $state): ?array
    {
        if (($state['status'] ?? null) === 'ended') {
            return ['winnerId' => $state['winner'] ?? null];
        }
        return null;
    }
}
