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

        $target = $this->normaliseId($gameId);
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($gamePath, \FilesystemIterator::SKIP_DOTS)
        );

        /** @var \SplFileInfo $file */
        foreach ($iterator as $file) {
            if (!$file->isDir()) {
                continue;
            }
            if ($this->normaliseId($file->getFilename()) === $target) {
                $candidate = $file->getPathname() . '/rules.md';
                if (is_file($candidate)) {
                    $filePath = $candidate;
                    break;
                }
            }
        }

        if ($filePath !== '' && is_file($filePath)) {
            $rules = file_get_contents($filePath);
            return new Response($rules ?: '', 200, ['Content-Type' => 'text/plain']);
        }

        return new Response('Rules not found.', 404);
    }

    private function normaliseId(string $value): string
    {
        $value = strtolower($value);
        $value = str_replace(['_', ' '], '-', $value);

        return preg_replace('/[^a-z0-9]+/', '', $value) ?? '';
    }
}
