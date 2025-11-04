<?php

namespace App\Module\Game\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class GameController extends AbstractController
{
    #[Route('/api/games/{gameId}/rules', name: 'game_rules', methods: ['GET'])]
    public function rules(string $gameId): Response
    {
        $gamePath = $this->getParameter('kernel.project_dir') . '/src/Module/Game/GameCatalogue';
        $filePath = '';

        $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($gamePath));
        foreach ($it as $file) {
            if (strtolower($file->getFilename()) === strtolower($gameId)) {
                $filePath = $file->getPathname() . '/rules.md';
                break;
            }
        }

        if (file_exists($filePath)) {
            $rules = file_get_contents($filePath);
            return new Response($rules, 200, ['Content-Type' => 'text/plain']);
        }

        return new Response('Rules not found.', 404);
    }
}
