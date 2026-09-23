/** Test-only compatibility fixture; never exposed by the production SDK. */
export function legacyExtensionFixture<
  Document extends { extensions: readonly { type: string; config: object }[] },
  const Key extends string,
>(
  source: Document,
  key: Key,
): Omit<Document, 'extensions'> & {
  [Field in Key]: Document['extensions'][number]['config'];
} {
  const { extensions, ...core } = source;
  const extension = extensions[0];
  if (extensions.length !== 1 || extension?.type !== key)
    throw new Error(`Expected one ${key} extension in legacy fixture`);
  return { ...core, [key]: structuredClone(extension.config) } as Omit<
    Document,
    'extensions'
  > & { [Field in Key]: Document['extensions'][number]['config'] };
}
