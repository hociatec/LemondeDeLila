<?php

namespace App\Tests\Module\Game\Service;

use App\Module\Game\Repository\CatalogGameRepository;
use App\Module\Game\Service\GameCatalogProvider;
use PHPUnit\Framework\TestCase;

final class GameCatalogProviderTest extends TestCase
{
    public function testNormalizesCamelCaseSegments(): void
    {
        $provider = $this->makeProvider();

        $normalizer = new \ReflectionMethod($provider, 'normalizeCategoryPath');
        $normalizer->setAccessible(true);

        self::assertSame(
            'jeux-de-cartes/vents-dansants',
            $normalizer->invoke($provider, 'JeuxDeCartes/VentsDansants')
        );

        self::assertSame(
            'jeux-de-cartes/vents-dansants',
            $normalizer->invoke($provider, 'jeux-de-cartes/vents-dansants')
        );
    }

    public function testDecodeManifestIgnoresUtf8Bom(): void
    {
        $provider = $this->makeProvider();
        $decode = new \ReflectionMethod($provider, 'decodeManifest');
        $decode->setAccessible(true);

        $payload = [
            'code' => 'sample',
            'name' => 'Sample',
            'minPlayers' => 1,
            'maxPlayers' => 4,
            'engine' => 'sample-engine',
        ];
        $fixture = tempnam(sys_get_temp_dir(), 'manifest_');
        self::assertIsString($fixture);
        file_put_contents($fixture, "\xEF\xBB\xBF" . json_encode($payload));

        try {
            $result = $decode->invoke($provider, $fixture);
        } finally {
            @unlink($fixture);
        }

        self::assertIsArray($result);
        self::assertSame('sample', $result['code']);
    }

    private function makeProvider(): GameCatalogProvider
    {
        return new GameCatalogProvider(
            $this->createMock(CatalogGameRepository::class),
            \dirname(__DIR__, 4)
        );
    }
}
