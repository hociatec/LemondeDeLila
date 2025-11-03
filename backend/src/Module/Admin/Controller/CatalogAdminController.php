<?php

namespace App\Module\Admin\Controller;

use App\Module\Game\Entity\CatalogCategory;
use App\Module\Game\Entity\CatalogGame;
use App\Module\Game\Shared\Catalog as CodeCatalog;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/admin/catalog')]
class CatalogAdminController extends AbstractController
{
    #[Route('/sync-from-code', name: 'admin_catalog_sync', methods: ['POST'])]
    public function sync(EntityManagerInterface $em)
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');
        $catRepo = $em->getRepository(CatalogCategory::class);
        $gameRepo = $em->getRepository(CatalogGame::class);

        $data = CodeCatalog::categories();
        foreach ($data as $cat) {
            $c = $catRepo->findOneBy(['code' => $cat['id']]);
            if (!$c) {
                $c = (new CatalogCategory())->setCode($cat['id']);
                $em->persist($c);
            }
            $c->setName($cat['name']);
            foreach ($cat['games'] as $g) {
                $game = $gameRepo->findOneBy(['code' => $g['id']]);
                if (!$game) {
                    $game = (new CatalogGame())
                        ->setCode($g['id'])
                        ->setCategory($c);
                    $em->persist($game);
                }
                $game
                    ->setName($g['name'])
                    ->setMinPlayers((int)($g['minPlayers'] ?? 1))
                    ->setMaxPlayers((int)($g['maxPlayers'] ?? 4))
                    ->setEnabled(true);
            }
        }

        $em->flush();
        return $this->json(['status' => 'ok']);
    }

    #[Route('', name: 'admin_catalog_list', methods: ['GET'])]
    public function list(EntityManagerInterface $em)
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');
        $cats = $em->getRepository(CatalogCategory::class)->findBy([], ['id' => 'ASC']);
        $games = $em->getRepository(CatalogGame::class)->findAll();

        $byCat = [];
        foreach ($cats as $c) {
            $byCat[$c->getId()] = [
                'id' => $c->getCode(),
                'name' => $c->getName(),
                'games' => [],
            ];
        }

        foreach ($games as $g) {
            $cid = $g->getCategory()->getId();
            if (!isset($byCat[$cid])) {
                continue;
            }
            $byCat[$cid]['games'][] = [
                'id' => $g->getCode(),
                'name' => $g->getName(),
                'minPlayers' => $g->getMinPlayers(),
                'maxPlayers' => $g->getMaxPlayers(),
                'enabled' => $g->isEnabled(),
                'engine' => $g->getEngine(),
            ];
        }

        return $this->json(array_values($byCat));
    }

    #[Route('/games/{code}', name: 'admin_catalog_game_update', methods: ['PATCH'])]
    public function updateGame(string $code, EntityManagerInterface $em, Request $request)
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');
        $game = $em->getRepository(CatalogGame::class)->findOneBy(['code' => $code]);
        if (!$game) {
            return $this->json(['error' => 'Not found'], 404);
        }

        $data = json_decode($request->getContent() ?: '{}', true);

        if (array_key_exists('enabled', $data)) {
            $game->setEnabled((bool)$data['enabled']);
        }
        if (isset($data['name'])) {
            $game->setName((string)$data['name']);
        }
        if (isset($data['minPlayers'])) {
            $game->setMinPlayers(max(1, (int)$data['minPlayers']));
        }
        if (isset($data['maxPlayers'])) {
            $game->setMaxPlayers(max(1, (int)$data['maxPlayers']));
        }
        if (array_key_exists('engine', $data)) {
            $game->setEngine($data['engine'] !== null ? (string)$data['engine'] : null);
        }
        if (isset($data['category'])) {
            $cat = $em->getRepository(CatalogCategory::class)->findOneBy(['code' => (string)$data['category']]);
            if ($cat) {
                $game->setCategory($cat);
            }
        }

        if ($game->getMinPlayers() > $game->getMaxPlayers()) {
            return $this->json(['error' => 'minPlayers cannot exceed maxPlayers'], 400);
        }

        $em->flush();
        return $this->json([
            'id' => $game->getCode(),
            'name' => $game->getName(),
            'minPlayers' => $game->getMinPlayers(),
            'maxPlayers' => $game->getMaxPlayers(),
            'enabled' => $game->isEnabled(),
            'category' => $game->getCategory()->getCode(),
            'engine' => $game->getEngine(),
        ]);
    }

    #[Route('/categories', name: 'admin_catalog_category_create', methods: ['POST'])]
    public function createCategory(EntityManagerInterface $em, Request $request)
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');
        $data = json_decode($request->getContent() ?: '{}', true);

        $code = (string)($data['code'] ?? '');
        $name = (string)($data['name'] ?? '');

        if ($code === '' || $name === '') {
            return $this->json(['error' => 'code and name required'], 400);
        }

        $exists = $em->getRepository(CatalogCategory::class)->findOneBy(['code' => $code]);
        if ($exists) {
            return $this->json(['error' => 'Category exists'], 409);
        }

        $cat = (new CatalogCategory())->setCode($code)->setName($name);
        $em->persist($cat);
        $em->flush();

        return $this->json(['id' => $cat->getCode(), 'name' => $cat->getName()], 201);
    }

    #[Route('/games/{code}/scaffold', name: 'admin_catalog_game_scaffold', methods: ['POST'])]
    public function scaffold(string $code, EntityManagerInterface $em): Response
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');

        if (($_ENV['APP_ENV'] ?? 'dev') !== 'dev' || ($_ENV['ALLOW_CODEGEN'] ?? '0') !== '1') {
            return $this->json(['error' => 'Codegen not allowed'], 403);
        }

        $game = $em->getRepository(CatalogGame::class)->findOneBy(['code' => $code]);
        if (!$game) {
            return $this->json(['error' => 'Not found'], 404);
        }

        $cat = $game->getCategory();
        $projectDir = $this->getParameter('kernel.project_dir');

        $base = $projectDir . DIRECTORY_SEPARATOR . 'src' . DIRECTORY_SEPARATOR . 'Module' . DIRECTORY_SEPARATOR . 'Game' . DIRECTORY_SEPARATOR . 'GameCatalogue';
        $catStudly = $this->studly($cat->getName());
        $gameStudly = $this->studly($game->getName());

        $dirController = $base . DIRECTORY_SEPARATOR . $catStudly . DIRECTORY_SEPARATOR . $gameStudly . DIRECTORY_SEPARATOR . 'Controller';
        $dirService = $base . DIRECTORY_SEPARATOR . $catStudly . DIRECTORY_SEPARATOR . $gameStudly . DIRECTORY_SEPARATOR . 'Service';

        @mkdir($dirController, 0777, true);
        @mkdir($dirService, 0777, true);

        $nsBase = 'App\\Module\\Game\\GameCatalogue\\' . $catStudly . '\\' . $gameStudly;

        $servicePath = $dirService . DIRECTORY_SEPARATOR . $gameStudly . 'Service.php';
        $controllerPath = $dirController . DIRECTORY_SEPARATOR . $gameStudly . 'Controller.php';

        if (!file_exists($servicePath)) {
            file_put_contents($servicePath, $this->templateService($nsBase, $game->getCode()));
        }
        if (!file_exists($controllerPath)) {
            file_put_contents($controllerPath, $this->templateController($nsBase, $game->getCode()));
        }

        $game->setEngine($game->getCode());
        $em->flush();

        return $this->json(['created' => ['service' => $servicePath, 'controller' => $controllerPath]]);
    }

    private function studly(string $s): string
    {
        $parts = preg_split('/[^a-zA-Z0-9]+/', strtolower($s)) ?: [];
        $parts = array_filter($parts, fn($p) => $p !== '');
        return implode('', array_map(fn($p) => ucfirst($p), $parts));
    }

    private function templateService(string $nsBase, string $code): string
    {
        $class = $this->studly($code) . 'Service';
        return <<<PHP
<?php

namespace {$nsBase}\Service;

use App\Module\Game\Engine\GameEngineInterface;
use App\Module\Game\Entity\Room;
use App\Module\User\Entity\User;

final class {$class} implements GameEngineInterface
{
    public function getType(): string { return '{$code}'; }

    public function defaultState(Room \$room): array
    {
        return ['type' => '{$code}', 'round' => 1];
    }

    public function apply(array \$state, array \$payload, Room \$room, User \$user): array
    {
        return \$state;
    }

    public function currentRound(array \$state): int { return (int)(\$state['round'] ?? 1); }

    public function computeScore(array \$state): ?array { return null; }
}
PHP;
    }

    private function templateController(string $nsBase, string $code): string
    {
        $ctrlRoute = "/api/games/{$code}";
        $class = $this->studly($code) . 'Controller';
        $service = $this->studly($code) . 'Service';
        return <<<PHP
<?php

namespace {$nsBase}\Controller;

use App\Module\Game\Entity\Game;
use App\Module\Game\Entity\Room;
use {$nsBase}\Service\{$service};
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('{$ctrlRoute}')]
class {$class} extends AbstractController
{
    public function __construct(private {$service} \$svc) {}

