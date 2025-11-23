<?php

namespace App\Module\Game\Realtime;

use App\Module\Game\Entity\Room;
use Amp\asyncCall;
use App\Module\Game\Realtime\RoomRealtimeBroker;
use App\Module\Game\Realtime\RoomRealtimePayloadBuilder;
use Psr\Log\LoggerInterface;

class RoomRealtimeNotifier
{
    public function __construct(
        private readonly RoomRealtimeBroker $broker,
        private readonly RoomRealtimePayloadBuilder $payloadBuilder,
        private readonly LoggerInterface $logger
    ) {
    }

    public function notify(Room $room, string $type = 'full', array $extra = []): void
    {
        $roomId = $room->getId();
        if ($roomId === null) {
            return;
        }
        try {
            $payload = $this->payloadBuilder->build($room);
        } catch (\Throwable $exception) {
            $this->logger->error('Impossible de construire la charge pour diffusion temps reel', [
                'exception' => $exception,
                'room' => $roomId,
            ]);
            return;
        }
        foreach ($extra as $key => $value) {
            $payload[$key] = $value;
        }
        asyncCall(function () use ($roomId, $type, $payload) {
            yield $this->broker->broadcast($roomId, [
                'type' => $type,
                'roomId' => $roomId,
                'payload' => $payload,
            ]);
        });
    }
}
