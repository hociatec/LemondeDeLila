<?php

namespace App\Module\Core\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

final class SystemController extends AbstractController
{
    #[Route('/', name: 'app_root', methods: ['GET'])]
    public function root(): JsonResponse
    {
        return $this->json([
            'status' => 'ok',
            'api' => '/api',
        ]);
    }

    #[Route('/api/health', name: 'api_health', methods: ['GET'])]
    public function health(): JsonResponse
    {
        return $this->json(['status' => 'ok']);
    }
}
