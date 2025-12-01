<?php

namespace App\Module\Game\Bot;

final class BotAllocator
{
    /**
     * @param array<int,string> $excluded
     */
    public function pick(array $excluded = []): string
    {
        $normalizedExcluded = array_map([$this, 'normalize'], array_map('strval', $excluded));
        $available = array_values(array_filter(
            BotRegistry::all(),
            fn(string $name) => !\in_array($this->normalize($name), $normalizedExcluded, true)
        ));
        if ($available === []) {
            throw new \RuntimeException('Tous les bots disponibles sont deja utilises.');
        }

        $index = random_int(0, count($available) - 1);
        return $available[$index];
    }

    private function normalize(string $value): string
    {
        return strtolower(trim($value));
    }
}
