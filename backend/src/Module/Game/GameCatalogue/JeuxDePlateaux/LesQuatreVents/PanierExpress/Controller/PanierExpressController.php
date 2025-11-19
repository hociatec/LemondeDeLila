<?php

namespace App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Controller;

use App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Service\PanierExpressService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/games/panier-express')]
final class PanierExpressController extends AbstractController
{
    public function __construct(private readonly PanierExpressService $service)
    {
    }

    #[Route('/reference', name: 'panier_express_reference', methods: ['GET'])]
    public function reference(): Response
    {
        return $this->json($this->service->referenceData());
    }
}
