<?php

namespace App\Module\Game\Engine;

use App\Module\Game\Entity\Room;
use App\Module\User\Entity\User;

interface GameEngineInterface
{
    /** Type technique (ex: 'tictactoe', 'pig', 'blackjack', 'bataille') */
    public function getType(): string;

    /** Etat initial du jeu pour une room donnée */
    public function defaultState(Room $room): array;

    /** Applique un coup/mouvement et retourne le nouvel état */
    public function apply(array $state, array $payload, Room $room, User $user): array;

    /** Retourne la manche courante à partir de l'état */
    public function currentRound(array $state): int;

    /** Calcule un score/synthèse normalisé pour l'UI */
    public function computeScore(array $state): ?array;
}

