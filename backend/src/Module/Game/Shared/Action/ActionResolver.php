<?php

namespace App\Module\Game\Shared\Action;

use App\Module\Game\Shared\Deck\DeckManager;
use App\Module\Game\Shared\Quiz\QuizService;
use App\Module\Game\Shared\Quiz\Question;
use App\Module\Game\Shared\Dice\DiceRoll;
use App\Module\Game\Shared\Dice\DiceService;

final class ActionResolver
{
    private readonly DeckManager $deckManager;
    private readonly QuizService $quizService;
    private readonly DiceService $diceService;

    public function __construct(DeckManager $deckManager, QuizService $quizService, ?DiceService $diceService = null)
    {
        $this->deckManager = $deckManager;
        $this->quizService = $quizService;
        $this->diceService = $diceService ?: new DiceService();
    }

    /**
     * Applique une liste d'actions et retourne un tableau de logs/effets.
     * @param Action[] $actions
     */
    public function resolve(array $actions): array
    {
        $logs = [];
        foreach ($actions as $action) {
            switch ($action->type) {
                case 'DRAW_CARD':
                    $card = $this->deckManager->draw();
                    if ($card) {
                        $logs[] = ['type' => 'card', 'card' => $card];
                    }
                    break;
                case 'DISCARD_CARD':
                    if (isset($action->payload['card']) && $action->payload['card'] instanceof \App\Module\Game\Shared\Deck\Card) {
                        $this->deckManager->discard($action->payload['card']);
                    }
                    break;
                case 'QUIZ_VALIDATE':
                    if (isset($action->payload['question']) && $action->payload['question'] instanceof Question
                        && isset($action->payload['answer'])) {
                        $result = $this->quizService->validate($action->payload['question'], (int) $action->payload['answer']);
                        $logs[] = ['type' => 'quiz', 'correct' => $result->correct, 'explanation' => $result->explanation];
                    }
                    break;
                case 'LOG':
                    $logs[] = ['type' => 'log', 'message' => $action->payload['message'] ?? ''];
                    break;
                case 'ROLL_DICE':
                    $config = $action->payload['config'] ?? null;
                    if ($config instanceof DiceRoll) {
                        $roll = $this->diceService->roll($config);
                        $logs[] = ['type' => 'dice', 'values' => $roll->values, 'total' => $roll->total];
                    }
                    break;
                default:
                    $logs[] = ['type' => 'unknown-action', 'action' => $action->type];
            }
        }
        return $logs;
    }
}
