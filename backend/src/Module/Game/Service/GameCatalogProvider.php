<?php

namespace App\Module\Game\Service;

use App\Module\Game\Entity\CatalogGame;
use App\Module\Game\Repository\CatalogGameRepository;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

class GameCatalogProvider
{
    private string $catalogPath;

    /** @var array<string, array{id:string,name:string,parentId:?string}>|null */
    private ?array $categories = null;

    /** @var array<string, array<string, mixed>>|null */
    private ?array $games = null;

    public function __construct(
        private readonly CatalogGameRepository $repository,
        #[Autowire(param: 'kernel.project_dir')] string $projectDir
    ) {
        $this->catalogPath = $projectDir . '/src/Module/Game/GameCatalogue';
    }

    /**
     * @return array{games: array<int, array<string, mixed>>, categories: array<int, array<string, mixed>>}
     */
    public function getCatalog(): array
    {
        if ($this->games === null || $this->categories === null) {
            $this->hydrate();
        }

        return [
            'games' => array_values($this->games ?? []),
            'categories' => array_values($this->categories ?? []),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function getGames(): array
    {
        return $this->getCatalog()['games'];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function getCategories(): array
    {
        return $this->getCatalog()['categories'];
    }

    /**
     * @param string $categoryId
     * @return array<int, array<string, mixed>>
     */
    public function getGamesForCategory(string $categoryId): array
    {
        $games = $this->getGames();
        return array_values(array_filter(
            $games,
            static fn (array $game) => in_array($categoryId, $game['categories'], true)
        ));
    }

    private function hydrate(): void
    {
        $categories = [];
        $games = [];

        foreach ($this->fetchDatabaseGames() as $game) {
            $games[$game['code']] = $game;
        }

        foreach ($this->scanFilesystem() as $game) {
            $code = $game['code'];
            $categoryDefinitions = $game['categoryDefinitions'] ?? [];
            unset($game['categoryDefinitions']);

            $games[$code] = isset($games[$code])
                ? array_merge($games[$code], $game, ['source' => 'merged'])
                : $game;
            $categories = array_merge($categories, $categoryDefinitions);
        }

        // ensure categories array keyed unique
        $categories = array_reduce(
            $categories,
            static function (array $carry, array $category) {
                $carry[$category['id']] = $category;
                return $carry;
            },
            []
        );

        $this->categories = $categories;
        $this->games = $games;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchDatabaseGames(): array
    {
        $repoResults = $this->repository->createQueryBuilder('g')
            ->andWhere('g.enabled = :enabled')
            ->setParameter('enabled', true)
            ->orderBy('g.name', 'ASC')
            ->getQuery()
            ->getResult();

        $games = [];
        foreach ($repoResults as $entity) {
            if (!$entity instanceof CatalogGame) {
                continue;
            }
            $games[] = [
                'code' => $entity->getCode(),
                'name' => $entity->getName(),
                'minPlayers' => $entity->getMinPlayers(),
                'maxPlayers' => $entity->getMaxPlayers(),
                'engine' => $entity->getEngine(),
                'summary' => null,
                'categories' => [],
                'source' => 'database',
                'hasRules' => false,
                'rulesPath' => null,
            ];
        }

        return $games;
    }

    /**
     * @return iterable<int, array<string, mixed>>
     */
    private function scanFilesystem(): iterable
    {
        if (!is_dir($this->catalogPath)) {
            return [];
        }

        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator(
                $this->catalogPath,
                \FilesystemIterator::SKIP_DOTS | \FilesystemIterator::FOLLOW_SYMLINKS
            ),
            \RecursiveIteratorIterator::SELF_FIRST
        );

        $games = [];
        foreach ($iterator as $item) {
            if (!$item instanceof \SplFileInfo || !$item->isFile()) {
                continue;
            }
            if ($item->getFilename() !== 'manifest.json') {
                continue;
            }
            $dir = $item->getPath();
            $relativeDir = ltrim(str_replace($this->catalogPath, '', $dir), DIRECTORY_SEPARATOR);
            $segments = array_values(array_filter(explode(DIRECTORY_SEPARATOR, $relativeDir)));
            if (empty($segments)) {
                continue;
            }

            $payload = $this->decodeManifest($item->getPathname());
            if ($payload === null) {
                continue;
            }

            $categoryDefinitions = $this->registerCategories($segments);
            $categoryIds = array_column($categoryDefinitions, 'id');

            $rulesPath = $dir . DIRECTORY_SEPARATOR . 'rules.md';
            $hasRules = is_file($rulesPath);

            $games[] = [
                'code' => $payload['code'],
                'name' => $payload['name'],
                'minPlayers' => $payload['minPlayers'],
                'maxPlayers' => $payload['maxPlayers'],
                'engine' => $payload['engine'],
                'summary' => $payload['summary'] ?? null,
                'categories' => $categoryIds,
                'source' => 'filesystem',
                'hasRules' => $hasRules,
                'rulesPath' => $hasRules ? $this->relativeCatalogPath($rulesPath) : null,
                'categoryDefinitions' => $categoryDefinitions,
            ];
        }

        return $games;
    }

    /**
     * @param string $manifestPath
     * @return array<string, mixed>|null
     */
    private function decodeManifest(string $manifestPath): ?array
    {
        $content = @file_get_contents($manifestPath);
        if ($content === false) {
            return null;
        }
        try {
            $data = json_decode($content, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return null;
        }

        $required = ['code', 'name', 'minPlayers', 'maxPlayers', 'engine'];
        foreach ($required as $key) {
            if (!array_key_exists($key, $data)) {
                return null;
            }
        }

        return [
            'code' => (string)$data['code'],
            'name' => (string)$data['name'],
            'minPlayers' => (int)$data['minPlayers'],
            'maxPlayers' => (int)$data['maxPlayers'],
            'engine' => $data['engine'] ? (string)$data['engine'] : null,
            'summary' => isset($data['summary']) ? (string)$data['summary'] : null,
        ];
    }

    /**
     * @param array<int, string> $segments
     * @return array<int, array{id:string,name:string,parentId:?string}>
     */
    private function registerCategories(array $segments): array
    {
        if (empty($segments)) {
            return [];
        }

        $limit = \count($segments) - 1;
        if ($limit <= 0) {
            return [];
        }

        $definitions = [];
        $currentPath = '';
        $parentId = null;
        for ($i = 0; $i < $limit; $i++) {
            $segment = $segments[$i];
            $slug = $this->slugify($segment);
            $currentPath = $currentPath ? $currentPath . '/' . $slug : $slug;
            $definitions[] = [
                'id' => $currentPath,
                'name' => $segment,
                'parentId' => $parentId,
            ];
            $parentId = $currentPath;
        }
        return $definitions;
    }

    private function slugify(string $value): string
    {
        $value = strtolower($value);
        $value = preg_replace('/[^a-z0-9]+/', '-', $value) ?? '';
        return trim($value, '-');
    }

    private function relativeCatalogPath(string $absolute): string
    {
        return ltrim(str_replace($this->catalogPath, '', $absolute), DIRECTORY_SEPARATOR);
    }
}
