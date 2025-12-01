<?php

namespace App\Module\Game\Service;

use App\Module\User\Entity\User;

final class Participant
{
    public function __construct(
        private readonly int $id,
        private readonly string $username,
        private readonly bool $bot,
        private readonly ?User $user = null,
    ) {
    }

    public function id(): int
    {
        return $this->id;
    }

    public function username(): string
    {
        return $this->username;
    }

    public function isBot(): bool
    {
        return $this->bot;
    }

    public function user(): ?User
    {
        return $this->user;
    }
}
