<?php

namespace App\Module\Game\Exchange;

final class ExchangeCard
{
    /**
     * @param array<string,mixed> $metadata
     */
    public function __construct(
        private readonly string $id,
        private readonly string $title,
        private readonly string $description = '',
        private readonly array $metadata = []
    ) {
    }

    public function id(): string
    {
        return $this->id;
    }

    public function title(): string
    {
        return $this->title;
    }

    public function description(): string
    {
        return $this->description;
    }

    /**
     * @return array<string,mixed>
     */
    public function metadata(): array
    {
        return $this->metadata;
    }
}
