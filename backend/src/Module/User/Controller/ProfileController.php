<?php

namespace App\Module\User\Controller;

use App\Module\User\Entity\User;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class ProfileController extends AbstractController
{
    #[Route('/api/me', name: 'api_me', methods: ['GET'])]
    public function me(): Response
    {
        /** @var User $me */
        $me = $this->getUser();
        return $this->json([
            'id' => $me?->getId(),
            'email' => $me?->getEmail(),
            'username' => $me?->getUsername(),
            'avatar' => $me?->getAvatar(),
            'roles' => $me?->getRoles(),
        ]);
    }

    #[Route('/api/me', name: 'api_me_update', methods: ['PATCH'])]
    public function update(\Doctrine\ORM\EntityManagerInterface $em): Response
    {
        /** @var User $me */
        $me = $this->getUser();
        $req = $this->container->get('request_stack')->getCurrentRequest();
        $data = json_decode($req->getContent(), true) ?? [];
        if (isset($data['username'])) $me->setUsername((string)$data['username']);
        if (array_key_exists('avatar', $data)) $me->setAvatar($data['avatar'] === null ? null : (string)$data['avatar']);
        $em->flush();
        return $this->json(['message' => 'Updated']);
    }
}
