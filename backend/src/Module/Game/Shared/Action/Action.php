<?php

namespace App\Module\Game\Shared\Action;

final class Action
{
    public function __construct(
        public readonly string $type,
        public readonly array $payload = []
    ) {
    }
}
