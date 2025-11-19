<?php

namespace App\Module\Game\GameCatalogue\JeuxDeCartes\VentsDansants\DameNature\Controller;

use App\Module\Game\Entity\Game;
use App\Module\Game\Entity\Room;
use App\Module\Game\GameCatalogue\JeuxDeCartes\VentsDansants\DameNature\Service\DameNatureService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/games/dame-nature')]
final class DameNatureStateController extends AbstractController
{
    public function __construct(private readonly DameNatureService $service)
    {
    }

    #[Route('/rooms/{id}/state', name: 'dame_nature_state', methods: ['GET'])]
    public function state(int $id, EntityManagerInterface $em): Response
    {
        $room = $em->getRepository(Room::class)->find($id);
        if (!$room) {
            return $this->json(['error' => 'Not found'], Response::HTTP_NOT_FOUND);
        }

        $game = $em->getRepository(Game::class)->findOneBy(['room' => $room]);
        if (!$game) {
            $state = $this->service->defaultState($room);
            $game = (new Game())
                ->setRoom($room)
                ->setState($state)
                ->setCurrentRound($this->service->currentRound($state))
                ->setStartedAt(new \DateTimeImmutable());
            $em->persist($game);
            $em->flush();
        }

        /** @var \App\Module\User\Entity\User $viewer */
        $viewer = $this->getUser();

        return $this->json($this->service->presentState($game->getState(), $viewer));
    }
}
