<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Create missing room_bot table used to store AI participants.
 */
final class Version20251120093000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create room_bot table for game bots';
    }

    public function up(Schema $schema): void
    {
        if ($schema->hasTable('room_bot')) {
            return;
        }

        $this->addSql(<<<'SQL'
CREATE TABLE room_bot (
    id INT AUTO_INCREMENT NOT NULL,
    room_id INT NOT NULL,
    name VARCHAR(80) NOT NULL,
    created_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)',
    INDEX idx_room_bot_room (room_id),
    INDEX idx_room_bot_created_at (created_at),
    PRIMARY KEY(id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
SQL);

        $this->addSql(<<<'SQL'
ALTER TABLE room_bot
    ADD CONSTRAINT fk_room_bot_room
        FOREIGN KEY (room_id) REFERENCES room (id) ON DELETE CASCADE
SQL);
    }

    public function down(Schema $schema): void
    {
        if (!$schema->hasTable('room_bot')) {
            return;
        }

        $this->addSql('ALTER TABLE room_bot DROP FOREIGN KEY fk_room_bot_room');
        $this->addSql('DROP TABLE room_bot');
    }
}
