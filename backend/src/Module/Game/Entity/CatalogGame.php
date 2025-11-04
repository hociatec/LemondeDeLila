<?php

namespace App\Module\Game\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use App\Module\Game\Repository\CatalogGameRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Entity(repositoryClass: CatalogGameRepository::class)]
#[ORM\Table(name: 'catalog_game')]
#[ApiResource(
    operations: [
        new GetCollection(security: "is_granted('ROLE_USER')"),
        new Get(security: "is_granted('ROLE_USER')")
    ],
    normalizationContext: ['groups' => ['catalog:read']]
)]
class CatalogGame
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    #[Groups(['catalog:read'])]
    private ?int $id = null;

    #[ORM\Column(type: 'string', length: 80, unique: true)]
    #[Groups(['catalog:read'])]
    private string $code;

    #[ORM\Column(type: 'string', length: 120)]
    #[Groups(['catalog:read'])]
    private string $name;

    #[ORM\Column(type: 'smallint')]
    #[Groups(['catalog:read'])]
    private int $minPlayers = 1;

    #[ORM\Column(type: 'smallint')]
    #[Groups(['catalog:read'])]
    private int $maxPlayers = 4;

    #[ORM\Column(type: 'boolean')]
    #[Groups(['catalog:read'])]
    private bool $enabled = true;

    #[ORM\Column(type: 'string', length: 80, nullable: true)]
    #[Groups(['catalog:read'])]
    private ?string $engine = null;

    public function getId(): ?int { return $this->id; }
    public function getCode(): string { return $this->code; }
    public function setCode(string $code): self { $this->code = $code; return $this; }
    public function getName(): string { return $this->name; }
    public function setName(string $name): self { $this->name = $name; return $this; }
    public function getMinPlayers(): int { return $this->minPlayers; }
    public function setMinPlayers(int $v): self { $this->minPlayers = $v; return $this; }
    public function getMaxPlayers(): int { return $this->maxPlayers; }
    public function setMaxPlayers(int $v): self { $this->maxPlayers = $v; return $this; }
    public function isEnabled(): bool { return $this->enabled; }
    public function setEnabled(bool $e): self { $this->enabled = $e; return $this; }
    public function getEngine(): ?string { return $this->engine; }
    public function setEngine(?string $e): self { $this->engine = $e; return $this; }
}
