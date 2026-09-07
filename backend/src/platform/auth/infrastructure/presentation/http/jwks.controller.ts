import { Controller, Get } from '@nestjs/common';
import { JwksDocumentService } from '../../../application/services/jwks-document.service';

@Controller()
export class JwksController {
  constructor(private readonly jwksDocument: JwksDocumentService) {}

  @Get('.well-known/jwks.json')
  jwks() {
    return this.jwksDocument.buildDocument();
  }
}
