<?php

namespace App\Module\Game\Shared;

final class Catalog
{
    public static function categories(): array
    {
        return [
            [
                'id' => 'classic',
                'name' => 'Classiques',
                'games' => [
                    ['id' => 'tictactoe', 'name' => 'TicTacToe', 'minPlayers' => 2, 'maxPlayers' => 2],
                ],
            ],
            [
                'id' => 'dice',
                'name' => 'Dés',
                'games' => [
                    ['id' => 'pig', 'name' => 'Pig', 'minPlayers' => 2, 'maxPlayers' => 4],
                ],
            ],
            [
                'id' => 'cards',
                'name' => 'Cartes',
                'games' => [
                    ['id' => 'blackjack', 'name' => 'Blackjack', 'minPlayers' => 1, 'maxPlayers' => 4],
                    ['id' => 'bataille', 'name' => 'Bataille', 'minPlayers' => 2, 'maxPlayers' => 2],
                ],
            ],
            [
                'id' => 'jeuxdecartes',
                'name' => 'Jeux de cartes',
                'games' => [
                    ['id' => 'dame-nature', 'name' => 'Dame Nature', 'minPlayers' => 2, 'maxPlayers' => 6],
                ],
            ],
        ];
    }
}
