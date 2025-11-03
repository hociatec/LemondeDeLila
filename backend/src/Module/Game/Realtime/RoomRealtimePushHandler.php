<?php

namespace App\Module\Game\Realtime;

use Amp\Http\Server\Request;
use Amp\Http\Server\RequestHandler;
use Amp\Http\Server\Response;
use Amp\Http\Status;
use Amp\Promise;
use Psr\Log\LoggerInterface;
use function Amp\call;

class RoomRealtimePushHandler implements RequestHandler
{
    public function __construct(
        private readonly RoomRealtimeBroker $broker,
        private readonly LoggerInterface $logger,
        private readonly string $secret
    ) {
    }

    public function handleRequest(Request $request): Promise
    {
        return call(function () use ($request) {
            if ($request->getMethod() !== 'POST') {
                $response = new Response(Status::METHOD_NOT_ALLOWED);
                $response->setHeader('Allow', 'POST');
                return $response;
            }

            if (!$this->isAuthorized($request)) {
                return new Response(Status::UNAUTHORIZED);
            }

            $raw = yield $request->getBody()->buffer();
            $decoded = json_decode($raw, true);
            if (!is_array($decoded)) {
                $this->logger->warning('Payload push invalide', ['raw' => $raw]);
                return new Response(Status::BAD_REQUEST);
            }

            $roomId = $decoded['roomId'] ?? null;
            if (!is_int($roomId)) {
                $roomId = is_numeric($roomId ?? null) ? (int) $roomId : null;
            }
            if (!$roomId) {
                return new Response(Status::BAD_REQUEST);
            }

            $type = is_string($decoded['type'] ?? null) ? $decoded['type'] : 'full';
            $payload = $decoded['payload'] ?? [];
            if (!is_array($payload)) {
                $payload = [];
            }

            $message = [
                'type' => $type,
                'roomId' => $roomId,
                'payload' => $payload,
            ];

            yield $this->broker->broadcast($roomId, $message);

            return new Response(Status::NO_CONTENT);
        });
    }

    private function isAuthorized(Request $request): bool
    {
        if ($this->secret === '') {
            return true;
        }

        $header = $request->getHeader('x-realtime-secret') ?? $request->getHeader('X-REALTIME-SECRET');
        if (is_string($header) && hash_equals($this->secret, trim($header))) {
            return true;
        }

        $auth = $request->getHeader('authorization') ?? $request->getHeader('Authorization');
        if (is_string($auth) && str_starts_with($auth, 'Bearer ')) {
            $token = trim(substr($auth, 7));
            return hash_equals($this->secret, $token);
        }

        return false;
    }
}
