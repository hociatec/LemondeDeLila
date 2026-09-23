/** Plain persisted data exposed to readers, including nested arrays. */
export type ReadonlyState<Value> = Value extends object
  ? { readonly [Key in keyof Value]: ReadonlyState<Value[Key]> }
  : Value;

export type MutableStateCopy<Value> = Value extends Date
  ? Date
  : Value extends object
    ? { -readonly [Key in keyof Value]: MutableStateCopy<Value[Key]> }
    : Value;

/** A fresh copy grants no mutation access to the original storage. */
export function copyState<Value>(value: Value): MutableStateCopy<Value> {
  return structuredClone(value) as MutableStateCopy<Value>;
}
