<?php

namespace App\Module\Game\Entity;

use App\Module\Game\Repository\RoomParticipantRepository;
use App\Module\User\Entity\User;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: RoomParticipantRepository::class)]
#[ORM\Table(name: 'room_participant')]
class RoomParticipant
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Room::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Room $room;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\Column(type: 'string', length: 20)]
    private string $role = 'player'; // 'player' | 'spectator'

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $joinedAt;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $leftAt = null;

    public function __construct()
    {
        $this->joinedAt = new \DateTimeImmutable();
    }

    public function getId(): ?int { return $this->id; }
    public function getRoom(): Room { return $this->room; }
    public function setRoom(Room $room): self { $this->room = $room; return $this; }
    public function getUser(): User { return $this->user; }
    public function setUser(User $user): self { $this->user = $user; return $this; }
    public function getRole(): string { return $this->role; }
    public function setRole(string $role): self { $this->role = $role; return $this; }
    public function getJoinedAt(): \DateTimeImmutable { return $this->joinedAt; }
    public function getLeftAt(): ?\DateTimeImmutable { return $this->leftAt; }
    public function leave(): self { $this->leftAt = new \DateTimeImmutable(); return $this; }
}

