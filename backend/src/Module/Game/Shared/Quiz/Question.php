<?php

namespace App\Module\Game\Shared\Quiz;

final class Question
{
    /**
     * @param string[] $choices
     */
    public function __construct(
        public readonly string $id,
        public readonly string $text,
        public readonly array $choices,
        public readonly int $correctIndex,
        public readonly ?string $explanation = null,
    ) {
    }
}
