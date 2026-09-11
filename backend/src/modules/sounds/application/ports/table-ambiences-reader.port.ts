import type { TableAmbienceDefinitionsFile } from '../read-models/sound-manifest.record';

export const TABLE_AMBIENCES_READER = Symbol('TABLE_AMBIENCES_READER');
export interface TableAmbiencesReader {
  listTableAmbiencesWithFilter(): Promise<TableAmbienceDefinitionsFile>;
}
