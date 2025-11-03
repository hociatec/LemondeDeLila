<?php

namespace App\Module\Game\Controller;

use App\Module\Game\Shared\Catalog;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/catalog')]
class CatalogController extends AbstractController
{
    public function __construct(private EntityManagerInterface $em) {}

    private function data(): array
    {
        // Lecture depuis la base si disponible
        $catRepo = $this->em->getRepository(\App\Module\Game\Entity\CatalogCategory::class);
        $gameRepo = $this->em->getRepository(\App\Module\Game\Entity\CatalogGame::class);
        $cats = $catRepo->findBy([], ['id' => 'ASC']);
        if ($cats) {
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
        // Fallback au catalogue codé
        return Catalog::categories();
    }

    #[Route('', name: 'catalog_all', methods: ['GET'])]
    public function all(): Response
    {
        return $this->json(['categories' => $this->data()]);
    }

    #[Route('/categories', name: 'catalog_categories', methods: ['GET'])]
    public function categories(): Response
    {
        $cats = array_map(fn($c) => ['id' => $c['id'], 'name' => $c['name']], $this->data());
        return $this->json($cats);
    }

    #[Route('/categories/{id}/games', name: 'catalog_category_games', methods: ['GET'])]
    public function categoryGames(string $id): Response
    {
        foreach ($this->data() as $cat) {
            if ($cat['id'] === $id) {
                return $this->json($cat['games']);
            }
        }
        return $this->json(['error' => 'Not found'], 404);
    }
}

