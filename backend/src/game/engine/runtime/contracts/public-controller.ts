/** Public structural API without constructor or private storage. */
export type PublicController<T> = Pick<T, keyof T>;
