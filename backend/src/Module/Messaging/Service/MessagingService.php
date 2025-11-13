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

        return $this->normalizeForUser($message, $sender);
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
        return \array_map(fn(PrivateMessage $message) => $this->normalizeForUser($message, $currentUser), $items);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function inbox(User $user, int $limit = self::DEFAULT_HISTORY_LIMIT): array
    {
        $limit = $this->clampLimit($limit);
        $items = $this->messages->findInbox($user->getId(), $limit);
        return \array_map(fn(PrivateMessage $message) => $this->normalizeForUser($message, $user), $items);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function outbox(User $user, int $limit = self::DEFAULT_HISTORY_LIMIT): array
    {
        $limit = $this->clampLimit($limit);
        $items = $this->messages->findOutbox($user->getId(), $limit);
        return \array_map(fn(PrivateMessage $message) => $this->normalizeForUser($message, $user), $items);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function deleted(User $user, int $limit = self::DEFAULT_HISTORY_LIMIT): array
    {
        $limit = $this->clampLimit($limit);
        $items = $this->messages->findDeleted($user->getId(), $limit);
        return \array_map(fn(PrivateMessage $message) => $this->normalizeForUser($message, $user), $items);
    }

    /**
     * @return array<string, mixed>
     */
    public function delete(User $user, string $messageId): array
    {
        $message = $this->messages->findOneByMessageId($messageId);
        if (!$message) {
            throw new \RuntimeException('Message introuvable.');
        }
        $isSender = $message->getSender()->getId() === $user->getId();
        $isRecipient = $message->getRecipient()->getId() === $user->getId();
        if (!$isSender && !$isRecipient) {
            throw new \RuntimeException('Accès refusé pour ce message.');
        }
        $changed = false;
        if ($isSender) {
            if ($message->isDeletedBySender()) {
                return $this->normalizeForUser($message, $user);
            }
            $message->markDeletedBySender();
            $changed = true;
        }
        if ($isRecipient) {
            if ($message->isDeletedByRecipient()) {
                return $this->normalizeForUser($message, $user);
            }
            $message->markDeletedByRecipient();
            $changed = true;
        }
        if ($changed) {
            $this->entityManager->flush();
        }
        return $this->normalizeForUser($message, $user);
    }

    /**
     * @return array<string, mixed>
     */
    public function restore(User $user, string $messageId): array
    {
        $message = $this->messages->findOneByMessageId($messageId);
        if (!$message) {
            throw new \RuntimeException('Message introuvable.');
        }
        $isSender = $message->getSender()->getId() === $user->getId();
        $isRecipient = $message->getRecipient()->getId() === $user->getId();
        if (!$isSender && !$isRecipient) {
            throw new \RuntimeException('Accès refusé pour ce message.');
        }

        $changed = false;
        if ($isSender && $message->isDeletedBySender()) {
            $message->restoreForSender();
            $changed = true;
        }
        if ($isRecipient && $message->isDeletedByRecipient()) {
            $message->restoreForRecipient();
            $changed = true;
        }

        if (!$changed) {
            throw new \RuntimeException('Message déjà restauré.');
        }

        $this->entityManager->flush();
        return $this->normalizeForUser($message, $user);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findUserByUsername(string $username): ?array
    {
        $normalized = \trim($username);
        if ($normalized === '') {
            return null;
        }
        $user = $this->users->findOneByUsernameInsensitive($normalized);
        if (!$user instanceof User) {
            return null;
        }
        return [
            'id' => $user->getId(),
            'username' => $user->getUsername(),
        ];
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
    private function normalizeForUser(PrivateMessage $message, User $viewer): array
    {
        $viewerIsSender = $message->getSender()->getId() === $viewer->getId();
        $direction = $viewerIsSender ? 'sent' : 'received';
        $deletedAt = $viewerIsSender ? $message->getDeletedBySenderAt() : $message->getDeletedByRecipientAt();

        return [
            'id' => $message->getMessageId(),
            'text' => $message->getMessage(),
            'createdAt' => $message->getCreatedAt()->format(\DATE_ATOM),
            'direction' => $direction,
            'deletedAt' => $deletedAt?->format(\DATE_ATOM),
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
