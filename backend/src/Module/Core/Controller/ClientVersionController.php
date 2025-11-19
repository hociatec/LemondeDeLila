<?php

namespace App\Module\Core\Controller;

use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;

#[Route('/client/version', name: 'client_version', methods: ['GET'])]
final class ClientVersionController
{
    public function __construct(
        #[Autowire('%app.client.version%')] private readonly string $clientVersion,
        #[Autowire('%app.client.download_url%')] private readonly string $clientDownloadUrl,
        #[Autowire('%app.client.checksum%')] private readonly string $clientChecksum,
        #[Autowire('%app.client.download_secret%')] private readonly string $clientDownloadSecret,
        private readonly UrlGeneratorInterface $urlGenerator,
    ) {
    }

    public function __invoke(): JsonResponse
    {
        $downloadUrl = $this->clientDownloadUrl ?: $this->urlGenerator->generate(
            'client_download',
            referenceType: UrlGeneratorInterface::ABSOLUTE_URL
        );

        $tokenRequired = $this->clientDownloadSecret !== '';

        return new JsonResponse([
            'version' => $this->clientVersion,
            'downloadUrl' => $downloadUrl,
            'checksum' => $this->clientChecksum,
            'notes' => 'Mettre à jour pour bénéficier des dernières améliorations.',
            'timestamp' => time(),
            'tokenRequired' => $tokenRequired,
            'tokenHeader' => $tokenRequired ? ClientDownloadController::HEADER_TOKEN : null,
            'tokenQueryParameter' => $tokenRequired ? ClientDownloadController::QUERY_TOKEN : null,
        ]);
    }
}
