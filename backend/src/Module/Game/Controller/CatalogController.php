<?php

namespace App\Module\Game\Controller;

use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/catalog')]
class CatalogController extends AbstractController
{
    private array $gameIds = [];

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly LoggerInterface $logger
    ) {}

    private function scanFileSystem(string $path, string $prefix = ''): array
    {
        $entries = [];
        try {
            $iterator = new \DirectoryIterator($path);
            foreach ($iterator as $item) {
                if ($item->isDir() && !$item->isDot()) {
                    $dirName = $item->getFilename();
                    $dirPath = $item->getPathname();
                    $itemId = $prefix ? $prefix . '/' . $dirName : $dirName;

                    if (file_exists($dirPath . '/rules.md')) {
                        if (in_array($itemId, $this->gameIds)) {
                            $this->logger->warning('Jeu dupliqué trouvé et ignoré', ['id' => $itemId]);
                            continue;
                        }
                        $this->gameIds[] = $itemId;
                        $entries[] = [
                            'type' => 'game',
                            'id' => $itemId,
                            'name' => $dirName,
                            'minPlayers' => 1,
                            'maxPlayers' => 99,
                        ];
                    } else {
                        $children = $this->scanFileSystem($dirPath, $itemId);
                        if (!empty($children)) {
                            $category = [
                                'type' => 'category',
                                'id' => $itemId,
                                'name' => $dirName,
                                'games' => [],
                                'children' => [],
                            ];
                            foreach ($children as $child) {
                                if ($child['type'] === 'game') {
                                    $category['games'][] = $child;
                                } else {
                                    $category['children'][] = $child;
                                }
                            }
                            if (!empty($category['games']) || !empty($category['children'])) {
                                $entries[] = $category;
                            }
                        }
                    }
                }
            }
        } catch (\Throwable $e) {
            $this->logger->error('Erreur lors du scan du catalogue de jeux', ['path' => $path, 'exception' => $e]);
            return [];
        }
        return $entries;
    }

    private function data(): array
    {
        $catRepo = $this->em->getRepository(\App\Module\Game\Entity\CatalogCategory::class);
        $cats = $catRepo->findBy([], ['id' => 'ASC']);
        if ($cats) {
            $gameRepo = $this->em->getRepository(\App\Module\Game\Entity\CatalogGame::class);
            $out = [];
            foreach ($cats as $cat) {
                $games = $gameRepo->findBy(['category' => $cat, 'enabled' => true], ['id' => 'ASC']);
                $out[] = [
                    'id' => $cat->getCode(),
                    'name' => $cat->getName(),
                    'games' => array_map(function ($g) {
                        return [
                            'id' => $g->getCode(),
                            'name' => $g->getName(),
                            'minPlayers' => $g->getMinPlayers(),
                            'maxPlayers' => $g->getMaxPlayers(),
                        ];
                    }, $games),
                ];
            }
            return $out;
        }

        $this->gameIds = [];
        $gameCataloguePath = $this->getParameter('kernel.project_dir') . '/src/Module/Game/GameCatalogue';
        $scanResult = $this->scanFileSystem($gameCataloguePath);

        $categories = [];
        foreach ($scanResult as $item) {
            if ($item['type'] === 'category') {
                unset($item['type']);
                $categories[] = $item;
            }
        }
        return $categories;
    }

    #[Route('', name: 'catalog_all', methods: ['GET'])]
    public function all(): Response
    {
        return $this->json(['categories' => $this->data()]);
    }

    private function extractCategories(array $categoriesTree): array
    {
        $cats = [];
        foreach ($categoriesTree as $category) {
            $cats[] = ['id' => $category['id'], 'name' => $category['name']];
            if (!empty($category['children'])) {
                $cats = array_merge($cats, $this->extractCategories($category['children']));
            }
        }
        return $cats;
    }

    #[Route('/categories', name: 'catalog_categories', methods: ['GET'])]
    public function categories(): Response
    {
        $categories = $this->data();
        $cats = $this->extractCategories($categories);
        return $this->json($cats);
    }

    private function findCategoryById(array $categoriesTree, string $id): ?array
    {
        foreach ($categoriesTree as $category) {
            if ($category['id'] === $id) {
                return $category;
            }
            if (!empty($category['children'])) {
                $found = $this->findCategoryById($category['children'], $id);
                if ($found) {
                    return $found;
                }
            }
        }
        return null;
    }

    #[Route('/categories/{id}/games', name: 'catalog_category_games', methods: ['GET'])]
    public function categoryGames(string $id): Response
    {
        $category = $this->findCategoryById($this->data(), $id);
        if ($category) {
            return $this->json($category['games'] ?? []);
        }
        return $this->json(['error' => 'Not found'], 404);
    }
}
