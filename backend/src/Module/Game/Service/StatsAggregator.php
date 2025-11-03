<?php

namespace App\Module\Game\Service;

use App\Module\Game\Entity\Game;
use App\Module\Game\Entity\GameStat;
use Doctrine\ORM\EntityManagerInterface;

class StatsAggregator
{
    public function __construct(private readonly EntityManagerInterface $em) {}

    public function onStateUpdated(Game $game, array $state): void
    {
        $type = (string)($state['type'] ?? 'unknown');
        $ended = $this->isEnded($state);
        $round = (int)($state['round'] ?? $game->getCurrentRound() ?: 0);

        if ($ended && $game->getEndedAt() === null) {
            $game->setEndedAt(new \DateTimeImmutable());
        }

        if ($ended) {
            $repo = $this->em->getRepository(GameStat::class);
            $stat = $repo->findOneBy(['gameType' => $type]);
            if (!$stat) { $stat = (new GameStat())->setGameType($type)->setData([]); $this->em->persist($stat); }
            $data = $stat->getData();
            $data['totalGames'] = (int)($data['totalGames'] ?? 0) + 1;
            $data['totalRounds'] = (int)($data['totalRounds'] ?? 0) + max(0, $round);
            $duration = 0;
            if ($game->getStartedAt() && $game->getEndedAt()) {
                $duration = max(0, $game->getEndedAt()->getTimestamp() - $game->getStartedAt()->getTimestamp());
            }
            $data['totalDurationSecs'] = (int)($data['totalDurationSecs'] ?? 0) + $duration;
            $tg = (int)$data['totalGames'];
            $data['averageDurationSecs'] = $tg > 0 ? $data['totalDurationSecs'] / $tg : 0;
            $data['averageRounds'] = $tg > 0 ? $data['totalRounds'] / $tg : 0;
            $data['lastPlayedAt'] = (new \DateTimeImmutable())->format(DATE_ATOM);
            $stat->setData($data);
        }

        $this->em->flush();
    }

    private function isEnded(array $state): bool
    {
        if (isset($state['status']) && $state['status'] === 'ended') return true;
        if (array_key_exists('winner', $state) && $state['winner'] !== null) return true;
        return false;
    }
}

