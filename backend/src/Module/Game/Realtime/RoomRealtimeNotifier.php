<?php

namespace App\Module\Game\Realtime;

use App\Module\Game\Entity\Room;
use Psr\Log\LoggerInterface;
use Symfony\Component\DependencyInjection\ParameterBag\ParameterBagInterface;
use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

class RoomRealtimeNotifier
{
    private string $pushUrl;
    private string $secret;

    public function __construct(
        private readonly HttpClientInterface $httpClient,
        private readonly RoomRealtimePayloadBuilder $payloadBuilder,
        private readonly LoggerInterface $logger,
        ParameterBagInterface $parameterBag
    ) {
        $configuredUrl = trim((string) $parameterBag->get('app.ws.push_url'));
        if ($configuredUrl === '') {
            $host = (string) $parameterBag->get('app.ws.host');
            $port = (int) $parameterBag->get('app.ws.port') ?: 8081;
            $configuredUrl = sprintf('http://%s:%d/push', $host, $port);
        }
        $this->pushUrl = rtrim($configuredUrl, '/');
        $this->secret = (string) $parameterBag->get('app.ws.push_secret');
    }

    public function notify(Room $room, string $type = 'full'): void
    {
        if ($this->pushUrl === '') {
            return;
        }

        try {
            $payload = $this->payloadBuilder->build($room);
        } catch (\Throwable $exception) {
            $this->logger->error('Impossible de construire la charge pour diffusion temps reel', [
                'exception' => $exception,
                'room' => $room->getId(),
            ]);
            return;
        }

        $body = [
            'roomId' => $room->getId(),
            'type' => $type,
            'payload' => $payload,
        ];

        $headers = [
            'Content-Type' => 'application/json',
        ];
        if ($this->secret !== '') {
            $headers['X-Realtime-Secret'] = $this->secret;
        }

        try {
            $this->httpClient->request('POST', $this->pushUrl, [
                'headers' => $headers,
                'json' => $body,
                'timeout' => 3,
            ]);
        } catch (TransportExceptionInterface $exception) {
            $this->logger->warning('Echec envoi notification temps reel', [
                'exception' => $exception,
                'url' => $this->pushUrl,
                'room' => $room->getId(),
            ]);
        }
    }
}
