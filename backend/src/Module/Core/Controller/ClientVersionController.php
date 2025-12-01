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
        #[Autowire('%app.client.min_version%')] private readonly string $clientMinVersion,
        #[Autowire('%app.client.signature_url%')] private readonly string $clientSignatureUrl,
        #[Autowire('%app.client.changelog_json%')] private readonly string $clientChangelogJson,
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
        $changelog = $this->decodeChangelog($this->clientChangelogJson);

        return new JsonResponse([
            'version' => $this->clientVersion,
            'downloadUrl' => $downloadUrl,
            'checksum' => $this->clientChecksum,
            'notes' => 'Mettre à jour pour bénéficier des dernières améliorations.',
            'minSupportedVersion' => $this->clientMinVersion !== '' ? $this->clientMinVersion : null,
            'signatureUrl' => $this->clientSignatureUrl !== '' ? $this->clientSignatureUrl : null,
            'changelog' => $changelog,
            'timestamp' => time(),
            'tokenRequired' => $tokenRequired,
            'tokenHeader' => $tokenRequired ? ClientDownloadController::HEADER_TOKEN : null,
            'tokenQueryParameter' => $tokenRequired ? ClientDownloadController::QUERY_TOKEN : null,
        ]);
    }

    /**
     * The changelog is stored as JSON (array of objects or strings).
     * Any decoding failure should degrade gracefully.
     */
    private function decodeChangelog(string $changelogJson): array
    {
        if ($changelogJson === '') {
            return [];
        }

        $decoded = json_decode($changelogJson, true);
        if (!is_array($decoded)) {
            return [];
        }

        return $decoded;
    }
}
