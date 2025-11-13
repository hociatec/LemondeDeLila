<?php

namespace App\Module\Core\Controller;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;

/**
 * Retourne un statut simple pour indiquer que l'API est en ligne.
 */
#[Route('/', name: 'app_landing', methods: ['GET', 'HEAD'])]
final class LandingController
{
    public function __invoke(): JsonResponse
    {
        return new JsonResponse([
            'name' => 'Le Monde de Lila',
            'status' => 'ok',
            'api' => '/api',
        ]);
    }
}
