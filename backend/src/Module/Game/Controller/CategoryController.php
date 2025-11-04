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
        $categories = [];

        $categoryDirs = new \DirectoryIterator($gameCataloguePath);
        foreach ($categoryDirs as $categoryDir) {
            if ($categoryDir->isDir() && !$categoryDir->isDot()) {
                $categoryName = $categoryDir->getFilename();
                $subCategories = [];

                $subCategoryDirs = new \DirectoryIterator($categoryDir->getPathname());
                foreach ($subCategoryDirs as $subCategoryDir) {
                    if ($subCategoryDir->isDir() && !$subCategoryDir->isDot()) {
                        $subCategoryName = $subCategoryDir->getFilename();
                        $games = [];

                        $gameDirs = new \DirectoryIterator($subCategoryDir->getPathname());
                        foreach ($gameDirs as $gameDir) {
                            if ($gameDir->isDir() && !$gameDir->isDot()) {
                                $games[] = ['name' => $gameDir->getFilename()];
                            }
                        }
                        $subCategories[] = ['name' => $subCategoryName, 'games' => $games];
                    }
                }
                $categories[] = ['name' => $categoryName, 'subCategories' => $subCategories];
            }
        }

        return new JsonResponse($categories);
    }
}
