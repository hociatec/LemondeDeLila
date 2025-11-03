<?php

namespace App\Module\Game\GameCatalogue\Cards\Bataille\Service;

use App\Module\Game\Entity\Room;
use App\Module\User\Entity\User;
use App\Module\Game\Engine\GameEngineInterface;

final class BatailleService implements GameEngineInterface
{
    public function getType(): string { return 'bataille'; }
    private function deck(): array
    {
        $suits = ['H','D','C','S']; $ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
        $deck = [];
        foreach ($suits as $s) foreach ($ranks as $r) $deck[] = $r.$s;
        shuffle($deck);
        return $deck;
    }
    private function cardRankValue(string $card): int
    {
        $rank = preg_replace('/[HDCS]/','', $card);
        $map = ['A'=>14,'K'=>13,'Q'=>12,'J'=>11];
        return $map[$rank] ?? (int)$rank;
    }

    public function defaultState(Room $room): array
    {
        $players = array_values(array_map(fn($u) => [ 'id' => $u->getId(), 'username' => $u->getUsername(), 'deck' => [] ], $room->getPlayers()->toArray()));
        if (count($players) < 2) { $players[] = [ 'id'=>0, 'username'=>'Bot', 'deck'=>[] ]; }
        $players = array_slice($players, 0, 2);
        $deck = $this->deck(); $i = 0; foreach ($deck as $card) { $players[$i%2]['deck'][] = $card; $i++; }
        return [ 'type'=>'bataille', 'players'=>$players, 'pile'=>[], 'last'=>null, 'round'=>0, 'status'=>'playing', 'winner'=>null ];
    }

    public function apply(array $state, array $payload, Room $room, User $user): array
    {
        if (($state['status'] ?? 'playing') === 'ended') return $state;
        $players = &$state['players']; $pile = &$state['pile'];
        $action = $payload['action'] ?? 'round';
        if ($action === 'deal') { return $this->defaultState($room); }
        $draw = function(int $pi) use (&$players) { return count($players[$pi]['deck']) ? array_shift($players[$pi]['deck']) : null; };
        $resolve = function() use (&$players,&$pile,&$draw) {
            $a = $draw(0); $b = $draw(1);
            if ($a === null || $b === null) return $a===null ? 1 : 0;
            $pile[] = $a; $pile[] = $b;
            $va = $this->cardRankValue($a); $vb = $this->cardRankValue($b);
            if ($va === $vb) {
                $fdA = $draw(0); $fdB = $draw(1);
                if ($fdA !== null) $pile[] = $fdA; if ($fdB !== null) $pile[] = $fdB;
                if ($fdA === null || $fdB === null) return $fdA===null ? 1 : 0;
                return $resolve();
            }
            return $va > $vb ? 0 : 1;
        };
        $winnerIdx = $resolve();
        if ($winnerIdx === null) { $state['status'] = 'ended'; }
        else {
            foreach ($pile as $c) { $players[$winnerIdx]['deck'][] = $c; }
            $state['last'] = [ 'winner' => $players[$winnerIdx] ];
            $state['round'] = ($state['round'] ?? 0) + 1; $pile = [];
            if (count($players[0]['deck']) === 0) { $state['status'] = 'ended'; $state['winner'] = $players[1]; }
            if (count($players[1]['deck']) === 0) { $state['status'] = 'ended'; $state['winner'] = $players[0]; }
        }
        return $state;
    }

    public function currentRound(array $state): int
    {
        return (int)($state['round'] ?? 0);
    }

    public function computeScore(array $state): ?array
    {
        return [
            'decks' => array_map(
                fn($p) => ['id' => $p['id'] ?? null, 'username' => $p['username'] ?? '', 'count' => isset($p['deck']) ? count($p['deck']) : 0],
                $state['players'] ?? []
            )
        ];
    }
}
