<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20251030200000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Catalog tables: catalog_category, catalog_game';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("CREATE TABLE catalog_category (id INT AUTO_INCREMENT NOT NULL, code VARCHAR(80) NOT NULL, name VARCHAR(120) NOT NULL, UNIQUE INDEX UNIQ_CAT_CODE (code), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB");
        $this->addSql("CREATE TABLE catalog_game (id INT AUTO_INCREMENT NOT NULL, category_id INT NOT NULL, code VARCHAR(80) NOT NULL, name VARCHAR(120) NOT NULL, min_players SMALLINT NOT NULL, max_players SMALLINT NOT NULL, enabled TINYINT(1) NOT NULL, UNIQUE INDEX UNIQ_GAME_CODE (code), INDEX IDX_GAME_CATEGORY (category_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB");
        $this->addSql("ALTER TABLE catalog_game ADD CONSTRAINT FK_GAME_CATEGORY FOREIGN KEY (category_id) REFERENCES catalog_category (id) ON DELETE CASCADE");
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE catalog_game DROP FOREIGN KEY FK_GAME_CATEGORY');
        $this->addSql('DROP TABLE catalog_game');
        $this->addSql('DROP TABLE catalog_category');
    }
}

