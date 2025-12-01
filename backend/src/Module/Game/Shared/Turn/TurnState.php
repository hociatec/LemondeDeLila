<?php

namespace App\Module\Game\Shared\Turn;

/**
 * Représente l'état sérialisable d'un tour : index courant, round, direction,
 * skips et extra-turn éventuel.
 */
final class TurnState
{
    public int $index;
    public int $round;
    public int $direction;
    /** @var array<int,int> nombre de tours à passer par playerIndex */
    public array $skips;
    public ?int $extraTurnFor;

    public function __construct(
        int $index = 0,
        int $round = 1,
        int $direction = 1,
        array $skips = [],
        ?int $extraTurnFor = null
    ) {
        $this->index = $index;
        $this->round = $round;
        $this->direction = $direction === -1 ? -1 : 1;
        $this->skips = $skips;
        $this->extraTurnFor = $extraTurnFor;
    }

    /**
        * Sérialisation sous forme de tableau (pour stockage dans state).
     * @return array<string,mixed>
     */
    public function toArray(): array
    {
        return [
            'index' => $this->index,
            'round' => $this->round,
            'direction' => $this->direction,
            'skips' => $this->skips,
            'extraTurnFor' => $this->extraTurnFor,
        ];
    }

    /**
     * @param array<string,mixed> $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            (int)($data['index'] ?? 0),
            (int)($data['round'] ?? 1),
            (int)($data['direction'] ?? 1),
            is_array($data['skips'] ?? null) ? $data['skips'] : [],
            isset($data['extraTurnFor']) ? ($data['extraTurnFor'] === null ? null : (int)$data['extraTurnFor']) : null
        );
    }
}
