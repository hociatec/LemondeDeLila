<?php

namespace App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Service\Support;

use App\Module\Game\Shared\Turn\TurnState;

final class PanierExpressTurnStateFactory
{
    public static function build(array &$state, int $currentPlayerIndex): TurnState
    {
        if (!isset($state['flags']) || !is_array($state['flags'])) {
            $state['flags'] = [];
        }

        $turn = isset($state['turn']) && is_array($state['turn'])
            ? TurnState::fromArray($state['turn'])
            : new TurnState(
                (int) ($state['turnIndex'] ?? $currentPlayerIndex),
                (int) ($state['round'] ?? 1),
                (int) ($state['flags']['turnDirection'] ?? 1),
                [],
                null
            );

        if (isset($state['flags']['turnDirection'])) {
            $dir = (int) $state['flags']['turnDirection'];
            $turn->direction = $dir === -1 ? -1 : 1;
        }

        foreach ($state['players'] ?? [] as $idx => $player) {
            $skips = (int) ($player['skipTurns'] ?? 0);
            if ($skips > 0) {
                $turn->skips[$idx] = $skips;
            } else {
                unset($turn->skips[$idx]);
            }
        }

        if (isset($state['flags']['extraTurn']) && (int) $state['flags']['extraTurn'] === $currentPlayerIndex) {
            $turn->extraTurnFor = $currentPlayerIndex;
            unset($state['flags']['extraTurn']);
        }

        return $turn;
    }
}
