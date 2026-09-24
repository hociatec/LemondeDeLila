import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  ADMIN_NOTIFICATION_PORT,
  type AdminNotificationPort,
} from '../../ports/admin-notification.port';
import {
  ADMIN_BUG_REPORTS_PORT,
  type AdminBugReportsPort,
} from '../../ports/admin-bug-reports.port';
import { serializeDate } from '../../../../../shared/utils/public-api';

@Injectable()
export class AdminBugReportCommentsService {
  private readonly logger = new Logger(AdminBugReportCommentsService.name);
  constructor(
    @Inject(ADMIN_BUG_REPORTS_PORT)
    private readonly bugReports: AdminBugReportsPort,
    @Inject(ADMIN_NOTIFICATION_PORT)
    private readonly notifications: AdminNotificationPort,
  ) {}

  async list(
    reportId: string,
    options: { offset?: number; limit?: number } = {},
  ) {
    assertReportId(reportId);
    const comments = await this.bugReports.listComments(reportId, {
      offset: boundedInteger(options.offset, 0, 10_000_000, 0),
      limit: boundedInteger(options.limit, 1, 100, 50),
    });
    return comments.map(serializeComment);
  }

  async add(input: {
    reportId: string;
    content: string;
    createdByUserId: number;
    createdByUsername: string;
  }) {
    const reportId = input.reportId.trim();
    assertReportId(reportId);
    assertText(input.content, 20_000, 'Contenu invalide');
    assertUserId(input.createdByUserId);
    assertText(input.createdByUsername, 100, "Nom d'utilisateur invalide");
    const comment = await this.bugReports.addComment({
      reportId,
      content: input.content,
      createdByUserId: input.createdByUserId,
      createdByUsername: input.createdByUsername,
    });

    if (!comment) {
      throw new BadRequestException('Rapport introuvable');
    }

    const counts = await this.bugReports.countComments([reportId]);
    // Persistence succeeded: notification failure must not turn a saved comment
    // into a failed command that the user could submit a second time.
    try {
      const report = await this.bugReports.get(reportId);
      if (report && report.createdByUserId !== input.createdByUserId) {
        await this.notifications.notifyUser(
          report.createdByUserId,
          'bugReports.comment.added',
          {
            reportId,
            commentId: comment.id,
            createdByUserId: input.createdByUserId,
          },
        );
      }
    } catch {
      this.logger.warn('Bug report comment notification unavailable');
    }
    return {
      comment: serializeComment(comment),
      reportId,
      commentsCount: counts[reportId] ?? 0,
    };
  }
}

function serializeComment<T extends { createdAt: unknown }>(comment: T) {
  return { ...comment, createdAt: serializeDate(comment.createdAt) };
}

function assertReportId(value: unknown): asserts value is string {
  if (
    typeof value !== 'string' ||
    !/^[A-Za-z0-9_-]{1,64}$/.test(value.trim())
  ) {
    throw new BadRequestException('Identifiant de rapport invalide');
  }
}

function assertUserId(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new BadRequestException('Identifiant utilisateur invalide');
  }
}

function assertText(
  value: unknown,
  max: number,
  message: string,
): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new BadRequestException(message);
  }
}

function boundedInteger(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (value === undefined) return fallback;
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < min ||
    (value as number) > max
  ) {
    throw new BadRequestException('Paramètre numérique invalide');
  }
  return value as number;
}
