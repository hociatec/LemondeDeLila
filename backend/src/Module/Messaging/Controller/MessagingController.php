<?php

namespace App\Module\Messaging\Controller;

use App\Module\Messaging\Service\MessagingService;
use App\Module\User\Entity\User;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/messaging')]
class MessagingController extends AbstractController
{
    public function __construct(private readonly MessagingService $service)
    {
    }

    #[Route('/conversations/{userId}', name: 'messaging_conversation', methods: ['GET'])]
    public function conversation(int $userId, Request $request): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_USER');
        $currentUser = $this->requireUser();

        if ($userId === $currentUser->getId()) {
            return $this->json([
                'partner' => $this->service->describeUser($userId),
                'items' => [],
            ]);
        }

        $partner = $this->service->describeUser($userId);
        if (!$partner) {
            return $this->json(['message' => 'Utilisateur introuvable.'], Response::HTTP_NOT_FOUND);
        }

        $limit = (int) $request->query->get('limit', 100);
        $limit = max(1, min(500, $limit));
        try {
            $items = $this->service->conversation($currentUser, $userId, $limit);
        } catch (\Throwable $exception) {
            return $this->json(['message' => $exception->getMessage()], Response::HTTP_BAD_REQUEST);
        }

        return $this->json([
            'partner' => $partner,
            'items' => $items,
        ]);
    }

    #[Route('/messages', name: 'messaging_messages_list', methods: ['GET'])]
    public function messages(Request $request): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_USER');
        $currentUser = $this->requireUser();

        $limit = (int) $request->query->get('limit', 100);
        $limit = max(1, min(500, $limit));
        $box = strtolower((string) $request->query->get('box', 'inbox'));

        try {
            $items = match ($box) {
                'sent', 'outbox' => $this->service->outbox($currentUser, $limit),
                'inbox', 'received', '' => $this->service->inbox($currentUser, $limit),
                default => throw new \InvalidArgumentException('Boite de messagerie inconnue.'),
            };
        } catch (\InvalidArgumentException $exception) {
            return $this->json(['message' => $exception->getMessage()], Response::HTTP_BAD_REQUEST);
        } catch (\Throwable) {
            return $this->json(['message' => 'Impossible de recuperer les messages.'], Response::HTTP_INTERNAL_SERVER_ERROR);
        }

        return $this->json([
            'box' => $box === 'sent' ? 'outbox' : ($box === '' ? 'inbox' : $box),
            'items' => $items,
        ]);
    }

    #[Route('/messages', name: 'messaging_send', methods: ['POST'])]
    public function send(Request $request): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_USER');
        $currentUser = $this->requireUser();

        try {
            $payload = json_decode($request->getContent(), true, 512, JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            return $this->json(['message' => 'Payload JSON invalide.'], Response::HTTP_BAD_REQUEST);
        }
        $recipientId = (int) ($payload['recipientId'] ?? 0);
        $text = (string) ($payload['text'] ?? '');
        if ($recipientId <= 0) {
            return $this->json(['message' => 'Destinataire invalide.'], Response::HTTP_BAD_REQUEST);
        }

        try {
            $message = $this->service->send($currentUser, $recipientId, $text);
        } catch (\InvalidArgumentException $exception) {
            return $this->json(['message' => $exception->getMessage()], Response::HTTP_BAD_REQUEST);
        } catch (\RuntimeException $exception) {
            return $this->json(['message' => $exception->getMessage()], Response::HTTP_NOT_FOUND);
        } catch (\Throwable $exception) {
            return $this->json(['message' => 'Impossible d\'envoyer le message.'], Response::HTTP_INTERNAL_SERVER_ERROR);
        }

        return $this->json(['message' => $message], Response::HTTP_CREATED);
    }

    private function requireUser(): User
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            throw $this->createAccessDeniedException('Utilisateur non authentifie.');
        }
        return $user;
    }
}
