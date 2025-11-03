<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20251031001000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add unique index on users.username';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE UNIQUE INDEX uniq_user_username ON users (username)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX uniq_user_username ON users');
    }
}

