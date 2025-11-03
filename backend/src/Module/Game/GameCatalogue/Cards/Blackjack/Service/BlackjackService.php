<?php

namespace App\Module\Game\GameCatalogue\Cards\Blackjack\Service;

use App\Module\Game\Entity\Room;
use App\Module\User\Entity\User;
use App\Module\Game\Engine\GameEngineInterface;

final class BlackjackService implements GameEngineInterface
{
    public function getType(): string { return 'blackjack'; }
    private function deck(): array
    {
        $suits = ['H','D','C','S']; $ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
        $deck = [];
        foreach ($suits as $s) foreach ($ranks as $r) $deck[] = $r.$s;
        shuffle($deck);
        return $deck;
    }
    private function handTotal(array $hand): int
    {
        $total = 0; $aces = 0;
        foreach ($hand as $card) {
            $rank = preg_replace('/[HDCS]/','', $card);
            if ($rank === 'A') { $aces++; $total += 11; }
            elseif (in_array($rank, ['K','Q','J'])) { $total += 10; }
            else { $total += (int)$rank; }
        }
        while ($total > 21 && $aces > 0) { $total -= 10; $aces--; }
        return $total;
    }

    public function defaultState(Room $room): array
    {
        $players = array_map(fn($u) => [ 'id' => $u->getId(), 'username' => $u->getUsername() ], $room->getPlayers()->toArray());
        return [
            'type' => 'blackjack',
            'deck' => $this->deck(),
            'dealer' => ['hand' => [], 'total' => 0, 'hidden' => true],
            'players' => array_map(fn($p)=> [ 'id' => $p['id'], 'username' => $p['username'], 'hand' => [], 'total' => 0, 'stood' => false, 'busted' => false ], $players),
            'turnIndex' => 0,
            'status' => 'init',
            'results' => [],
            'round' => 1,
        ];
    }

    public function apply(array $state, array $payload, Room $room, User $user): array
    {
        $action = $payload['action'] ?? 'deal';
        $players = &$state['players'];
        $dealer = &$state['dealer'];
        $deck = &$state['deck'];
        $turnIdx = &$state['turnIndex'];
        $findIndex = function(int $uid) use ($players): int { foreach ($players as $i=>$p) if ($p['id']===$uid) return $i; return -1; };
        if ($action === 'deal') {
            $prevRound = (int)($state['round'] ?? 0);
            $state = $this->defaultState($room);
            if ($prevRound > 0) { $state['round'] = $prevRound + 1; }
            $players = &$state['players']; $dealer = &$state['dealer']; $deck = &$state['deck']; $turnIdx = &$state['turnIndex'];
            $draw = function() use (&$deck) { return array_pop($deck); };
            foreach ($players as &$p) { $p['hand'] = [$draw(), $draw()]; $p['total'] = $this->handTotal($p['hand']); }
            $dealer['hand'] = [$draw(), $draw()]; $dealer['total'] = $this->handTotal($dealer['hand']);
            $state['status'] = 'playing';
        } elseif ($state['status'] === 'playing') {
            $idx = $findIndex($user->getId());
            if ($idx !== $turnIdx) { return $state; }
            if ($action === 'hit') {
                $card = array_pop($deck); $players[$idx]['hand'][] = $card; $players[$idx]['total'] = $this->handTotal($players[$idx]['hand']);
                if ($players[$idx]['total'] > 21) { $players[$idx]['busted'] = true; $players[$idx]['stood'] = true; $turnIdx = ($turnIdx + 1) % count($players); }
            } elseif ($action === 'stand') {
                $players[$idx]['stood'] = true; $turnIdx = ($turnIdx + 1) % count($players);
            }
            $allDone = true; foreach ($players as $p) { if (!$p['stood']) { $allDone = false; break; } }
            if ($allDone) { $state['status'] = 'dealer'; }
        }
        if ($state['status'] === 'dealer') {
            while ($state['dealer']['total'] < 17) { $card = array_pop($state['deck']); $state['dealer']['hand'][] = $card; $state['dealer']['total'] = $this->handTotal($state['dealer']['hand']); }
            $state['dealer']['hidden'] = false;
            $results = [];
            foreach ($state['players'] as $p) {
                $res = 'lose';
                if ($p['total'] > 21) { $res = 'lose'; }
                elseif ($state['dealer']['total'] > 21) { $res = 'win'; }
                elseif ($p['total'] > $state['dealer']['total']) { $res = 'win'; }
                elseif ($p['total'] === $state['dealer']['total']) { $res = 'push'; }
                else { $res = 'lose'; }
                $results[] = ['player' => ['id'=>$p['id'],'username'=>$p['username']], 'result' => $res, 'playerTotal' => $p['total'], 'dealerTotal' => $state['dealer']['total']];
            }
            $state['results'] = $results;
            $state['status'] = 'ended';
        }
        return $state;
    }

    public function currentRound(array $state): int
    {
        return (int)($state['round'] ?? 1);
    }

    public function computeScore(array $state): ?array
    {
        if (($state['status'] ?? null) === 'ended') {
            return ['results' => $state['results'] ?? []];
        }
        return [
            'players' => array_map(
                fn($p) => ['id' => $p['id'] ?? null, 'username' => $p['username'] ?? '', 'total' => $p['total'] ?? 0],
                $state['players'] ?? []
            )
        ];
    }
}
