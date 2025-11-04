<?php

namespace App\Module\Game\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Finder\Finder;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;

class GameController extends AbstractController
{
    #[Route('/api/game_categories', name: 'game_categories')]
    public function getGameCategories(): JsonResponse
    {
        $finder = new Finder();
        $finder->directories()->in($this->getParameter('kernel.project_dir') . '/src/Module/Game/GameCatalogue')->depth(0);

        $categories = [];
        foreach ($finder as $dir) {
            $categories[] = $dir->getBasename();
        }

        return new JsonResponse($categories);
    }
}
