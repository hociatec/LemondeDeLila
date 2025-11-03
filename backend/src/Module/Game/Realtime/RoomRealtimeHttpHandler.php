<?php

namespace App\Module\Game\Realtime;

use Amp\Http\Server\Request;
use Amp\Http\Server\RequestHandler;
use Amp\Http\Server\Response;
use Amp\Http\Status;
use Amp\Promise;
use Amp\Websocket\Server\Websocket;
use function Amp\call;

class RoomRealtimeHttpHandler implements RequestHandler
{
    public function __construct(
        private readonly Websocket $roomWebsocket,
        private readonly Websocket $presenceWebsocket,
        private readonly RoomRealtimePushHandler $pushHandler
    ) {
    }

    public function handleRequest(Request $request): Promise
    {
        return call(function () use ($request) {
            $path = $request->getUri()->getPath();
            if ($path === '/ws') {
                return yield $this->roomWebsocket->handleRequest($request);
            }
            if ($path === '/presence') {
                return yield $this->presenceWebsocket->handleRequest($request);
            }
            if ($path === '/push') {
                return yield $this->pushHandler->handleRequest($request);
            }

            return new Response(Status::NOT_FOUND);
        });
    }
}
