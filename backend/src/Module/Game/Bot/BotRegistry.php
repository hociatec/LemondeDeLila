<?php

namespace App\Module\Game\Bot;

final class BotRegistry
{
    /** @var string[] */
    private const BOT_NAMES = [
        'BibiBarrique',
        'GrogMatic',
        'Tavernicus',
        'Bidouillard',
        'MousseMécanique',
        'BourraBot',
        'TonneauTron',
        'Farfouillex',
        'GagaGolem',
        'MarmiteRoulante',
        'CouscousKran',
        'GnôleGear',
        'Picolotron',
        'FûtFou',
        'Ivre-Tonique',
        'Barbotine',
        'ChopineX',
        'Gargouillix',
        'TroubadourBot',
        'Fiascobot',
        'Brasse-Bouze',
        'Caskouille',
        'Fripouille5000',
        'CervoMousse',
        'BazarBorg',
        'Poivrotix',
        'CraquelinBot',
        'Loqueteux',
        'Grelottin',
        'Soupe-à-Bot',
    ];

    /**
     * @return string[]
     */
    public static function all(): array
    {
        return self::BOT_NAMES;
    }
}
