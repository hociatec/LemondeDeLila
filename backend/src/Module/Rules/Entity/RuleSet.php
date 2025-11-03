<?php

namespace App\Module\Rules\Entity;

use App\Module\Rules\Repository\RuleSetRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: RuleSetRepository::class)]
class RuleSet
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    private ?int $id = null;

    #[ORM\Column(type: 'string', length: 100)]
    private string $gameId;

    #[ORM\Column(type: 'json')]
    private array $data = [];

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $updatedAt;

    public function __construct()
    {
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function getId(): ?int { return $this->id; }
    public function getGameId(): string { return $this->gameId; }
    public function setGameId(string $gameId): self { $this->gameId = $gameId; return $this; }
    public function getData(): array { return $this->data; }
    public function setData(array $data): self { $this->data = $data; $this->updatedAt = new \DateTimeImmutable(); return $this; }
    public function getUpdatedAt(): \DateTimeImmutable { return $this->updatedAt; }
}

