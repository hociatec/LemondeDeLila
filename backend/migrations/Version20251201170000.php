<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20251201170000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Ensure unique bot names per room (room_id, name)';
    }

    public function up(Schema $schema): void
    {
        if (!$schema->hasTable('room_bot')) {
            return;
        }

        $table = $schema->getTable('room_bot');
        if ($table->hasIndex('uniq_room_bot_room_name')) {
            return;
        }

        // Deduplicate existing rows to allow the unique index creation.
        $this->addSql(<<<'SQL'
DELETE rb FROM room_bot rb
INNER JOIN (
    SELECT room_id, name, MIN(id) AS keep_id
    FROM room_bot
    GROUP BY room_id, name
    HAVING COUNT(*) > 1
) dup ON dup.room_id = rb.room_id AND dup.name = rb.name AND rb.id <> dup.keep_id
SQL);

        $this->addSql('CREATE UNIQUE INDEX uniq_room_bot_room_name ON room_bot (room_id, name)');
    }

    public function down(Schema $schema): void
    {
        if (!$schema->hasTable('room_bot')) {
            return;
        }

        $table = $schema->getTable('room_bot');
        if ($table->hasIndex('uniq_room_bot_room_name')) {
            $this->addSql('DROP INDEX uniq_room_bot_room_name ON room_bot');
        }
    }
}
