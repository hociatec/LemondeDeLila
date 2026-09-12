import {
  type AuthorSchema,
  authorArray as array,
  authorObject as object,
} from '../contracts/json-author-schema';

const version: AuthorSchema = {
  type: 'string',
  minLength: 1,
  maxLength: 256,
};

export const jsonContentMigrationsSchema: AuthorSchema = array(
  object(
    {
      fromVersion: version,
      toVersion: version,
    },
    ['fromVersion', 'toVersion'],
  ),
);
