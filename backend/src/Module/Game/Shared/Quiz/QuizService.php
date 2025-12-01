<?php

namespace App\Module\Game\Shared\Quiz;

final class QuizService
{
    public function validate(Question $question, int $answerIndex): QuizResult
    {
        $correct = $answerIndex === $question->correctIndex;
        return new QuizResult($correct, $question->explanation);
    }
}