    #[Route('/rooms/{id}/state', name: '{$code}_state', methods: ['GET'])]
    public function state(int \$id, EntityManagerInterface \$em)
    {
        \$room = \$em->getRepository(Room::class)->find(\$id);
        if (!\$room) return \$this->json(['error' => 'Not found'], 404);
        \$game = \$em->getRepository(Game::class)->findOneBy(['room' => \$room]);
        if (!\$game) {
            \$state = \$this->svc->defaultState(\$room);
            \$game = (new Game())
                ->setRoom(\$room)
                ->setState(\$state)
                ->setCurrentRound((int)(\$state['round'] ?? 1))
                ->setStartedAt(new \DateTimeImmutable());
            \$em->persist(\$game);
            \$em->flush();
        }
        return \$this->json(\$game->getState());
    }

    #[Route('/rooms/{id}/move', name: '{$code}_move', methods: ['POST'])]
    public function move(int \$id, Request \$req, EntityManagerInterface \$em)
    {
        \$room = \$em->getRepository(Room::class)->find(\$id);
        if (!\$room) return \$this->json(['error' => 'Not found'], 404);
        \$game = \$em->getRepository(Game::class)->findOneBy(['room' => \$room]);
        if (!\$game) {
            \$state = \$this->svc->defaultState(\$room);
            \$game = (new Game())
                ->setRoom(\$room)
                ->setState(\$state)
                ->setCurrentRound((int)(\$state['round'] ?? 1))
                ->setStartedAt(new \DateTimeImmutable());
            \$em->persist(\$game);
        }
        /** @var \App\Module\User\Entity\User \$me */
        \$me = \$this->getUser();
        \$state = \$this->svc->apply(\$game->getState(), json_decode(\$req->getContent(), true) ?? [], \$room, \$me);
        \$game
            ->setState(\$state)
            ->setCurrentRound((int)(\$state['round'] ?? \$game->getCurrentRound() ?: 1));
        \$em->flush();
        return \$this->json(\$state);
    }
}
PHP;
    }
}
