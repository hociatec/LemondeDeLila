<?php

namespace App\Module\Game\Realtime;

use Amp\Http\Server\Request;
use Amp\Http\Server\Response;
use Amp\Http\Status;
use Amp\Promise;
use Amp\Success;
use Amp\Loop;
use Amp\Websocket\Client;
use Amp\Websocket\Code;
use Amp\Websocket\Message;
use Amp\Websocket\Server\ClientHandler;
use Amp\Websocket\Server\Gateway;
use App\Module\Game\Entity\Room;
use App\Module\Game\Repository\RoomRepository;
use App\Module\User\Entity\User;
use App\Module\User\Repository\UserRepository;
use Lexik\Bundle\JWTAuthenticationBundle\Exception\JWTDecodeFailureException;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Psr\Log\LoggerInterface;
use function Amp\call;

class RoomRealtimeClientHandler implements ClientHandler
{
    private const ATTR_ROOM_ID = 'app.realtime.room_id';
    private const ATTR_USER_ID = 'app.realtime.user_id';
    private const ATTR_USERNAME = 'app.realtime.username';
    private const ATTR_TOKEN_EXP = 'app.realtime.token_exp';

    public function __construct(
        private readonly JWTTokenManagerInterface $jwtManager,
        private readonly UserRepository $userRepository,
        private readonly RoomRepository $roomRepository,
        private readonly RoomRealtimeAccessChecker $accessChecker,
        private readonly RoomRealtimeBroker $broker,
        private readonly RoomRealtimePayloadBuilder $payloadBuilder,
        private readonly LoggerInterface $logger
    ) {
    }

    public function handleHandshake(Gateway $gateway, Request $request, Response $response): Promise
    {
        return call(function () use ($gateway, $request, $response) {
            $roomId = $this->extractRoomId($request);
            if ($roomId === null) {
                return yield $gateway->getErrorHandler()->handleError(Status::BAD_REQUEST, 'Room id requis', $request);
            }

            $token = $this->extractToken($request);
            if ($token === null) {
                return yield $gateway->getErrorHandler()->handleError(Status::UNAUTHORIZED, 'Token manquant', $request);
            }

            try {
                $payload = $this->jwtManager->parse($token);
            } catch (JWTDecodeFailureException $exception) {
                $this->logger->warning('Handshake rejete (token invalide)', ['exception' => $exception]);
                return yield $gateway->getErrorHandler()->handleError(Status::UNAUTHORIZED, 'Token invalide', $request);
            }

            $identifierClaim = $this->jwtManager->getUserIdClaim();
            $identifier = $payload[$identifierClaim] ?? null;
            if (!is_string($identifier) || $identifier === '') {
                return yield $gateway->getErrorHandler()->handleError(Status::UNAUTHORIZED, 'Identifiant token invalide', $request);
            }

            /** @var User|null $user */
            $user = $this->userRepository->findOneBy(['username' => $identifier]) ??
                $this->userRepository->find($identifier);
            if (!$user) {
                return yield $gateway->getErrorHandler()->handleError(Status::UNAUTHORIZED, 'Utilisateur introuvable', $request);
            }

            /** @var Room|null $room */
            $room = $this->roomRepository->find($roomId);
            if (!$room) {
                return yield $gateway->getErrorHandler()->handleError(Status::NOT_FOUND, 'Table introuvable', $request);
            }

            if (!$this->accessChecker->canAccess($user, $room)) {
                return yield $gateway->getErrorHandler()->handleError(Status::FORBIDDEN, 'Acces refuse', $request);
            }

            $expiresAt = null;
            if (isset($payload['exp']) && is_numeric($payload['exp'])) {
                $expiresAt = (int) $payload['exp'];
            }
            if ($expiresAt !== null && $expiresAt <= time()) {
                return yield $gateway->getErrorHandler()->handleError(Status::UNAUTHORIZED, 'Session expiree', $request);
            }

            $request->setAttribute(self::ATTR_ROOM_ID, $roomId);
            $request->setAttribute(self::ATTR_USER_ID, $user->getId());
            $request->setAttribute(self::ATTR_USERNAME, $user->getUsername());
            $request->setAttribute(self::ATTR_TOKEN_EXP, $expiresAt);

            return $response;
        });
    }

