<?php

namespace App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Service\Support;

final class PanierExpressTileResolver
{
    /**
     * @param array<string, mixed> $tile
     * @return array<int, array<string, mixed>>
     */
    public function resolveActions(array $tile): array
    {
        $actions = $tile['actions'] ?? null;
        if (is_array($actions) && $actions !== []) {
            return array_values(array_filter(array_map(
                fn($action) => $this->normalizeAction($action),
                $actions
            )));
        }

        return $this->fallbackByLabel((string)($tile['label'] ?? ''));
    }

    /**
     * @param array<string, mixed>|string $action
     * @return array<string, mixed>|null
     */
    private function normalizeAction($action): ?array
    {
        if (is_string($action)) {
            return ['type' => $action];
        }

        if (!is_array($action) || !isset($action['type'])) {
            return null;
        }

        $normalized = [
            'type' => (string) $action['type'],
        ];

        foreach ($action as $key => $value) {
            if ($key === 'type') {
                continue;
            }
            $normalized[$key] = $value;
        }

        return $normalized;
    }

    /**
     * Legacy fallback using the tile label to deduce an action.
     *
     * @return array<int, array<string, mixed>>
     */
    private function fallbackByLabel(string $label): array
    {
        $normalized = $this->normalizeText($label);

        if ($normalized === '') {
            return [];
        }

        if (str_contains($normalized, 'pioche carte evenement')) {
            return [['type' => PanierExpressTileAction::DRAW_EVENT]];
        }
        if (str_contains($normalized, 'pioche carte echange')) {
            return [['type' => PanierExpressTileAction::DRAW_EXCHANGE]];
        }
        if (str_contains($normalized, 'mini quiz')) {
            return [['type' => PanierExpressTileAction::START_QUIZ]];
        }
        if (str_contains($normalized, 'pioche carte courses supplementaire')) {
            return [['type' => PanierExpressTileAction::BONUS_COURSE]];
        }
        if (str_contains($normalized, 'perd ton prochain tour')
            || str_contains($normalized, 'reste un tour sur place')) {
            return [['type' => PanierExpressTileAction::SKIP_TURN, 'count' => 1]];
        }
        if (str_contains($normalized, 'recule de 2')) {
            return [['type' => PanierExpressTileAction::MOVE, 'delta' => -2]];
        }
        if (str_contains($normalized, 'retour en arriere de 3')) {
            return [['type' => PanierExpressTileAction::MOVE, 'delta' => -3]];
        }
        if (str_contains($normalized, 'avance d une case')) {
            return [['type' => PanierExpressTileAction::MOVE, 'delta' => 1]];
        }
        if (str_contains($normalized, 'avance de 2 cases')) {
            return [['type' => PanierExpressTileAction::MOVE, 'delta' => 2]];
        }
        if (str_contains($normalized, 'avance jusqu a un stand de ton choix')) {
            return [['type' => PanierExpressTileAction::ADVANCE_TO_NEXT_STAND]];
        }
        if (str_contains($normalized, 'arrivee')) {
            return [['type' => PanierExpressTileAction::ARRIVAL]];
        }

        return [];
    }

    private function normalizeText(string $value): string
    {
        $value = mb_strtolower($value);
        if (\function_exists('transliterator_transliterate')) {
            $value = transliterator_transliterate('Any-Latin; Latin-ASCII', $value) ?: $value;
        }

        return preg_replace('/[^a-z0-9 ]+/', ' ', $value) ?? $value;
    }
}
