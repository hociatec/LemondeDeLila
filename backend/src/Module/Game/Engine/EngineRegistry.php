<?php

namespace App\Module\Game\Engine;

final class EngineRegistry
{
    /** @var array<string, GameEngineInterface> */
    private array $engines = [];

    /** @param iterable<GameEngineInterface> $engines */
    public function __construct(iterable $engines)
    {
        foreach ($engines as $engine) {
            $this->engines[$engine->getType()] = $engine;
        }
    }

    public function get(string $type): ?GameEngineInterface
    {
        return $this->engines[$type] ?? null;
    }
}

