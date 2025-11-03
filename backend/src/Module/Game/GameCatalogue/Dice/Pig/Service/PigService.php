<?php

namespace App\Module\Game\GameCatalogue\Dice\Pig\Service;

use App\Module\Game\Entity\Room;
use App\Module\User\Entity\User;
use App\Module\Game\Engine\GameEngineInterface;

final class PigService implements GameEngineInterface
{
    public function getType(): string { return 'pig'; }
    public function defaultState(Room $room): array
    {
        $players = array_map(fn($u) => [ 'id' => $u->getId(), 'username' => $u->getUsername() ], $room->getPlayers()->toArray());
        return [
            'type' => 'pig',
            'players' => $players,
            'scores' => array_fill_keys(array_map(fn($p) => (string)$p['id'], $players), 0),
            'turnIndex' => 0,
            'turnScore' => 0,
            'lastRoll' => null,
            'target' => 100,
            'winner' => null,
            'status' => 'playing',
            'round' => 1,
        ];
    }

    public function apply(array $state, array $payload, Room $room, User $user): array
    {
        $players = $state['players'];
        $turnIdx = $state['turnIndex'];
        if (!$players) return $state;
        $current = $players[$turnIdx];
        if ($user->getId() !== $current['id'] || $state['winner']) return $state;
        $action = $payload['action'] ?? 'roll';
        if ($action === 'roll') {
            $roll = random_int(1,6);
            $state['lastRoll'] = $roll;
            if ($roll === 1) { $state['turnScore'] = 0; $state['turnIndex'] = ($turnIdx + 1) % count($players); }
            else { $state['turnScore'] += $roll; }
        } elseif ($action === 'hold') {
            $pid = (string)$current['id'];
            $state['scores'][$pid] += $state['turnScore'];
            $state['turnScore'] = 0;
            if ($state['scores'][$pid] >= $state['target']) { $state['winner'] = $current; $state['status'] = 'ended'; }
            else { $state['turnIndex'] = ($turnIdx + 1) % count($players); }
        } elseif ($action === 'new') {
            $next = $this->defaultState($room);
            $next['round'] = (int)($state['round'] ?? 1) + 1;
            return $next;
        }
        return $state;
    }

    public function currentRound(array $state): int
    {
        return (int)($state['round'] ?? 1);
    }

    public function computeScore(array $state): ?array
    {
        return [
            'scores' => $state['scores'] ?? [],
            'turnIndex' => $state['turnIndex'] ?? 0,
            'winner' => $state['winner'] ?? null,
        ];
    }
}
