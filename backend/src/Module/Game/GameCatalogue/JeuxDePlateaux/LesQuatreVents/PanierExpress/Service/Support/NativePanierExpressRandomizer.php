<?php

namespace App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Service\Support;

final class NativePanierExpressRandomizer implements PanierExpressRandomizerInterface
{
    public function randomInt(int $min, int $max): int
    {
        return random_int($min, $max);
    }

    public function shuffle(array &$items): void
    {
        if ($items === []) {
            return;
        }
        shuffle($items);
    }
}
