<?php

namespace App\Module\Game\Realtime;

use Amp\Http\Server\Request;
use Amp\Http\Server\Response;
use Amp\Http\Status;
use Amp\Loop;
use Amp\Promise;
use Amp\Websocket\Client;
use Amp\Websocket\Code;
use Amp\Websocket\Message;
use Amp\Websocket\Server\ClientHandler;
use Amp\Websocket\Server\Gateway;
use App\Module\User\Entity\User;
use App\Module\User\Repository\UserRepository;
use Lexik\Bundle\JWTAuthenticationBundle\Exception\JWTDecodeFailureException;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Psr\Log\LoggerInterface;
use function Amp\call;

class PresenceRealtimeClientHandler implements ClientHandler
{
    private const ATTR_USER_ID = 'app.presence.user_id';
    private const ATTR_USERNAME = 'app.presence.username';
    private const ATTR_TOKEN_EXP = 'app.presence.token_exp';

    public function __construct(
        private readonly JWTTokenManagerInterface $jwtManager,
        private readonly UserRepository $userRepository,
        private readonly PresenceRealtimeBroker $presenceBroker,
        private readonly LoggerInterface $logger
    ) {
    }

    public function handleHandshake(Gateway $gateway, Request $request, Response $response): Promise
    {
        return call(function () use ($gateway, $request, $response) {
            $token = $this->extractToken($request);
            if ($token === null) {
                return yield $gateway->getErrorHandler()->handleError(Status::UNAUTHORIZED, 'Token manquant', $request);
            }

            try {
                $payload = $this->jwtManager->parse($token);
            } catch (JWTDecodeFailureException $exception) {
                $this->logger->warning('Handshake presence rejete (token invalide)', ['exception' => $exception]);
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

            $expiresAt = null;
            if (isset($payload['exp']) && is_numeric($payload['exp'])) {
                $expiresAt = (int) $payload['exp'];
            }
            if ($expiresAt !== null && $expiresAt <= time()) {
                return yield $gateway->getErrorHandler()->handleError(Status::UNAUTHORIZED, 'Session expiree', $request);
            }

            $request->setAttribute(self::ATTR_USER_ID, $user->getId());
            $request->setAttribute(self::ATTR_USERNAME, $user->getUsername());
            $request->setAttribute(self::ATTR_TOKEN_EXP, $expiresAt);

            return $response;
        });
    }

    public function handleClient(Gateway $gateway, Client $client, Request $request, Response $response): Promise
    {
        return call(function () use ($client, $request) {
            $userId = $request->getAttribute(self::ATTR_USER_ID);
            $username = $request->getAttribute(self::ATTR_USERNAME);
            $expiresAt = $request->getAttribute(self::ATTR_TOKEN_EXP);

            if (!is_int($userId) || !is_string($username)) {
                yield $client->close();
                return;
            }

            $this->presenceBroker->register($client, [
                'userId' => $userId,
                'username' => $username,
            ]);

            $expiryWatcher = null;
            if (is_int($expiresAt)) {
                $remainingMs = max(0, ($expiresAt - time()) * 1000);
                if ($remainingMs <= 0) {
                    yield from $this->closeForInvalidAuth($client);
                    return;
                }

                $expiryWatcher = Loop::delay($remainingMs, function (string $watcherId) use ($client, &$expiryWatcher): void {
                    $expiryWatcher = null;
                    \Amp\asyncCall(function () use ($client): \Generator {
                        yield from $this->closeForInvalidAuth($client);
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
                yield $this->presenceBroker->sendSnapshotTo($client);
                yield $this->presenceBroker->sendChatHistoryTo($client);
            } catch (\Throwable $exception) {
                $this->logger->debug('Envoi presence initial impossible', ['exception' => $exception]);
            }

            try {
                while ($message = yield $client->receive()) {
                    \assert($message instanceof Message);
                    try {
                        $payload = json_decode(yield $message->buffer(), true, 512, JSON_THROW_ON_ERROR);
                    } catch (\Throwable) {
                        continue;
                    }

                    if (!is_array($payload)) {
                        continue;
                    }

                    $type = $payload['type'] ?? null;
                    if ($type === 'chat-send') {
                        $text = $payload['text'] ?? '';
                        if (!is_string($text)) {
                            continue;
                        }
                        $text = trim($text);
                        if ($text === '') {
                            continue;
                        }
                        if (\strlen($text) > 1000) {
                            $text = \mb_substr($text, 0, 1000);
                        }
                        try {
                            $this->presenceBroker->appendChatMessage($userId, $text);
                        } catch (\Throwable $exception) {
                            $this->logger->debug('Chat presence impossible', ['exception' => $exception]);
                        }
                    }
                }
            } catch (\Throwable $exception) {
                $this->logger->debug('Client presence WS interrompu', ['exception' => $exception]);
            } finally {
                if ($expiryWatcher !== null) {
                    Loop::cancel($expiryWatcher);
                    $expiryWatcher = null;
                }
                $this->presenceBroker->unregister($client);
            }
        });
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

    private function closeForInvalidAuth(Client $client): \Generator
    {
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

        $this->presenceBroker->unregister($client);
    }

}
