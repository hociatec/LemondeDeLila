<?php

namespace App\Module\Game\GameCatalogue\Actions\VentsInfinis\MissionNemesis\Service\Support;

final class MissionNemesisFleetFactory
{
    /**
     * @param array<string,int> $shipsConfiguration
     */
    public function __construct(
        private readonly int $boardSize,
        private readonly array $shipsConfiguration
    ) {
    }

    public function validate(array $ships): bool
    {
        if (count($ships) !== count($this->shipsConfiguration)) {
            return false;
        }

        $usedNames = [];
        $usedCoords = [];

        foreach ($ships as $ship) {
            if (
                !isset($ship['name'], $ship['coords'])
                || !isset($this->shipsConfiguration[$ship['name']])
                || !is_array($ship['coords'])
            ) {
                return false;
            }

            if (isset($usedNames[$ship['name']])) {
                return false;
            }
            $usedNames[$ship['name']] = true;

            $coords = $this->normalize($ship['coords']);
            if (count($coords) !== $this->shipsConfiguration[$ship['name']]) {
                return false;
            }

            if (!$this->isAligned($coords) || !$this->isConsecutive($coords)) {
                return false;
            }

            foreach ($coords as $coord) {
                if (!$this->isWithinBoard($coord)) {
                    return false;
                }
                $key = $coord['x'] . '-' . $coord['y'];
                if (isset($usedCoords[$key])) {
                    return false;
                }
                $usedCoords[$key] = true;
            }
        }

        return true;
    }

    /**
     * @return array<int,array{name:string,coords:array<int,array{x:int,y:int}>,hits:array<int,bool>}>
     */
    public function prepare(array $ships): array
    {
        $prepared = [];
        foreach ($ships as $ship) {
            $coords = $this->normalize($ship['coords'] ?? []);
            $prepared[] = [
                'name' => (string) ($ship['name'] ?? ''),
                'coords' => $coords,
                'hits' => array_fill(0, count($coords), false),
            ];
        }

        return $prepared;
    }

    /**
     * @return array<int,array{name:string,coords:array<int,array{x:int,y:int}>}>
     */
    public function randomFleet(): array
    {
        $occupied = [];
        $fleet = [];
        foreach ($this->shipsConfiguration as $name => $size) {
            $fleet[] = [
                'name' => $name,
                'coords' => $this->randomCoordinates($size, $occupied),
            ];
        }
        return $fleet;
    }

    /**
     * @param array<int,array{x:int,y:int}> $coords
     * @return array<int,array{x:int,y:int}>
     */
    private function normalize(array $coords): array
    {
        $normalized = [];
        foreach ($coords as $coord) {
            if (!is_array($coord) || !isset($coord['x'], $coord['y'])) {
                return [];
            }
            $normalized[] = [
                'x' => (int) $coord['x'],
                'y' => (int) $coord['y'],
            ];
        }

        usort(
            $normalized,
            static fn(array $a, array $b): int => $a['x'] <=> $b['x'] ?: $a['y'] <=> $b['y']
        );

        return $normalized;
    }

    /**
     * @param array<int,array{x:int,y:int}> $coords
     */
    private function isAligned(array $coords): bool
    {
        if (count($coords) < 2) {
            return true;
        }

        $horizontal = true;
        $vertical = true;
        $firstX = $coords[0]['x'];
        $firstY = $coords[0]['y'];

        foreach ($coords as $coord) {
            if ($coord['y'] !== $firstY) {
                $horizontal = false;
            }
            if ($coord['x'] !== $firstX) {
                $vertical = false;
            }
        }

        return $horizontal || $vertical;
    }

    /**
     * @param array<int,array{x:int,y:int}> $coords
     */
    private function isConsecutive(array $coords): bool
    {
        if (count($coords) < 2) {
            return true;
        }

        $horizontal = $this->isHorizontal($coords);
        $vertical = $this->isVertical($coords);

        if (!$horizontal && !$vertical) {
            return false;
        }

        for ($i = 1, $count = count($coords); $i < $count; $i++) {
            if ($horizontal) {
                if (
                    $coords[$i]['x'] !== $coords[$i - 1]['x'] + 1
                    || $coords[$i]['y'] !== $coords[$i - 1]['y']
                ) {
                    return false;
                }
            } else {
                if (
                    $coords[$i]['y'] !== $coords[$i - 1]['y'] + 1
                    || $coords[$i]['x'] !== $coords[$i - 1]['x']
                ) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * @param array<int,array{x:int,y:int}> $coords
     */
    private function isHorizontal(array $coords): bool
    {
        if (count($coords) < 2) {
            return false;
        }
        $firstY = $coords[0]['y'];
        foreach ($coords as $coord) {
            if ($coord['y'] !== $firstY) {
                return false;
            }
        }
        return true;
    }

    /**
     * @param array<int,array{x:int,y:int}> $coords
     */
    private function isVertical(array $coords): bool
    {
        if (count($coords) < 2) {
            return false;
        }
        $firstX = $coords[0]['x'];
        foreach ($coords as $coord) {
            if ($coord['x'] !== $firstX) {
                return false;
            }
        }
        return true;
    }

    /**
     * @param array{x:int,y:int} $coord
     */
    private function isWithinBoard(array $coord): bool
    {
        return $coord['x'] >= 0
            && $coord['x'] < $this->boardSize
            && $coord['y'] >= 0
            && $coord['y'] < $this->boardSize;
    }

    /**
     * @param array<string,bool> $occupied
     * @return array<int,array{x:int,y:int}>
     */
    private function randomCoordinates(int $size, array &$occupied): array
    {
        for ($attempt = 0; $attempt < 200; $attempt++) {
            $horizontal = random_int(0, 1) === 1;
            $coords = [];
            $collision = false;

            if ($horizontal) {
                $startX = random_int(0, $this->boardSize - $size);
                $startY = random_int(0, $this->boardSize - 1);
                for ($i = 0; $i < $size; $i++) {
                    $x = $startX + $i;
                    $y = $startY;
                    $key = $x . '-' . $y;
                    if (isset($occupied[$key])) {
                        $collision = true;
                        break;
                    }
                    $coords[] = ['x' => $x, 'y' => $y];
                }
            } else {
                $startX = random_int(0, $this->boardSize - 1);
                $startY = random_int(0, $this->boardSize - $size);
                for ($i = 0; $i < $size; $i++) {
                    $x = $startX;
                    $y = $startY + $i;
                    $key = $x . '-' . $y;
                    if (isset($occupied[$key])) {
                        $collision = true;
                        break;
                    }
                    $coords[] = ['x' => $x, 'y' => $y];
                }
            }

            if ($collision) {
                continue;
            }

            foreach ($coords as $coord) {
                $occupied[$coord['x'] . '-' . $coord['y']] = true;
            }

            return $coords;
        }

        $coords = [];
        for ($i = 0; $i < $size; $i++) {
            $coords[] = ['x' => $i, 'y' => 0];
            $occupied[$i . '-0'] = true;
        }

        return $coords;
    }
}
