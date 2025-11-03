<?php

namespace App\Module\Game\GameCatalogue\Classic\TicTacToe\Service;

use App\Module\Game\Entity\Room;
use App\Module\User\Entity\User;
use App\Module\Game\Engine\GameEngineInterface;

final class TicTacToeService implements GameEngineInterface
{
    public function getType(): string { return 'tictactoe'; }
    public function defaultState(Room $room): array
    {
        return [ 'type' => 'tictactoe', 'board' => array_fill(0,9,null), 'turn' => 'X', 'winner' => null, 'round' => 1 ];
    }

    public function apply(array $state, array $payload, Room $room, User $user): array
    {
        $idx = (int)($payload['index'] ?? -1);
        if ($idx < 0 || $idx > 8 || $state['winner'] !== null || $state['board'][$idx] !== null) return $state;
        $state['board'][$idx] = $state['turn'];
        $wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
        foreach ($wins as $w) { [$a,$b,$c] = $w; if ($state['board'][$a] && $state['board'][$a]===$state['board'][$b] && $state['board'][$a]===$state['board'][$c]) { $state['winner']=$state['board'][$a]; } }
        if ($state['winner'] === null && !in_array(null, $state['board'], true)) { $state['winner'] = 'draw'; }
        $state['turn'] = $state['turn'] === 'X' ? 'O' : 'X';
        return $state;
    }

    public function currentRound(array $state): int
    {
        return (int)($state['round'] ?? 1);
    }

    public function computeScore(array $state): ?array
    {
        return ['winner' => $state['winner'] ?? null];
    }
}
