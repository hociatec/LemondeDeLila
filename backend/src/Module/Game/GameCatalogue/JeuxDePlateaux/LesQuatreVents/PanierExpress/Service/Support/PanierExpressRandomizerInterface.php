<?php

namespace App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Service\Support;

interface PanierExpressRandomizerInterface
{
    public function randomInt(int $min, int $max): int;

    /**
     * @param array<int, mixed> $items
     */
    public function shuffle(array &$items): void;
}
