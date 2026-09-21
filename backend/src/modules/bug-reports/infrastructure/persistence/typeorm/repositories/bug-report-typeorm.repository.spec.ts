import { DataSource } from 'typeorm';
import { BugReportEntity } from '../entities/bug-report.entity';
import { BugReportTypeormRepository } from './bug-report-typeorm.repository';

class MetadataDataSource extends DataSource {
  prepare() {
    return this.buildMetadatas();
  }
}

it('bounds status groups without truncating counts and includes legacy rejected reports', async () => {
  const source = new MetadataDataSource({
    type: 'mysql',
    database: 'test',
    entities: [BugReportEntity],
  });
  await source.prepare();
  const reports = source.getRepository(BugReportEntity);
  const query = reports.createQueryBuilder('report');
  jest.spyOn(reports, 'createQueryBuilder').mockReturnValue(query);
  jest.spyOn(query, 'getRawMany').mockResolvedValue([
    { status: 'pending', count: '250000' },
    { status: 'refused', count: '1200' },
  ]);

  const counts = await new BugReportTypeormRepository(reports).countByStatus();
  expect(counts).toEqual({
    pending: 250000,
    in_progress: 0,
    to_test: 0,
    done: 0,
    refused: 1200,
    rejected: 0,
  });
  const [sql, parameters] = query.getQueryAndParameters();
  expect(parameters).toEqual([
    'pending',
    'in_progress',
    'to_test',
    'done',
    'refused',
    'rejected',
  ]);
  expect(sql).toContain('COUNT(*)');
  expect(sql).toContain(
    "CASE WHEN `report`.`status` = 'rejected' THEN 'refused' ELSE `report`.`status` END",
  );
  expect(sql).toContain('WHERE `report`.`status` IN (?, ?, ?, ?, ?, ?)');
  expect(sql).toMatch(/GROUP BY .+ LIMIT 6$/);
});
