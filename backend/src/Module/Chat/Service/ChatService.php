<?php

namespace App\Module\Chat\Service;

use App\Module\Chat\Entity\ChatMessage;
use App\Module\Chat\Repository\ChatMessageRepository;
use App\Module\User\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;

class ChatService
{
    private const DEFAULT_HISTORY_LIMIT = 200;

    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly ChatMessageRepository $messages,
        private readonly UserRepository $users
    ) {
    }

    public function recordMessage(int $userId, string $text): array
    {
        $user = $this->users->find($userId);
        if (!$user) {
            throw new \RuntimeException(sprintf('Utilisateur #%d introuvable pour le tchat.', $userId));
        }
        $payload = $this->sanitizeMessage($text);
        if ($payload === '') {
            throw new \InvalidArgumentException('Empty chat message payload.');
        }

        $message = new ChatMessage($user, $payload);

        $this->entityManager->persist($message);
        $this->entityManager->flush();

        return $this->normalize($message);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function getRecentMessages(int $limit = self::DEFAULT_HISTORY_LIMIT, ?\DateTimeImmutable $since = null): array
    {
        $limit = max(1, min(500, $limit));
        if ($since !== null) {
            $items = $this->messages->findSince($since, $limit);
        } else {
            $items = $this->messages->findRecent($limit);
            $items = array_reverse($items);
        }

        return array_map(fn(ChatMessage $message) => $this->normalize($message), $items);
    }

    private function sanitizeMessage(string $text): string
    {
        $trimmed = trim($text);
        if ($trimmed === '') {
            return '';
        }
        if (mb_strlen($trimmed) > 1000) {
            return mb_substr($trimmed, 0, 1000);
        }
        return $trimmed;
    }

    /**
     * @return array<string, mixed>
     */
    private function normalize(ChatMessage $message): array
    {
        $user = $message->getUser();

        return [
            'type' => 'chat-message',
            'id' => $message->getMessageId(),
            'text' => $message->getMessage(),
            'createdAt' => $message->getCreatedAt()->format(\DATE_ATOM),
            'user' => [
                'id' => $user->getId(),
                'username' => $user->getUsername(),
            ],
        ];
    }
}
