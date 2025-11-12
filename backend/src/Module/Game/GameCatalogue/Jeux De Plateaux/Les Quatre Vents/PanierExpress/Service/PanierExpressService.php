<?php

namespace App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Service;

final class PanierExpressService
{
    private const DATA_DIR = __DIR__ . '/../Data';

    private ?array $cachedReference = null;

    public function referenceData(): array
    {
        if ($this->cachedReference === null) {
            $this->cachedReference = [
                'board' => $this->loadJson('board.json'),
                'courses' => $this->loadJson('courses.json'),
                'shoppingLists' => $this->loadJson('shopping_lists.json'),
                'quizCards' => $this->loadJson('quiz.json'),
                'exchangeCards' => $this->loadJson('exchange_cards.json'),
                'eventCards' => $this->loadJson('event_cards.json'),
                'tokens' => $this->loadJson('tokens.json'),
            ];
        }

        return $this->cachedReference;
    }

    /**
     * @return array<string, mixed>|array<int, mixed>
     */
    private function loadJson(string $filename): array
    {
        $path = self::DATA_DIR . '/' . $filename;
        if (!is_file($path)) {
            return [];
        }

        $content = file_get_contents($path);
        if ($content === false) {
            return [];
        }

        try {
            $decoded = json_decode($content, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return [];
        }

        return is_array($decoded) ? $decoded : [];
    }
}
