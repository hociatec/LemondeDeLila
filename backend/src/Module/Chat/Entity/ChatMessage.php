<?php

namespace App\Module\Chat\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\GetCollection;
use App\Module\Chat\Controller\ChatMessagesController;
use App\Module\Chat\Repository\ChatMessageRepository;
use App\Module\User\Entity\User;
use Doctrine\ORM\Mapping as ORM;

#[ApiResource(
    operations: [
        new GetCollection(
            uriTemplate: '/chat/messages',
            controller: ChatMessagesController::class,
            read: false,
            output: false,
            paginationEnabled: false,
            name: 'chat_messages_recent',
        ),
    ],
    security: "is_granted('ROLE_USER')"
)]
#[ORM\Entity(repositoryClass: ChatMessageRepository::class)]
#[ORM\Table(name: 'chat_messages')]
#[ORM\Index(columns: ['created_at'], name: 'idx_chat_messages_created_at')]
#[ORM\UniqueConstraint(name: 'uniq_chat_messages_message_id', columns: ['message_id'])]
class ChatMessage
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'user_id', nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\Column(name: 'message_id', type: 'string', length: 36)]
    private string $messageId;

    #[ORM\Column(type: 'text')]
    private string $message;

    #[ORM\Column(name: 'created_at', type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    public function __construct(User $user, string $message)
    {
        $this->user = $user;
        $this->message = $message;
        $this->createdAt = new \DateTimeImmutable();
        $this->messageId = $this->generateMessageId();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getUser(): User
    {
        return $this->user;
    }

    public function getMessageId(): string
    {
        return $this->messageId;
    }

    public function getMessage(): string
    {
        return $this->message;
    }

    public function setMessage(string $message): self
    {
        $this->message = $message;
        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    private function generateMessageId(): string
    {
        try {
            return bin2hex(random_bytes(8));
        } catch (\Throwable) {
            return uniqid('', true);
        }
    }
}
