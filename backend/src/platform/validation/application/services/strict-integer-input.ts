import { Transform } from 'class-transformer';
import { parseStrictInteger } from '../../../../shared/utils/public-api';

/** Preserve omission/null policy; invalid values must still fail IsInt. */
export function StrictIntegerInput(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) =>
    value == null ? value : (parseStrictInteger(value) ?? NaN),
  );
}
