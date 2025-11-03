<?php

namespace App\Module\Game\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use App\Module\Game\Repository\CatalogCategoryRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Entity(repositoryClass: CatalogCategoryRepository::class)]
#[ORM\Table(name: 'catalog_category')]
#[ApiResource(
    operations: [
        new GetCollection(security: "is_granted('ROLE_USER')"),
        new Get(security: "is_granted('ROLE_USER')")
    ],
    normalizationContext: ['groups' => ['catalog:read']]
)]
class CatalogCategory
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

    #[ORM\OneToMany(mappedBy: 'category', targetEntity: CatalogGame::class, cascade: ['persist', 'remove'])]
    #[Groups(['catalog:read'])]
    private Collection $games;

    public function __construct()
    {
        $this->games = new ArrayCollection();
    }

    public function getId(): ?int { return $this->id; }
    public function getCode(): string { return $this->code; }
    public function setCode(string $code): self { $this->code = $code; return $this; }
    public function getName(): string { return $this->name; }
    public function setName(string $name): self { $this->name = $name; return $this; }
    public function getGames(): Collection { return $this->games; }
}
