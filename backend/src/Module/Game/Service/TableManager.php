<?php

namespace App\Module\Game\Service;

use App\Module\Game\Entity\Game;
use App\Module\Game\Entity\Room;
use App\Module\Game\Entity\TableSnapshot;
use Doctrine\ORM\EntityManagerInterface;

class TableManager
{
    public function __construct(private readonly EntityManagerInterface $em) {}

    public function ensureGame(Room $room): Game
    {
        $repo = $this->em->getRepository(Game::class);
        $game = $repo->findOneBy(['room' => $room]);
        if (!$game) {
            $game = (new Game())
                ->setRoom($room)
                ->setState(['type' => $room->getGameType()])
                ->setCurrentRound(1)
                ->setStartedAt(new \DateTimeImmutable());
            $this->em->persist($game);
            $this->em->flush();
        }
        return $game;
    }

    public function snapshot(Room $room, ?string $label, ?int $userId = null): TableSnapshot
    {
        $game = $this->em->getRepository(Game::class)->findOneBy(['room' => $room]);
        $snap = (new TableSnapshot())
            ->setRoom($room)
            ->setLabel($label)
            ->setState($game?->getState() ?? ['type' => $room->getGameType()]);
        if ($userId) {
            $user = $this->em->getReference(\App\Module\User\Entity\User::class, $userId);
            $snap->setCreatedBy($user);
        }
        $this->em->persist($snap);
        $this->em->flush();
        return $snap;
    }

    public function restore(Room $room, TableSnapshot $snapshot): Game
    {
        $game = $this->ensureGame($room);
        $game->setState($snapshot->getState());
        $this->em->flush();
        return $game;
    }
}

