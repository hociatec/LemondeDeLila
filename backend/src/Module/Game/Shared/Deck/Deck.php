<?php

namespace App\Module\Game\Shared\Deck;

final class Deck
{
    /** @var Card[] */
    private array $cards;

    public function __construct(array $cards = [])
    {
        $this->cards = array_values($cards);
    }

    public function isEmpty(): bool
    {
        return count($this->cards) === 0;
    }

    public function draw(): ?Card
    {
        return array_shift($this->cards) ?: null;
    }

    public function add(Card $card): void
    {
        $this->cards[] = $card;
    }

    public function addAll(array $cards): void
    {
        foreach ($cards as $card) {
            if ($card instanceof Card) {
                $this->cards[] = $card;
            }
        }
    }

    /** @return Card[] */
    public function all(): array
    {
        return $this->cards;
    }
}
