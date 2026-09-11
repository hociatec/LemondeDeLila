import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UserListDto } from '../../../../modules/user/infrastructure/presentation/ws/dto/user-get.dto';
import { AdminListUsersDto } from '../../../../modules/admin/infrastructure/presentation/http/dto/admin-list-users.dto';
import { AdminBugReportsListWsDto } from '../../../../modules/admin/infrastructure/presentation/ws/dto/admin-bug-reports.ws.dto';
import { AdminBugReportCommentsListWsDto } from '../../../../modules/admin/infrastructure/presentation/ws/dto/admin-bug-report-comments.ws.dto';

const lists: Array<{
  name: string;
  dto: new () => object;
  seed: Record<string, unknown>;
}> = [
  { name: 'users', dto: UserListDto, seed: {} },
  { name: 'admin users', dto: AdminListUsersDto, seed: {} },
  { name: 'bug reports', dto: AdminBugReportsListWsDto, seed: {} },
  {
    name: 'bug comments',
    dto: AdminBugReportCommentsListWsDto,
    seed: { reportId: 'report-1' },
  },
];

it.each(lists)(
  '$name accepts decimal query limits and rejects coercion or overflow',
  ({ dto, seed }) => {
    expect(validateSync(plainToInstance(dto, seed))).toEqual([]);
    const valid = plainToInstance(dto, { ...seed, limit: '25' });
    expect(validateSync(valid)).toEqual([]);
    expect(valid).toHaveProperty('limit', 25);
    for (const limit of [
      true,
      false,
      [],
      [2],
      '2x',
      '1e2',
      '0x10',
      '1.5',
      1.5,
      '',
      NaN,
      Infinity,
      0,
      101,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      expect(
        validateSync(plainToInstance(dto, { ...seed, limit })).length,
      ).toBeGreaterThan(0);
    }
  },
);
