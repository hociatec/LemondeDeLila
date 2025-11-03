<?php

namespace App\Module\Game\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use App\Module\Game\Repository\GameRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Entity(repositoryClass: GameRepository::class)]
#[ApiResource(
    operations: [
        new GetCollection(security: "is_granted('ROLE_USER')"),
        new Get(security: "is_granted('ROLE_USER')")
    ],
    normalizationContext: ['groups' => ['game:read']]
)]
class Game
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    #[Groups(['game:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Room::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['game:read'])]
    private Room $room;

    #[ORM\Column(type: 'json')]
    #[Groups(['game:read'])]
    private array $state = [];

    #[ORM\Column(type: 'smallint', options: ['default' => 0])]
    #[Groups(['game:read'])]
    private int $currentRound = 0;

    #[ORM\Column(type: 'json', nullable: true)]
    #[Groups(['game:read'])]
    private ?array $meta = null;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    #[Groups(['game:read'])]
    private ?\DateTimeImmutable $startedAt = null;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    #[Groups(['game:read'])]
    private ?\DateTimeImmutable $endedAt = null;

    public function getId(): ?int { return $this->id; }
    public function getRoom(): Room { return $this->room; }
    public function setRoom(Room $room): self { $this->room = $room; return $this; }
    public function getState(): array { return $this->state; }
    public function setState(array $state): self { $this->state = $state; return $this; }
    public function getCurrentRound(): int { return $this->currentRound; }
    public function setCurrentRound(int $round): self { $this->currentRound = $round; return $this; }
    public function getMeta(): ?array { return $this->meta; }
    public function setMeta(?array $meta): self { $this->meta = $meta; return $this; }
    public function getStartedAt(): ?\DateTimeImmutable { return $this->startedAt; }
    public function setStartedAt(?\DateTimeImmutable $dt): self { $this->startedAt = $dt; return $this; }
    public function getEndedAt(): ?\DateTimeImmutable { return $this->endedAt; }
    public function setEndedAt(?\DateTimeImmutable $dt): self { $this->endedAt = $dt; return $this; }
}
