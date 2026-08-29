import { Controller, Get } from '@nestjs/common';
import { JwksDocumentService } from '../../../application/services/jwks-document.service';

@Controller()
export class JwksController {
  constructor(private readonly jwksDocument: JwksDocumentService) {}

  @Get('.well-known/jwks.json')
  jwks() {
    return this.jwksDocument.buildDocument();
  }

  // Some deployments proxy only /api/* to the backend. Provide a compatible path as well.
  @Get('api/.well-known/jwks.json')
  jwksUnderApi() {
    return this.jwks();
  }

  // Some reverse proxies block /.well-known/* entirely (403). Provide a non-standard alias under /api.
  @Get('api/jwks.json')
  jwksApiAlias() {
    return this.jwks();
  }

  // Some reverse proxies strip /api before forwarding (proxy_pass .../). Provide a root alias too.
  @Get('jwks.json')
  jwksRootAlias() {
    return this.jwks();
  }
}
