<?php

namespace App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Service\Support;

final class PanierExpressTileAction
{
    public const DRAW_COURSE = 'draw_course';
    public const DRAW_EVENT = 'draw_event';
    public const DRAW_EXCHANGE = 'draw_exchange';
    public const START_QUIZ = 'start_quiz';
    public const BONUS_COURSE = 'bonus_course';
    public const SKIP_TURN = 'skip_turn';
    public const MOVE = 'move';
    public const ADVANCE_TO_NEXT_STAND = 'advance_to_next_stand';
    public const ARRIVAL = 'arrival';
    public const LOG = 'log';

    private function __construct()
    {
    }
}
