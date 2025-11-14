<?php

namespace App\Module\Core\Controller;

use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/client/version', name: 'client_version', methods: ['GET'])]
final class ClientVersionController
{
    public function __construct(
        #[Autowire('%app.client.version%')]
        private readonly string ,
        #[Autowire('%app.client.download_url%')]
        private readonly string 
    ) {
    }

    public function __invoke(): JsonResponse
    {
        return new JsonResponse([
            'version' => ->clientVersion,
            'downloadUrl' => ->clientDownloadUrl,
            'notes' => 'Mettre à jour pour bénéficier des dernières améliorations.',
            'timestamp' => time(),
        ]);
    }
}
