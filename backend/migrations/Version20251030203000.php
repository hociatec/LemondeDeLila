<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20251030203000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add engine column to catalog_game';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("ALTER TABLE catalog_game ADD engine VARCHAR(80) DEFAULT NULL");
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE catalog_game DROP engine');
    }
}

