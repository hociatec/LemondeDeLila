<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20251101020000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create chat messages table';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("CREATE TABLE chat_messages (id INT AUTO_INCREMENT NOT NULL, user_id INT NOT NULL, message_id VARCHAR(36) NOT NULL, message LONGTEXT NOT NULL, created_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)', INDEX IDX_CHAT_MESSAGES_USER (user_id), INDEX idx_chat_messages_created_at (created_at), UNIQUE INDEX uniq_chat_messages_message_id (message_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB");
        $this->addSql('ALTER TABLE chat_messages ADD CONSTRAINT FK_CHAT_MESSAGES_USER FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE chat_messages DROP FOREIGN KEY FK_CHAT_MESSAGES_USER');
        $this->addSql('DROP TABLE chat_messages');
    }
}
