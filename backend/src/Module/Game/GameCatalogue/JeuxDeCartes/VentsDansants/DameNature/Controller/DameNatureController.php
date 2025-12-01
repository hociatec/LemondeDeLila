<?php

namespace App\Module\Game\GameCatalogue\JeuxDeCartes\VentsDansants\DameNature\Controller;

use App\Module\Game\GameCatalogue\JeuxDeCartes\VentsDansants\DameNature\Service\DameNatureReferenceService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;

final class DameNatureController extends AbstractController
{
    public function __construct(private readonly DameNatureReferenceService $reference)
    {
    }

    public function reference(): Response
    {
        return $this->json($this->reference->referenceData());
    }
}
