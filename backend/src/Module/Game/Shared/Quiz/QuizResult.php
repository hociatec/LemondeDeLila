<?php

namespace App\Module\Game\Shared\Quiz;

final class QuizResult
{
    public function __construct(
        public readonly bool $correct,
        public readonly ?string $explanation = null
    ) {
    }
}
