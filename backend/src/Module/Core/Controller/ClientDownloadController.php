<?php

namespace App\Module\Core\Controller;

use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/client/download', name: 'client_download', methods: ['GET'])]
final class ClientDownloadController
{
    private const HEADER_TOKEN = 'X-Client-Update-Token';

    public function __construct(
        #[Autowire('%app.client.package_path%')] private readonly string $packagePath,
        #[Autowire('%app.client.download_secret%')] private readonly string $downloadSecret,
    ) {
    }

    public function __invoke(Request $request): Response
    {
        if ($this->downloadSecret !== '') {
            $provided = $request->headers->get(self::HEADER_TOKEN, '');
            if (!hash_equals($this->downloadSecret, $provided)) {
                return new JsonResponse(['error' => 'Unauthorized'], Response::HTTP_FORBIDDEN);
            }
        }

        if (!is_file($this->packagePath)) {
            return new JsonResponse(['error' => 'Package unavailable'], Response::HTTP_SERVICE_UNAVAILABLE);
        }

        $response = new BinaryFileResponse($this->packagePath);
        $response->setContentDisposition(
            ResponseHeaderBag::DISPOSITION_ATTACHMENT,
            basename($this->packagePath)
        );

        return $response;
    }
}
