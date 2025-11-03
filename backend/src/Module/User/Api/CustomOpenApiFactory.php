<?php

namespace App\Module\User\Api;

use ApiPlatform\OpenApi\Factory\OpenApiFactoryInterface;
use ApiPlatform\OpenApi\Model\MediaType;
use ApiPlatform\OpenApi\Model\Operation;
use ApiPlatform\OpenApi\Model\PathItem;
use ApiPlatform\OpenApi\Model\RequestBody;
use ApiPlatform\OpenApi\Model\Response;
use ApiPlatform\OpenApi\OpenApi;

class CustomOpenApiFactory implements OpenApiFactoryInterface
{
    public function __construct(private readonly OpenApiFactoryInterface $decorated)
    {
    }

    public function __invoke(array $context = []): OpenApi
    {
        $openApi = ($this->decorated)($context);

        $schemas = $openApi->getComponents()->getSchemas();
        $schemas['Token'] = $schemas['Token'] ?? new \ArrayObject([
            'type' => 'object',
            'properties' => [
                'token' => [
                    'type' => 'string',
                    'example' => 'eyJ0eXAiOiJKV1QiLCJh...',
                ],
            ],
        ]);

        $schemas['Credentials'] = $schemas['Credentials'] ?? new \ArrayObject([
            'type' => 'object',
            'properties' => [
                'username' => [
                    'type' => 'string',
                    'example' => 'admin',
                ],
                'password' => [
                    'type' => 'string',
                    'example' => 'albatros',
                ],
            ],
            'required' => ['username', 'password'],
        ]);

        $pathItem = new PathItem(
            post: new Operation(
                operationId: 'postCredentialsItem',
                tags: ['Authentication'],
                summary: 'Obtenir un jeton JWT',
                requestBody: new RequestBody(
                    description: 'Identifiants utilisateur',
                    content: [
                        'application/json' => new MediaType(
                            schema: new \ArrayObject(['$ref' => '#/components/schemas/Credentials'])
                        ),
                    ],
                ),
                responses: [
                    '200' => new Response(
                        description: 'Jeton JWT retourné',
                        content: [
                            'application/json' => new MediaType(
                                schema: new \ArrayObject(['$ref' => '#/components/schemas/Token'])
                            ),
                        ],
                    ),
                    '401' => new Response(description: 'Identifiants invalides'),
                ],
            )
        );

        $openApi->getPaths()->addPath('/api/login', $pathItem);

        return $openApi;
    }
}