    public function handleClient(Gateway $gateway, Client $client, Request $request, Response $response): Promise
    {
        return call(function () use ($client, $request) {
            $roomId = $request->getAttribute(self::ATTR_ROOM_ID);
            $userId = $request->getAttribute(self::ATTR_USER_ID);
            $username = $request->getAttribute(self::ATTR_USERNAME);
            $expiresAt = $request->getAttribute(self::ATTR_TOKEN_EXP);

            if (!is_int($roomId) || $roomId <= 0 || !is_int($userId)) {
                yield $client->close();
                return;
            }

            $this->broker->register($roomId, $client, [
                'userId' => $userId,
                'username' => $username,
                'roomName' => $room->getName(),
            ]);

            $expiryWatcher = null;
            if (is_int($expiresAt)) {
                $remainingMs = max(0, ($expiresAt - time()) * 1000);
                if ($remainingMs <= 0) {
                    try {
                        yield $client->send(json_encode([
                            'type' => 'auth-invalid',
                            'reason' => 'expired',
                        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
                    } catch (\Throwable) {
                    }
                    try {
                        yield $client->close(Code::POLICY_ERROR, 'auth-invalid');
                    } catch (\Throwable) {
                    }
                    $this->broker->unregister($client);
                    return;
                }

                $expiryWatcher = Loop::delay($remainingMs, function (string $watcherId) use ($client, &$expiryWatcher): void {
                    $expiryWatcher = null;
                    \Amp\asyncCall(function () use ($client): \Generator {
                        try {
                            yield $client->send(json_encode([
                                'type' => 'auth-invalid',
                                'reason' => 'expired',
                            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
                        } catch (\Throwable) {
                            // ignore
                        }
                        try {
                            yield $client->close(Code::POLICY_ERROR, 'auth-invalid');
                        } catch (\Throwable) {
                            // ignore
                        }
                        return;
                    });
                });

                $client->onClose(static function (Client $client, int $code, string $reason) use (&$expiryWatcher): void {
                    if ($expiryWatcher !== null) {
                        Loop::cancel($expiryWatcher);
                        $expiryWatcher = null;
                    }
                });
            }

            try {
                $snapshotPayload = $this->payloadBuilder->buildById($roomId);
                $initialMessage = [
                    'type' => 'initial',
                    'roomId' => $roomId,
                    'payload' => $snapshotPayload,
                ];
                yield $client->send(json_encode($initialMessage, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
            } catch (\Throwable $exception) {
                $this->logger->error('Impossible de préparer la charge initiale WS', [
                    'exception' => $exception,
                    'roomId' => $roomId,
                ]);
            }

            try {
                while ($message = yield $client->receive()) {
                    \assert($message instanceof Message);
                    try {
                        yield $message->buffer(); // ignore any inbound message
                    } catch (\Throwable) {
                        // ignore
                    }
                }
            } catch (\Throwable $exception) {
                $this->logger->debug('Client WS interrompu', [
                    'roomId' => $roomId,
                    'exception' => $exception,
                ]);
            } finally {
                if ($expiryWatcher !== null) {
                    Loop::cancel($expiryWatcher);
                    $expiryWatcher = null;
                }
                $this->broker->unregister($client);
            }
        });
    }

    private function extractRoomId(Request $request): ?int
    {
        parse_str($request->getUri()->getQuery(), $query);
        $raw = $query['room'] ?? null;
        if (is_array($raw)) {
            $raw = $raw[0] ?? null;
        }
        if (!is_scalar($raw) || (string) $raw === '') {
            return null;
        }
        $id = (int) $raw;
        return $id > 0 ? $id : null;
    }

    private function extractToken(Request $request): ?string
    {
        $authorization = $request->getHeader('authorization') ?? $request->getHeader('Authorization');
        if (is_string($authorization) && stripos($authorization, 'bearer ') === 0) {
            return trim(substr($authorization, 7));
        }

        parse_str($request->getUri()->getQuery(), $query);
        $token = $query['token'] ?? null;
        if (is_array($token)) {
            $token = $token[0] ?? null;
        }

        return is_string($token) && $token !== '' ? $token : null;
    }
}
