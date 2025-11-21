<?php

namespace App\Module\Game\Shared\Deck;

/**
 * Gestion simple de pioches/défausses.
 */
final class DeckManager
{
    private Deck $deck;
    private Deck $discard;
    private Randomizer $randomizer;

    public function __construct(Deck $deck, ?Deck $discard = null, ?Randomizer $randomizer = null)
    {
        $this->deck = $deck;
        $this->discard = $discard ?: new Deck();
        $this->randomizer = $randomizer ?: new NativeRandomizer();
    }

    public function draw(): ?Card
    {
        if ($this->deck->isEmpty()) {
            $this->reshuffle();
        }
        return $this->deck->draw();
    }

    public function discard(Card $card): void
    {
        $this->discard->add($card);
    }

    public function reshuffle(): void
    {
        if ($this->discard->isEmpty()) {
            return;
        }
        $combined = array_merge($this->deck->all(), $this->discard->all());
        $shuffled = $this->randomizer->shuffle($combined);
        $this->deck = new Deck($shuffled);
        $this->discard = new Deck();
    }

    public function deck(): Deck
    {
        return $this->deck;
    }

    public function discardPile(): Deck
    {
        return $this->discard;
    }
}
