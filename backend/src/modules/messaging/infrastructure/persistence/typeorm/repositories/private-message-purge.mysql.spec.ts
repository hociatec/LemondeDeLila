import { randomUUID } from 'node:crypto';
import { createConnection, type Connection } from 'mysql2/promise';
import { DataSource, Column, Entity, PrimaryColumn } from 'typeorm';
import { PrivateMessageEntity } from '../entities/private-message.entity';
import { PrivateMessageTypeormRepository } from './private-message-typeorm.repository';
import { AddIndependentMessagePurge1791367200000 } from '../../../../../../platform/database/migrations/1791367200000-AddIndependentMessagePurge';

// Opt-in against a dedicated MySQL test server; never use the application database.
const mysqlTests = process.env.MESSAGING_TEST_MYSQL_PORT
  ? describe
  : describe.skip;
@Entity('users')
class User {
  @PrimaryColumn() id!: number;
  @Column() username!: string;
}
mysqlTests('independent message purge (real MySQL)', () => {
  let admin: Connection;
  let source: DataSource;
  let repository: PrivateMessageTypeormRepository;
  const database = `lila_message_test_${process.pid}_${Date.now()}`;
  const connection = {
    host: '127.0.0.1',
    port: Number(process.env.MESSAGING_TEST_MYSQL_PORT),
    user: process.env.MESSAGING_TEST_MYSQL_USER || 'root',
    password: process.env.MESSAGING_TEST_MYSQL_PASSWORD || '',
  };
  beforeAll(async () => {
    admin = await createConnection(connection);
    await admin.query(`CREATE DATABASE \`${database}\``);
    source = new DataSource({
      type: 'mysql',
      ...connection,
      username: connection.user,
      database,
      entities: [PrivateMessageEntity, User],
      synchronize: true,
    });
    await source.initialize();
    await source.query(
      "INSERT INTO users (id, username) VALUES (1, 'Alice'), (2, 'Bob')",
    );
    repository = new PrivateMessageTypeormRepository(
      source.getRepository(PrivateMessageEntity),
    );
  });
  afterAll(async () => {
    if (source?.isInitialized) await source.destroy();
    if (admin) {
      await admin.query(`DROP DATABASE \`${database}\``);
      await admin.end();
    }
  });

  it('keeps the other participant’s copy, excludes every purged view and deletes only after both purges', async () => {
    const message = await repository.create({
      senderId: 1,
      recipientId: 2,
      messageId: randomUUID(),
      message: 'Bonjour',
      subject: null,
    });
    message.deletedBySenderAt = new Date();
    await repository.save(message);
    await repository.purgeForUser(message.messageId, 1);
    expect(await repository.findByMessageId(message.messageId, 1)).toBeNull();
    expect(await repository.findOutbox(1, 100)).toEqual([]);
    expect(await repository.findDeleted(1, 100)).toEqual([]);
    expect(await repository.findConversation(1, 2, 100)).toEqual([]);
    expect(await repository.findInbox(2, 100)).toHaveLength(1);
    expect(await repository.countUnreadForRecipient(2)).toBe(1);
    await expect(
      repository.purgeForUser(message.messageId, 2),
    ).rejects.toThrow();
    const other = await repository.findByMessageId(message.messageId, 2);
    expect(other).not.toBeNull();
    if (!other) throw new Error('Recipient copy missing');
    other.deletedByRecipientAt = new Date();
    await repository.save(other);
    expect(await repository.findDeleted(2, 100)).toHaveLength(1);
    await repository.purgeForUser(message.messageId, 2);
    expect(await source.getRepository(PrivateMessageEntity).count()).toBe(0);
    await expect(repository.save(other)).rejects.toThrow();
    expect(await source.getRepository(PrivateMessageEntity).count()).toBe(0);
  });

  it('upgrades existing data idempotently and refuses a rollback that would resurrect a purged copy', async () => {
    const message = await repository.create({
      senderId: 1,
      recipientId: 2,
      messageId: randomUUID(),
      message: 'Avant migration',
      subject: null,
    });
    const runner = source.createQueryRunner();
    await runner.connect();
    try {
      await runner.query(
        'ALTER TABLE messaging_private_messages DROP COLUMN purged_by_sender_at, DROP COLUMN purged_by_recipient_at',
      );
      const migration = new AddIndependentMessagePurge1791367200000();
      await migration.up(runner);
      await migration.up(runner);
      expect((await repository.findInbox(2, 100))[0].message).toBe(
        'Avant migration',
      );
      message.deletedByRecipientAt = new Date();
      await repository.save(message);
      await repository.purgeForUser(message.messageId, 2);
      await expect(migration.down(runner)).rejects.toThrow('prevent rollback');
      expect(await repository.findByMessageId(message.messageId, 2)).toBeNull();
      expect(
        await repository.findByMessageId(message.messageId, 1),
      ).not.toBeNull();
    } finally {
      await runner.release();
    }
  });
});
