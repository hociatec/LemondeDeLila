<?php

namespace App\Module\Messaging\Entity;

use App\Module\Messaging\Repository\PrivateMessageRepository;
use App\Module\User\Entity\User;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: PrivateMessageRepository::class)]
#[ORM\Table(name: 'messaging_private_messages')]
#[ORM\Index(columns: ['created_at'], name: 'idx_messaging_private_messages_created_at')]
#[ORM\Index(columns: ['sender_id'], name: 'idx_messaging_private_messages_sender')]
#[ORM\Index(columns: ['recipient_id'], name: 'idx_messaging_private_messages_recipient')]
#[ORM\UniqueConstraint(name: 'uniq_messaging_private_messages_message_id', columns: ['message_id'])]
class PrivateMessage
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'sender_id', nullable: false, onDelete: 'CASCADE')]
    private User $sender;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'recipient_id', nullable: false, onDelete: 'CASCADE')]
    private User $recipient;

    #[ORM\Column(name: 'message_id', type: 'string', length: 36, unique: true)]
    private string $messageId;

    #[ORM\Column(type: 'text')]
    private string $message;

    #[ORM\Column(name: 'created_at', type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    public function __construct(User $sender, User $recipient, string $message)
    {
        $this->sender = $sender;
        $this->recipient = $recipient;
        $this->message = $message;
        $this->createdAt = new \DateTimeImmutable();
        $this->messageId = $this->generateMessageId();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getSender(): User
    {
        return $this->sender;
    }

    public function getRecipient(): User
    {
        return $this->recipient;
    }

    public function getMessageId(): string
    {
        return $this->messageId;
    }

    public function getMessage(): string
    {
        return $this->message;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    private function generateMessageId(): string
    {
        try {
            return \bin2hex(random_bytes(8));
        } catch (\Throwable) {
            return uniqid('', true);
        }
    }
}
