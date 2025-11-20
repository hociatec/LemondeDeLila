<?php

namespace App\Module\Game\Entity;

use App\Module\Game\Repository\GameStatRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: GameStatRepository::class)]
#[ORM\Table(name: 'game_stat')]
#[ORM\UniqueConstraint(name: 'uniq_game_stat_game_type', columns: ['game_type'])]
class GameStat
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    private ?int $id = null;

    #[ORM\Column(type: 'string', length: 50)]
    private string $gameType;

    #[ORM\Column(type: 'json')]
    private array $data = [];

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $updatedAt;

    public function __construct()
    {
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function getId(): ?int { return $this->id; }
    public function getGameType(): string { return $this->gameType; }
    public function setGameType(string $type): self { $this->gameType = $type; return $this; }
    public function getData(): array { return $this->data; }
    public function setData(array $data): self { $this->data = $data; $this->updatedAt = new \DateTimeImmutable(); return $this; }
    public function getUpdatedAt(): \DateTimeImmutable { return $this->updatedAt; }
}
