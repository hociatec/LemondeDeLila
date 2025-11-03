<?php

namespace App\Module\Admin\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/admin')]
class AdminController extends AbstractController
{
    #[Route('/health', name: 'admin_health', methods: ['GET'])]
    public function health(): Response
    {
        return $this->json(['status' => 'ok']);
    }
}

