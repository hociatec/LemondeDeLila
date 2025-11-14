<?php

namespace App\Module\Game\GameCatalogue\Actions\VentsInfinis\MissionNemesis\Service\Support;

final class MissionNemesisShotResolver
{
    public function hasShotAt(array $shots, array $coord, int $targetId): bool
    {
        foreach ($shots as $shot) {
            if (
                ($shot['targetId'] ?? null) === $targetId
                && (int) ($shot['x'] ?? -1) === $coord['x']
                && (int) ($shot['y'] ?? -1) === $coord['y']
            ) {
                return true;
            }
        }
        return false;
    }

    public function registerShot(array &$ships, array $coord): string
    {
        foreach ($ships as &$ship) {
            foreach ($ship['coords'] ?? [] as $index => $shipCoord) {
                if (($shipCoord['x'] ?? null) === $coord['x'] && ($shipCoord['y'] ?? null) === $coord['y']) {
                    if (!isset($ship['hits'][$index])) {
                        $ship['hits'][$index] = false;
                    }
                    if ($ship['hits'][$index]) {
                        return 'hit';
                    }
                    $ship['hits'][$index] = true;
                    return $this->shipSunk($ship) ? 'sunk' : 'hit';
                }
            }
        }

        return 'miss';
    }

    public function playerHasNoShipsRemaining(array $player): bool
    {
        return $this->countRemainingSegments($player) === 0;
    }

    public function countRemainingSegments(array $player): int
    {
        $remaining = 0;
        foreach ($player['ships'] ?? [] as $ship) {
            foreach ($ship['hits'] ?? [] as $hit) {
                if ($hit === false) {
                    $remaining++;
                }
            }
        }

        return $remaining;
    }

    private function shipSunk(array $ship): bool
    {
        foreach ($ship['hits'] ?? [] as $hit) {
            if ($hit === false) {
                return false;
            }
        }
        return true;
    }
}
