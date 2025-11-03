<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20251030190000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add participants, snapshots, stats; extend game with current_round and meta';
    }

    public function up(Schema $schema): void
    {
        // Extend game table
        $this->addSql("ALTER TABLE game ADD current_round SMALLINT NOT NULL DEFAULT 0, ADD meta JSON DEFAULT NULL");

        // Room participants
        $this->addSql("CREATE TABLE room_participant (id INT AUTO_INCREMENT NOT NULL, room_id INT NOT NULL, user_id INT NOT NULL, role VARCHAR(20) NOT NULL, joined_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)', left_at DATETIME DEFAULT NULL COMMENT '(DC2Type:datetime_immutable)', INDEX IDX_RP_ROOM (room_id), INDEX IDX_RP_USER (user_id), INDEX IDX_RP_ROLE (role), INDEX IDX_RP_ACTIVE (left_at), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB");
        $this->addSql("ALTER TABLE room_participant ADD CONSTRAINT FK_RP_ROOM FOREIGN KEY (room_id) REFERENCES room (id) ON DELETE CASCADE");
        $this->addSql("ALTER TABLE room_participant ADD CONSTRAINT FK_RP_USER FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE");

        // Table snapshots
        $this->addSql("CREATE TABLE table_snapshot (id INT AUTO_INCREMENT NOT NULL, room_id INT NOT NULL, created_by_id INT DEFAULT NULL, label VARCHAR(120) DEFAULT NULL, state JSON NOT NULL, created_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)', INDEX IDX_TS_ROOM (room_id), INDEX IDX_TS_CREATED_BY (created_by_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB");
        $this->addSql("ALTER TABLE table_snapshot ADD CONSTRAINT FK_TS_ROOM FOREIGN KEY (room_id) REFERENCES room (id) ON DELETE CASCADE");
        $this->addSql("ALTER TABLE table_snapshot ADD CONSTRAINT FK_TS_CREATED_BY FOREIGN KEY (created_by_id) REFERENCES users (id) ON DELETE SET NULL");

        // Game stats
        $this->addSql("CREATE TABLE game_stat (id INT AUTO_INCREMENT NOT NULL, game_type VARCHAR(50) NOT NULL, data JSON NOT NULL, updated_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)', UNIQUE INDEX uniq_game_stat_game_type (game_type), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB");
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE room_participant');
        $this->addSql('DROP TABLE table_snapshot');
        $this->addSql('DROP TABLE game_stat');
        $this->addSql('ALTER TABLE game DROP current_round, DROP meta');
    }
}

