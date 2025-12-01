<?php

namespace App\Module\Game\GameCatalogue\JeuxDeCartes\VentsDansants\DameNature\Service;

final class DameNatureReferenceService
{
    private const DATA_DIR = __DIR__ . '/../Data';

    private ?array $cache = null;

    public function referenceData(): array
    {
        if ($this->cache === null) {
            $this->cache = [
                'families' => $this->loadJson('families.json'),
                'dangerCards' => $this->loadJson('dangers.json'),
                'quizCards' => $this->loadJson('quiz.json'),
            ];
        }

        return $this->cache;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function families(): array
    {
        return $this->referenceData()['families'] ?? [];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function dangerCards(): array
    {
        return $this->referenceData()['dangerCards'] ?? [];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function quizCards(): array
    {
        return $this->referenceData()['quizCards'] ?? [];
    }

    /**
     * @return array<int|string, mixed>
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

        if (str_starts_with($content, "\xEF\xBB\xBF")) {
            $content = substr($content, 3);
        }

        try {
            $decoded = json_decode($content, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return [];
        }

        return is_array($decoded) ? $decoded : [];
    }
}
