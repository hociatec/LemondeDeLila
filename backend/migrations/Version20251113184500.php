<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20251113184500 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create messaging_private_messages table for private messaging';
    }

    public function up(Schema $schema): void
    {
        if ($schema->hasTable('messaging_private_messages')) {
            return;
        }

        $this->addSql(<<<'SQL'
CREATE TABLE messaging_private_messages (
    id INT AUTO_INCREMENT NOT NULL,
    sender_id INT NOT NULL,
    recipient_id INT NOT NULL,
    message_id VARCHAR(36) NOT NULL,
    message LONGTEXT NOT NULL,
    created_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)',
    INDEX idx_messaging_private_messages_created_at (created_at),
    INDEX idx_messaging_private_messages_sender (sender_id),
    INDEX idx_messaging_private_messages_recipient (recipient_id),
    UNIQUE INDEX uniq_messaging_private_messages_message_id (message_id),
    PRIMARY KEY(id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
SQL);

        $this->addSql(<<<'SQL'
ALTER TABLE messaging_private_messages
    ADD CONSTRAINT fk_messaging_private_messages_sender
        FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE
SQL);

        $this->addSql(<<<'SQL'
ALTER TABLE messaging_private_messages
    ADD CONSTRAINT fk_messaging_private_messages_recipient
        FOREIGN KEY (recipient_id) REFERENCES users (id) ON DELETE CASCADE
SQL);
    }

    public function down(Schema $schema): void
    {
        if (!$schema->hasTable('messaging_private_messages')) {
            return;
        }

        $this->addSql('ALTER TABLE messaging_private_messages DROP FOREIGN KEY fk_messaging_private_messages_sender');
        $this->addSql('ALTER TABLE messaging_private_messages DROP FOREIGN KEY fk_messaging_private_messages_recipient');
        $this->addSql('DROP TABLE messaging_private_messages');
    }
}
