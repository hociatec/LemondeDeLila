<?php

namespace App\Module\Game\Controller;

use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/catalog')]
class CatalogController extends AbstractController
{
    public function __construct(private EntityManagerInterface $em) {}

    private function scanDirectory(string $path, string $prefix = ''): array
    {
        $entries = [];
        $iterator = new \DirectoryIterator($path);
        foreach ($iterator as $item) {
            if ($item->isDir() && !$item->isDot()) {
                $dirName = $item->getFilename();
                $dirPath = $item->getPathname();

                if (file_exists($dirPath . '/rules.md')) {
                    continue;
                }

                $categoryId = $prefix ? $prefix . '/' . $dirName : $dirName;

                $subCategories = $this->scanDirectory($dirPath, $categoryId);
                $games = $this->findGamesInDir($dirPath);

                if (!empty($subCategories) || !empty($games)) {
                    $category = [
                        'id' => $categoryId,
                        'name' => $dirName,
                    ];
                    if (!empty($subCategories)) {
                        $category['children'] = $subCategories;
                    }
                    if (!empty($games)) {
                        $category['games'] = $games;
                    }
                    $entries[] = $category;
                }
            }
        }
        return $entries;
    }

    private function findGamesInDir(string $path): array
    {
        $games = [];
        $iterator = new \DirectoryIterator($path);
        foreach ($iterator as $item) {
            if ($item->isDir() && !$item->isDot()) {
                if (file_exists($item->getPathname() . '/rules.md')) {
                    $gameId = $item->getFilename();
                    $games[] = [
                        'id' => $gameId,
                        'name' => $gameId,
                        'minPlayers' => 1,
                        'maxPlayers' => 99,
                    ];
                }
            }
        }
        return $games;
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

        $gameCataloguePath = $this->getParameter('kernel.project_dir') . '/src/Module/Game/GameCatalogue';
        return $this->scanDirectory($gameCataloguePath);
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
