<?php

namespace App\Module\Game\Bot;

final class BotAllocator
{
    /**
     * @param array<int,string> $excluded
     */
    public function pick(array $excluded = []): string
    {
        $available = array_values(array_diff(BotRegistry::all(), array_map('strval', $excluded)));
        if ($available === []) {
            throw new \RuntimeException('Tous les bots disponibles sont déjà utilisés.');
        }

        $index = random_int(0, count($available) - 1);
        return $available[$index];
    }
}
