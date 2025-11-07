<?php

namespace App\Module\Game\Controller;

use App\Module\Game\Service\GameCatalogProvider;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/catalog')]
class CatalogController extends AbstractController
{
    public function __construct(private readonly GameCatalogProvider $catalog)
    {
    }

    #[Route('', name: 'catalog_all', methods: ['GET'])]
    public function all(): Response
    {
        $catalog = $this->catalog->getCatalog();

        return $this->json([
            'categories' => $this->buildTree($catalog['categories']),
            'games' => $catalog['games'],
        ]);
    }

    #[Route('/categories', name: 'catalog_categories', methods: ['GET'])]
    public function categories(): Response
    {
        return $this->json($this->catalog->getCategories());
    }

    #[Route('/categories/{id}/games', name: 'catalog_category_games', methods: ['GET'])]
    public function categoryGames(string $id): Response
    {
        $games = $this->catalog->getGamesForCategory($id);
        if (empty($games)) {
            return $this->json(['error' => 'Not found'], 404);
        }

        return $this->json($games);
    }

    #[Route('/games', name: 'catalog_games', methods: ['GET'])]
    public function games(): Response
    {
        return $this->json($this->catalog->getGames());
    }

    /**
     * @param array<int, array{id:string,name:string,parentId:?string}> $categories
     * @return array<int, array{id:string,name:string,children:array<int, mixed>}>
     */
    private function buildTree(array $categories): array
    {
        $indexed = [];
        foreach ($categories as $category) {
            $category['children'] = [];
            $indexed[$category['id']] = $category;
        }

        $tree = [];
        foreach ($indexed as $id => $category) {
            $parentId = $category['parentId'];
            if ($parentId && isset($indexed[$parentId])) {
                $indexed[$parentId]['children'][] = &$indexed[$id];
            } else {
                $tree[] = &$indexed[$id];
            }
        }

        $clean = static function (array $nodes) use (&$clean): array {
            return array_map(static function ($node) use ($clean) {
                return [
                    'id' => $node['id'],
                    'name' => $node['name'],
                    'children' => $clean($node['children']),
                ];
            }, $nodes);
        };

        return $clean($tree);
    }
}

