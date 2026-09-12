import {
  type AuthorSchema,
  authorId as id,
  authorObject as object,
} from '../contracts/json-author-schema';

export const jsonComponent = (
  name: string,
  fields: Record<string, AuthorSchema>,
  required: string[],
) =>
  object(
    {
      component: { const: name },
      id,
      scope: { enum: ['match', 'round'] },
      ...fields,
    },
    ['component', 'id', ...required],
  );
