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
        $normalizedId = $this->normalizeCategoryPath($categoryId);

        return array_values(array_filter(
            $games,
            function (array $game) use ($categoryId, $normalizedId): bool {
                $categories = $game['categories'] ?? [];
                if (!is_array($categories) || $categories === []) {
                    return false;
                }
                foreach ($categories as $candidate) {
                    if (!is_string($candidate)) {
                        continue;
                    }
                    if ($candidate === $categoryId) {
                        return true;
                    }
                    if ($normalizedId !== null) {
                        $candidateNormalized = $this->normalizeCategoryPath($candidate);
                        if ($candidateNormalized !== null && $candidateNormalized === $normalizedId) {
                            return true;
                        }
                    }
                }
                return false;
            }
        ));
    }

    private function hydrate(): void
    {
        $categories = [];
        $games = [];

        foreach ($this->fetchDatabaseGames() as $game) {
            $games[$game['code']] = $game;
        }

        $filesystem = $this->scanFilesystem();
        foreach ($filesystem['games'] as $game) {
            $code = $game['code'];
            $categoryDefinitions = $game['categoryDefinitions'] ?? [];
            unset($game['categoryDefinitions']);

            $games[$code] = isset($games[$code])
                ? array_merge($games[$code], $game, ['source' => 'merged'])
                : $game;
            $categories = array_merge($categories, $categoryDefinitions);
        }
        $categories = array_merge($categories, $filesystem['categories']);

        $categories = $this->mergeCategories($categories);
        $games = $this->normalizeGames($games);

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

    /** @return array{games: array<int, array<string, mixed>>, categories: array<int, array{id:string,name:string,parentId:?string}>} */
    private function scanFilesystem(): array
    {
        if (!is_dir($this->catalogPath)) {
            return ['games' => [], 'categories' => []];
        }

        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator(
                $this->catalogPath,
                \FilesystemIterator::SKIP_DOTS | \FilesystemIterator::FOLLOW_SYMLINKS
            ),
            \RecursiveIteratorIterator::SELF_FIRST
        );

        $games = [];
        $categoryCollection = [];
        foreach ($iterator as $item) {
            if (!$item instanceof \SplFileInfo) {
                continue;
            }

            if ($item->isDir()) {
                $dirPath = $item->getPathname();
                $relativeDir = ltrim(str_replace($this->catalogPath, '', $dirPath), DIRECTORY_SEPARATOR);
                if ($relativeDir === '') {
                    continue;
                }
                $parentPath = dirname($dirPath);
                if (strpos($parentPath, $this->catalogPath) === 0
                    && is_file($parentPath . DIRECTORY_SEPARATOR . 'manifest.json')) {
                    continue;
                }

                $segments = array_values(array_filter(explode(DIRECTORY_SEPARATOR, $relativeDir)));
                if (empty($segments)) {
                    continue;
                }

                $hasManifest = is_file($dirPath . DIRECTORY_SEPARATOR . 'manifest.json');
                $definitions = $this->registerCategories($segments, !$hasManifest);
                $categoryCollection = array_merge($categoryCollection, $definitions);
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

            $definitions = $this->registerCategories($segments);
            $categoryIds = array_column($definitions, 'id');

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
                'categoryDefinitions' => $definitions,
            ];

            $categoryCollection = array_merge($categoryCollection, $definitions);
        }

        return [
            'games' => $games,
            'categories' => $categoryCollection,
        ];
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

        // Remove a potential UTF-8 BOM to avoid json_decode failures.
        if (str_starts_with($content, "\xEF\xBB\xBF")) {
            $content = substr($content, 3);
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
     * @param bool $includeLeaf When true, the last segment is also registered as a category.
     * @return array<int, array{id:string,name:string,parentId:?string}>
     */
    private function registerCategories(array $segments, bool $includeLeaf = false): array
    {
        if (empty($segments)) {
            return [];
        }

        $limit = \count($segments) - ($includeLeaf ? 0 : 1);
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

    /**
     * @param array<int, array{id:string,name:string,parentId:?string}> $categories
     * @return array<string, array{id:string,name:string,parentId:?string}>
     */
    private function mergeCategories(array $categories): array
    {
        $normalized = [];
        foreach ($categories as $category) {
            if (!isset($category['id'])) {
                continue;
            }

            $canonicalId = $this->normalizeCategoryPath((string)$category['id']) ?? (string)$category['id'];
            $category['id'] = $canonicalId;

            if (isset($category['parentId']) && $category['parentId'] !== null) {
                $parentCanonical = $this->normalizeCategoryPath((string)$category['parentId']) ?? (string)$category['parentId'];
                $category['parentId'] = $parentCanonical === $canonicalId ? null : $parentCanonical;
            } else {
                $category['parentId'] = null;
            }

            if (!isset($category['name']) || !is_string($category['name']) || trim($category['name']) === '') {
                $category['name'] = $this->humanizeCategoryId($canonicalId);
            } else {
                $category['name'] = $this->beautifyCategoryName($category['name']);
            }

            if (!isset($normalized[$canonicalId])) {
                $normalized[$canonicalId] = $category;
                continue;
            }

            $normalized[$canonicalId] = $this->combineCategoryMetadata($normalized[$canonicalId], $category);
        }

        // Ensure all ancestors exist so that navigation trees remain consistent.
        foreach (array_keys($normalized) as $categoryId) {
            $segments = explode('/', $categoryId);
            if (\count($segments) <= 1) {
                continue;
            }
            array_pop($segments); // skip current category
            $path = '';
            foreach ($segments as $segment) {
                $path = $path === '' ? $segment : $path . '/' . $segment;
                if (!isset($normalized[$path])) {
                    $parent = str_contains($path, '/') ? substr($path, 0, strrpos($path, '/')) : null;
                    $normalized[$path] = [
                        'id' => $path,
                        'name' => $this->humanizeCategoryId($path),
                        'parentId' => $parent ?: null,
                    ];
                }
            }
        }

        // Beautify names once more in case placeholders were created.
        foreach ($normalized as &$category) {
            $category['name'] = $this->beautifyCategoryName($category['name'] ?? '');
        }
        unset($category);

        ksort($normalized);

        return $normalized;
    }

    /**
     * @param array{id:string,name:string,parentId:?string} $current
     * @param array{id:string,name:string,parentId:?string} $candidate
     * @return array{id:string,name:string,parentId:?string}
     */
    private function combineCategoryMetadata(array $current, array $candidate): array
    {
        $current['name'] = $this->preferCategoryName($current['name'] ?? '', $candidate['name'] ?? '');
        if (($current['parentId'] ?? null) === null && ($candidate['parentId'] ?? null) !== null) {
            $current['parentId'] = $candidate['parentId'];
        }
        return $current;
    }

    private function preferCategoryName(string $current, string $candidate): string
    {
        $current = trim($current);
        $candidate = trim($candidate);

        if ($candidate === '') {
            return $current;
        }
        if ($current === '') {
            return $candidate;
        }

        return $this->categoryNameScore($candidate) > $this->categoryNameScore($current)
            ? $candidate
            : $current;
    }

    private function categoryNameScore(string $value): int
    {
        $score = strlen($value);
        if (str_contains($value, ' ')) {
            $score += 5;
        }
        if (str_contains($value, '-')) {
            $score += 2;
        }
        if (preg_match('/[A-Z]/', $value)) {
            $score += 1;
        }
        return $score;
    }

    private function humanizeCategoryId(string $id): string
    {
        $parts = explode('/', $id);
        $last = end($parts) ?: $id;
        $last = preg_replace('/[^a-z0-9]+/i', ' ', $last) ?? $last;
        $last = trim($last);
        if ($last === '') {
            return ucfirst($id);
        }
        return $this->beautifyCategoryName($last);
    }

    private function beautifyCategoryName(string $value): string
    {
        $value = trim($value);
        if ($value === '') {
            return 'Categorie';
        }
        $processed = $value;
        $processed = str_replace(['_', '-'], ' ', $processed);
        $processed = preg_replace('/(?<=\p{Ll})(\p{Lu})/u', ' $1', $processed) ?? $processed;
        $processed = preg_replace('/\s+/', ' ', $processed) ?? $processed;
        $lower = \function_exists('mb_strtolower') ? mb_strtolower($processed) : strtolower($processed);
        return ucwords($lower);
    }

    /**
     * @param array<string, array<string, mixed>> $games
     * @return array<string, array<string, mixed>>
     */
    private function normalizeGames(array $games): array
    {
        foreach ($games as $code => &$game) {
            $categories = [];
            if (isset($game['categories']) && is_array($game['categories'])) {
                foreach ($game['categories'] as $categoryId) {
                    if (!is_string($categoryId)) {
                        continue;
                    }
                    $normalizedId = $this->normalizeCategoryPath($categoryId);
                    if ($normalizedId === null) {
                        continue;
                    }
                    $segments = explode('/', $normalizedId);
                    $path = '';
                    foreach ($segments as $segment) {
                        $path = $path === '' ? $segment : $path . '/' . $segment;
                        $categories[$path] = true;
                    }
                }
            }
            $game['categories'] = array_keys($categories);
        }
        unset($game);
        return $games;
    }

    private function normalizeCategoryPath(string $path): ?string
    {
        $segments = array_values(array_filter(explode('/', $path), static fn ($part) => $part !== ''));
        if (empty($segments)) {
            return null;
        }

        $normalized = [];
        foreach ($segments as $segment) {
            $slug = $this->slugify($segment);
            if ($slug !== '') {
                $normalized[] = $slug;
            }
        }

        if (empty($normalized)) {
            return null;
        }

        return implode('/', $normalized);
    }

    private function slugify(string $value): string
    {
        $value = trim($value);
        if ($value === '') {
            return '';
        }

        // Preserve hierarchy by splitting CamelCase and acronym boundaries before normalization.
        $value = preg_replace(
            '/(?<!^)(?:(?<=\p{Ll}|\p{Nd})(?=\p{Lu})|(?<=\p{Lu})(?=\p{Lu}\p{Ll}))/u',
            '-',
            $value
        ) ?? $value;
        $value = str_replace(['_', ' '], '-', $value);
        $value = strtolower($value);
        $value = preg_replace('/[^a-z0-9]+/', '-', $value) ?? '';
        $value = trim($value, '-');

        return preg_replace('/-+/', '-', $value) ?? $value;
    }

    private function relativeCatalogPath(string $absolute): string
    {
        return ltrim(str_replace($this->catalogPath, '', $absolute), DIRECTORY_SEPARATOR);
    }
}
