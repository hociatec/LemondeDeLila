<?php

namespace App\Module\Game\Controller;

use App\Module\Game\Entity\Game;
use App\Module\Game\Entity\Room;
use App\Module\Game\Entity\RoomParticipant;
use App\Module\Game\Entity\TableSnapshot;
use App\Module\Game\Engine\EngineRegistry;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/rooms')]
class RealtimeController extends AbstractController
{
    #[Route('/{id}/events', name: 'rooms_events', methods: ['GET'])]
    public function events(int $id, EntityManagerInterface $em, EngineRegistry $registry): Response
    {
        $room = $em->getRepository(Room::class)->find($id);
        if (!$room) { return $this->json(['error' => 'Not found'], 404); }

        $response = new StreamedResponse(function() use ($em, $room, $registry) {
            $lastHash = null;
            $send = function(string $event, array $data) {
                echo "event: {$event}\n";
                echo 'data: '.json_encode($data, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)."\n\n";
                @ob_flush(); @flush();
            };

            for ($i=0; $i<60; $i++) { // ~60s
                $payload = $this->buildPayload($em, $room, $registry);
                $hash = md5(json_encode($payload));
                if ($hash !== $lastHash) {
                    $send('full', $payload);
                    $lastHash = $hash;
                } else {
                    // keep-alive ping to prevent timeouts
                    echo ": ping\n\n"; @ob_flush(); @flush();
                }
                sleep(1);
            }
        });
        $response->headers->set('Content-Type', 'text/event-stream');
        $response->headers->set('Cache-Control', 'no-cache');
        $response->headers->set('X-Accel-Buffering', 'no');
        return $response;
    }

    private function buildPayload(EntityManagerInterface $em, Room $room, EngineRegistry $registry): array
    {
        // Room data
        $partRepo = $em->getRepository(RoomParticipant::class);
        $playersCount = method_exists($partRepo, 'countActiveByRoomAndRole') ? $partRepo->countActiveByRoomAndRole($room, 'player') : $room->getPlayers()->count();
        $spectatorsCount = method_exists($partRepo, 'countActiveByRoomAndRole') ? $partRepo->countActiveByRoomAndRole($room, 'spectator') : 0;
        $roomData = [
            'id' => $room->getId(),
            'name' => $room->getName(),
            'isPrivate' => $room->isPrivate(),
            'maxPlayers' => $room->getMaxPlayers(),
            'status' => $room->getStatus(),
            'gameType' => $room->getGameType(),
            'counts' => [ 'players' => $playersCount, 'spectators' => $spectatorsCount ],
            'owner' => $room->getOwner() ? [ 'id' => $room->getOwner()->getId(), 'username' => $room->getOwner()->getUsername() ] : null,
            'players' => array_map(fn(\App\Module\User\Entity\User $u) => [ 'id' => $u->getId(), 'username' => $u->getUsername() ], $room->getPlayers()->toArray()),
        ];

        // Game state + score
        $game = $em->getRepository(Game::class)->findOneBy(['room' => $room]);
        $state = $game?->getState() ?? null;
        $type = $state['type'] ?? $room->getGameType();
        $engine = $registry->get($type);
        $score = $engine && $state ? $engine->computeScore($state) : null;
        $currentRound = $game?->getCurrentRound() ?? ($engine && $state ? $engine->currentRound($state) : 0);

        // Snapshots (head list)
        $snaps = $em->getRepository(TableSnapshot::class)->findBy(['room' => $room], ['id' => 'DESC']);
        $snapData = array_map(function (TableSnapshot $s) {
            return [ 'id' => $s->getId(), 'label' => $s->getLabel(), 'createdAt' => $s->getCreatedAt()->format(DATE_ATOM) ];
        }, $snaps);

        return [
            'room' => $roomData,
            'score' => [ 'type' => $type, 'score' => $score, 'currentRound' => $currentRound ],
            'snapshots' => $snapData,
            'gameState' => $state,
        ];
    }
}

