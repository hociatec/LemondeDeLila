<?php

namespace App\Module\Game\Entity;

use App\Module\Game\Repository\TableSnapshotRepository;
use App\Module\User\Entity\User;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: TableSnapshotRepository::class)]
#[ORM\Table(name: 'table_snapshot')]
class TableSnapshot
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Room::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Room $room;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $createdBy = null;

    #[ORM\Column(type: 'string', length: 120, nullable: true)]
    private ?string $label = null;

    #[ORM\Column(type: 'json')]
    private array $state = [];

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int { return $this->id; }
    public function getRoom(): Room { return $this->room; }
    public function setRoom(Room $room): self { $this->room = $room; return $this; }
    public function getCreatedBy(): ?User { return $this->createdBy; }
    public function setCreatedBy(?User $user): self { $this->createdBy = $user; return $this; }
    public function getLabel(): ?string { return $this->label; }
    public function setLabel(?string $label): self { $this->label = $label; return $this; }
    public function getState(): array { return $this->state; }
    public function setState(array $state): self { $this->state = $state; return $this; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
}

