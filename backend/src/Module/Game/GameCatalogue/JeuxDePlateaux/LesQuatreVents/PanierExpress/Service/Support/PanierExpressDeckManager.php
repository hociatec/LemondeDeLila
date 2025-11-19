<?php

namespace App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Service\Support;

final class PanierExpressDeckManager
{
    public const DECK_COURSES = 'courses';
    public const DECK_EVENT = 'event';
    public const DECK_EXCHANGE = 'exchange';
    public const DECK_QUIZ = 'quiz';

    /**
     * @param array<string, mixed> $reference
     * @return array<string, array<int, array<string, mixed>>>
     */
    public function initialiseDecks(array $reference, PanierExpressRandomizerInterface $randomizer): array
    {
        $courses = [];
        foreach ($reference['courses']['fruits'] ?? [] as $card) {
            $courses[] = [
                'id' => $card['id'] ?? $card['name'],
                'name' => $card['name'] ?? 'Fruit',
                'category' => 'fruit',
            ];
        }
        foreach ($reference['courses']['vegetables'] ?? [] as $card) {
            $courses[] = [
                'id' => $card['id'] ?? $card['name'],
                'name' => $card['name'] ?? 'Légume',
                'category' => 'vegetable',
            ];
        }
        $randomizer->shuffle($courses);

        $eventCards = $reference['eventCards'] ?? [];
        $randomizer->shuffle($eventCards);

        $exchangeCards = $reference['exchangeCards'] ?? [];
        $randomizer->shuffle($exchangeCards);

        $quizCards = $reference['quizCards'] ?? [];
        $randomizer->shuffle($quizCards);

        return [
            self::DECK_COURSES => $courses,
            self::DECK_EVENT => $eventCards,
            self::DECK_EXCHANGE => $exchangeCards,
            self::DECK_QUIZ => $quizCards,
        ];
    }

    /**
     * @param array<string, mixed> $state
     * @return array<string, mixed>|null
     */
    public function drawCard(array &$state, string $deck, PanierExpressRandomizerInterface $randomizer): ?array
    {
        if (!isset($state['decks'][$deck]) || !is_array($state['decks'][$deck])) {
            return null;
        }

        $cards = &$state['decks'][$deck];
        if ($cards === []) {
            $discard = &$state['discard'][$deck];
            if (is_array($discard) && $discard !== []) {
                $randomizer->shuffle($discard);
                $cards = $discard;
                $discard = [];
            } else {
                return null;
            }
        }

        $card = array_shift($cards);
        if (!is_array($card)) {
            return null;
        }

        $state['discard'][$deck][] = $card;

        return $card;
    }
}
