<?php

namespace App\Module\Game\GameCatalogue\Actions\VentsInfinis\MissionNemesis\Service\Support;

final class MissionNemesisBotEngine
{
    public function __construct(
        private readonly MissionNemesisFleetFactory $fleetFactory,
        private readonly int $boardSize
    ) {
    }

    /**
     * @return array<int,array{name:string,coords:array<int,array{x:int,y:int}>}>
     */
    public function buildFleet(): array
    {
        return $this->fleetFactory->randomFleet();
    }

    public function selectShot(array $players, int $botIndex): ?array
    {
        $targetIndex = $this->nextAliveOpponentIndex($players, $botIndex);
        if ($targetIndex === null) {
            return null;
        }

        $targetId = $players[$targetIndex]['id'] ?? null;
        $shots = $players[$botIndex]['shots'] ?? [];
        $used = [];
        foreach ($shots as $shot) {
            if (($shot['targetId'] ?? null) === $targetId) {
                $used[$shot['x'] . '-' . $shot['y']] = true;
            }
        }

        $available = [];
        for ($x = 0; $x < $this->boardSize; $x++) {
            for ($y = 0; $y < $this->boardSize; $y++) {
                $key = $x . '-' . $y;
                if (!isset($used[$key])) {
                    $available[] = ['x' => $x, 'y' => $y];
                }
            }
        }

        if ($available === []) {
            return null;
        }

        return $available[random_int(0, count($available) - 1)];
    }

        private function nextAliveOpponentIndex(array $players, int $current): ?int
    {
        $count = count($players);
        for ($offset = 1; $offset < $count; $offset++) {
            $candidate = ($current + $offset) % $count;
            if (($players[$candidate]['status'] ?? 'placing') === 'alive') {
                return $candidate;
            }
        }

        return null;
    }
}
