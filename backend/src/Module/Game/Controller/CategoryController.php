<?php

namespace App\Module\Game\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

class CategoryController extends AbstractController
{
    #[Route('/api/game_categories', name: 'game_categories', methods: ['GET'])]
    public function getCategories(): JsonResponse
    {
        $gameCataloguePath = $this->getParameter('kernel.project_dir') . '/src/Module/Game/GameCatalogue';
        $categories = $this->scanDirectory($gameCataloguePath);
        return new JsonResponse($categories);
    }

    private function scanDirectory(string $path): array
    {
        $entries = [];
        $iterator = new \DirectoryIterator($path);
        foreach ($iterator as $item) {
            if ($item->isDir() && !$item->isDot()) {
                $dirName = $item->getFilename();
                // Ignore technical directories
                if (in_array($dirName, ['Controller', 'Service', 'Actions'])) {
                    continue;
                }
                $subEntries = $this->scanDirectory($item->getPathname());
                if (!empty($subEntries)) {
                    $entries[] = ['name' => $dirName, 'children' => $subEntries];
                } else {
                    $entries[] = ['name' => $dirName];
                }
            }
        }
        return $entries;
    }
}
