export class WsRouteRegistryError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class WsRouteTypeRequiredError extends WsRouteRegistryError {
  constructor(message = 'WS route type requis') {
    super('WS_ROUTE_TYPE_REQUIRED', message);
  }
}

export class WsRouteAlreadyRegisteredError extends WsRouteRegistryError {
  constructor(message: string) {
    super('WS_ROUTE_ALREADY_REGISTERED', message);
  }
}
