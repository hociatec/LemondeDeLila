import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function configureOpenApi(app: INestApplication): void {
  const configuration = new DocumentBuilder()
    .setTitle('Le Monde de Lila Backend')
    .setDescription('Contrat HTTP versionné du backend Le Monde de Lila')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, configuration, {
    operationIdFactory: (controller, method) => `${controller}.${method}`,
  });
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/openapi.json',
    yamlDocumentUrl: 'api/openapi.yaml',
  });
}
