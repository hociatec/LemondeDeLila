<?php

namespace App\Module\Messaging\Service;

use App\Module\Messaging\Entity\PrivateMessage;
use App\Module\Messaging\Repository\PrivateMessageRepository;
use App\Module\User\Entity\User;
use App\Module\User\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;

class MessagingService
{
    private const MAX_MESSAGE_LENGTH = 1000;
    private const DEFAULT_HISTORY_LIMIT = 100;

    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly PrivateMessageRepository $messages,
        private readonly UserRepository $users
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function send(User $sender, int $recipientId, string $text): array
    {
        if ($sender->getId() === $recipientId) {
            throw new \InvalidArgumentException('Impossible de s\'envoyer un message prive.');
        }
        $recipient = $this->users->find($recipientId);
        if (!$recipient) {
            throw new \RuntimeException('Destinataire introuvable.');
        }
        $payload = $this->sanitize($text);
        if ($payload === '') {
            throw new \InvalidArgumentException('Message prive vide.');
        }

        $message = new PrivateMessage($sender, $recipient, $payload);
        $this->entityManager->persist($message);
        $this->entityManager->flush();

        return $this->normalize($message);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function conversation(User $currentUser, int $otherUserId, int $limit = self::DEFAULT_HISTORY_LIMIT): array
    {
        if ($currentUser->getId() === $otherUserId) {
            return [];
        }
        $other = $this->users->find($otherUserId);
        if (!$other) {
            throw new \RuntimeException('Utilisateur introuvable.');
        }
        $limit = $this->clampLimit($limit);
        $items = $this->messages->findConversation($currentUser->getId(), $otherUserId, $limit);
        $items = \array_reverse($items);
        return \array_map(fn(PrivateMessage $message) => $this->normalize($message), $items);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function inbox(User $user, int $limit = self::DEFAULT_HISTORY_LIMIT): array
    {
        $limit = $this->clampLimit($limit);
        $items = $this->messages->findInbox($user->getId(), $limit);
        return \array_map(fn(PrivateMessage $message) => $this->normalize($message), $items);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function outbox(User $user, int $limit = self::DEFAULT_HISTORY_LIMIT): array
    {
        $limit = $this->clampLimit($limit);
        $items = $this->messages->findOutbox($user->getId(), $limit);
        return \array_map(fn(PrivateMessage $message) => $this->normalize($message), $items);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function describeUser(int $userId): ?array
    {
        $user = $this->users->find($userId);
        if (!$user instanceof User) {
            return null;
        }
        return [
            'id' => $user->getId(),
            'username' => $user->getUsername(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function normalize(PrivateMessage $message): array
    {
        return [
            'id' => $message->getMessageId(),
            'text' => $message->getMessage(),
            'createdAt' => $message->getCreatedAt()->format(\DATE_ATOM),
            'sender' => [
                'id' => $message->getSender()->getId(),
                'username' => $message->getSender()->getUsername(),
            ],
            'recipient' => [
                'id' => $message->getRecipient()->getId(),
                'username' => $message->getRecipient()->getUsername(),
            ],
        ];
    }

    private function sanitize(string $text): string
    {
        $trimmed = \trim($text);
        if ($trimmed === '') {
            return '';
        }
        if (\mb_strlen($trimmed) > self::MAX_MESSAGE_LENGTH) {
            return \mb_substr($trimmed, 0, self::MAX_MESSAGE_LENGTH);
        }
        return $trimmed;
    }

    private function clampLimit(int $limit): int
    {
        return \max(1, \min(500, $limit));
    }
}
