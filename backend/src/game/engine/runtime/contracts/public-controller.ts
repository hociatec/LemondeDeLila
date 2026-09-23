/** Explicit author API: new runtime members are private until reviewed here. */
export type PublicController<
  Implementation,
  Methods extends keyof Implementation,
> = Pick<Implementation, Methods>;
