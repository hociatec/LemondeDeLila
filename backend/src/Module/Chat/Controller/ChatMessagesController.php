<?php

namespace App\Module\Chat\Controller;

use App\Module\Chat\Service\ChatService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Attribute\AsController;

#[AsController]
class ChatMessagesController extends AbstractController
{
    public function __construct(private readonly ChatService $chatService)
    {
    }

    public function __invoke(Request $request): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_USER');

        $limit = (int) $request->query->get('limit', 200);
        $limit = max(1, min(500, $limit));

        $sinceParameter = $request->query->get('since');
        $since = null;
        if (is_string($sinceParameter) && $sinceParameter !== '') {
            try {
                $since = new \DateTimeImmutable($sinceParameter);
            } catch (\Throwable) {
                $since = null;
            }
        }

        $messages = $this->chatService->getRecentMessages($limit, $since);

        return $this->json([
            'items' => $messages,
        ]);
    }
}
