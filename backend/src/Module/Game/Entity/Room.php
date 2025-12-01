<?php

namespace App\Module\Game\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Post;
use App\Module\Game\Repository\RoomRepository;
use App\Module\Game\Entity\RoomBot;
use App\Module\User\Entity\User;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Entity(repositoryClass: RoomRepository::class)]
#[ApiResource(
    operations: [
        new GetCollection(security: "is_granted('ROLE_USER')"),
        new Get(security: "is_granted('ROLE_USER')"),
        new Post(
            uriTemplate: '/rooms',
            routeName: 'rooms_create',
            security: "is_granted('ROLE_USER')",
            deserialize: false,
            name: 'rooms_create_operation',
            extraProperties: [
                'openapi_context' => [
                    'summary' => 'Creer une salle',
                    'description' => 'Cree une nouvelle salle de jeu et y inscrit le createur.',
                    'tags' => ['Rooms']
                ]
            ]
        ),
        new Post(
            uriTemplate: '/rooms/{id}/join',
            routeName: 'rooms_join',
            security: "is_granted('ROLE_USER')",
            deserialize: false,
            name: 'rooms_join_operation',
            extraProperties: [
                'openapi_context' => [
                    'summary' => 'Rejoindre une salle',
                    'tags' => ['Rooms']
                ]
            ]
        ),
        new Post(
            uriTemplate: '/rooms/{id}/leave',
            routeName: 'rooms_leave',
            security: "is_granted('ROLE_USER')",
            deserialize: false,
            name: 'rooms_leave_operation',
            extraProperties: [
                'openapi_context' => [
                    'summary' => 'Quitter une salle',
                    'tags' => ['Rooms']
                ]
            ]
        ),
        new Post(
            uriTemplate: '/rooms/{id}/spectate',
            routeName: 'rooms_spectate',
            security: "is_granted('ROLE_USER')",
            deserialize: false,
            name: 'rooms_spectate_operation',
            extraProperties: [
                'openapi_context' => [
                    'summary' => 'Observer une salle',
                    'tags' => ['Rooms']
                ]
            ]
        ),
        new Post(
            uriTemplate: '/rooms/{id}/unspectate',
            routeName: 'rooms_unspectate',
            security: "is_granted('ROLE_USER')",
            deserialize: false,
            name: 'rooms_unspectate_operation',
            extraProperties: [
                'openapi_context' => [
                    'summary' => 'Arreter dobserver une salle',
                    'tags' => ['Rooms']
                ]
            ]
        ),
        new Post(
            uriTemplate: '/rooms/{id}/start',
            routeName: 'rooms_start',
            security: "is_granted('ROLE_USER')",
            deserialize: false,
            name: 'rooms_start_operation',
            extraProperties: [
                'openapi_context' => [
                    'summary' => 'Demarrer une partie',
                    'tags' => ['Rooms']
                ]
            ]
        ),
        new Post(
            uriTemplate: '/rooms/{id}/snapshot',
            routeName: 'rooms_snapshot',
            security: "is_granted('ROLE_USER')",
            deserialize: false,
            name: 'rooms_snapshot_operation',
            extraProperties: [
                'openapi_context' => [
                    'summary' => 'Creer un snapshot de table',
                    'tags' => ['Rooms']
                ]
            ]
        ),
        new GetCollection(
            uriTemplate: '/rooms/{id}/snapshots',
            routeName: 'rooms_snapshots',
            security: "is_granted('ROLE_USER')",
            read: false,
            deserialize: false,
            name: 'rooms_snapshots_operation',
            extraProperties: [
                'openapi_context' => [
                    'summary' => 'Lister les snapshots dune salle',
                    'tags' => ['Rooms']
                ]
            ]
        ),
        new Post(
            uriTemplate: '/rooms/{id}/restore/{snapshotId}',
            routeName: 'rooms_restore_snapshot',
            security: "is_granted('ROLE_USER')",
            deserialize: false,
            name: 'rooms_restore_snapshot_operation',
            extraProperties: [
                'openapi_context' => [
                    'summary' => 'Restaurer un snapshot',
                    'tags' => ['Rooms']
                ]
            ]
        ),
        new Delete(
            uriTemplate: '/rooms/{id}',
            routeName: 'rooms_delete',
            security: "is_granted('ROLE_USER')",
            name: 'rooms_delete_operation',
            extraProperties: [
                'openapi_context' => [
                    'summary' => 'Supprimer une salle',
                    'tags' => ['Rooms']
                ]
            ]
        )
    ],
    normalizationContext: ['groups' => ['room:read']]
)]
class Room
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    #[Groups(['room:read', 'game:read'])]
    private ?int $id = null;

    #[ORM\Column(type: 'string', length: 120)]
    #[Groups(['room:read'])]
    private string $name;

    #[ORM\Column(type: 'boolean')]
    #[Groups(['room:read'])]
    private bool $isPrivate = false;

    #[ORM\Column(type: 'smallint')]
    #[Groups(['room:read'])]
    private int $maxPlayers = 4;

    #[ORM\ManyToOne(targetEntity: \App\Module\User\Entity\User::class)]
    #[Groups(['room:read'])]
    private ?User $owner = null;

    #[ORM\ManyToMany(targetEntity: \App\Module\User\Entity\User::class)]
    #[ORM\JoinTable(name: 'room_players')]
    #[Groups(['room:read'])]
    private Collection $players;

    #[ORM\OneToMany(mappedBy: 'room', targetEntity: RoomBot::class, cascade: ['persist', 'remove'], orphanRemoval: true)]
    #[Groups(['room:read'])]
    private Collection $bots;

    #[ORM\Column(type: 'string', length: 50)]
    #[Groups(['room:read'])]
    private string $status = 'setup';

    #[ORM\Column(type: 'string', length: 50)]
    #[Groups(['room:read'])]
    private string $gameType = 'tictactoe';

    #[ORM\Column(type: 'datetime_immutable')]
    #[Groups(['room:read'])]
    private \DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->players = new ArrayCollection();
        $this->bots = new ArrayCollection();
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int { return $this->id; }
    public function getName(): string { return $this->name; }
    public function setName(string $name): self { $this->name = $name; return $this; }
    public function isPrivate(): bool { return $this->isPrivate; }
    public function setIsPrivate(bool $isPrivate): self { $this->isPrivate = $isPrivate; return $this; }
    public function getMaxPlayers(): int { return $this->maxPlayers; }
    public function setMaxPlayers(int $maxPlayers): self { $this->maxPlayers = $maxPlayers; return $this; }
    public function getOwner(): ?User { return $this->owner; }
    public function setOwner(?User $owner): self { $this->owner = $owner; return $this; }
    public function getPlayers(): Collection { return $this->players; }
    public function addPlayer(User $user): self { if(!$this->players->contains($user)){ $this->players->add($user);} return $this; }
    public function removePlayer(User $user): self { $this->players->removeElement($user); return $this; }

    /**
     * @return Collection<int, RoomBot>
     */
    public function getBots(): Collection
    {
        return $this->bots;
    }

    public function addBot(RoomBot $bot): self
    {
        $incoming = $this->normalizeBotName($bot->getName());
        foreach ($this->bots as $existing) {
            if ($this->normalizeBotName($existing->getName()) === $incoming) {
                return $this;
            }
        }
        $bot->setRoom($this);
        $this->bots->add($bot);
        return $this;
    }

    public function removeBot(RoomBot $bot): self
    {
        $this->bots->removeElement($bot);
        return $this;
    }
    public function getStatus(): string { return $this->status; }
    public function setStatus(string $status): self { $this->status = $status; return $this; }
    public function getGameType(): string { return $this->gameType; }
    public function setGameType(string $gameType): self { $this->gameType = $gameType; return $this; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }

    private function normalizeBotName(string $name): string
    {
        return strtolower(trim($name));
    }
}
