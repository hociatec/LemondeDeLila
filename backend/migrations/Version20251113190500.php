<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20251113190500 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add deletion timestamps to private messages';
    }

    public function up(Schema $schema): void
    {
        if (!$schema->hasTable('messaging_private_messages')) {
            return;
        }

        $table = $schema->getTable('messaging_private_messages');
        if (!$table->hasColumn('deleted_by_sender_at')) {
            $this->addSql("ALTER TABLE messaging_private_messages ADD deleted_by_sender_at DATETIME DEFAULT NULL COMMENT '(DC2Type:datetime_immutable)'");
        }
        if (!$table->hasColumn('deleted_by_recipient_at')) {
            $this->addSql("ALTER TABLE messaging_private_messages ADD deleted_by_recipient_at DATETIME DEFAULT NULL COMMENT '(DC2Type:datetime_immutable)'");
        }
    }

    public function down(Schema $schema): void
    {
        if (!$schema->hasTable('messaging_private_messages')) {
            return;
        }
        $table = $schema->getTable('messaging_private_messages');
        if ($table->hasColumn('deleted_by_sender_at')) {
            $this->addSql('ALTER TABLE messaging_private_messages DROP deleted_by_sender_at');
        }
        if ($table->hasColumn('deleted_by_recipient_at')) {
            $this->addSql('ALTER TABLE messaging_private_messages DROP deleted_by_recipient_at');
        }
    }
}
