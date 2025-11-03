<?php

namespace App\Module\Game\Realtime\Command;

use Amp\Http\Server\DefaultErrorHandler;
use Amp\Http\Server\HttpServer;
use Amp\Loop;
use Amp\Socket\Server as SocketServer;
use Amp\Websocket\Server\Websocket;
use App\Module\Game\Realtime\PresenceRealtimeBroker;
use App\Module\Game\Realtime\PresenceRealtimeClientHandler;
use App\Module\Game\Realtime\RoomRealtimeBroker;
use App\Module\Game\Realtime\RoomRealtimeClientHandler;
use App\Module\Game\Realtime\RoomRealtimeHttpHandler;
use App\Module\Game\Realtime\RoomRealtimePushHandler;
use Psr\Log\LoggerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\DependencyInjection\ParameterBag\ParameterBagInterface;
use function Amp\asyncCall;

#[AsCommand(
    name: 'app:realtime:serve',
    description: 'Demarre le serveur WebSocket temps reel pour les tables de jeu'
)]
class RealtimeServerCommand extends Command
{
    public function __construct(
        private readonly ParameterBagInterface $parameters,
        private readonly LoggerInterface $logger,
        private readonly RoomRealtimeBroker $broker,
        private readonly PresenceRealtimeBroker $presenceBroker,
        private readonly RoomRealtimeClientHandler $clientHandler,
        private readonly PresenceRealtimeClientHandler $presenceClientHandler,
        private readonly RoomRealtimePushHandler $pushHandler
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $host = (string) $this->parameters->get('app.ws.host');
        $port = (int) $this->parameters->get('app.ws.port');
        if ($port <= 0) {
            $port = 8081;
        }

        $io->writeln(sprintf('<info>Serveur WS en écoute sur %s:%d</info>', $host, $port));

        $serverLogger = $this->logger;

        try {
            $roomWebsocket = new Websocket($this->clientHandler);
            $this->broker->setGateway($roomWebsocket);
            $presenceWebsocket = new Websocket($this->presenceClientHandler);
            $this->presenceBroker->setGateway($presenceWebsocket);
            $errorHandler = new DefaultErrorHandler($serverLogger);
            $httpHandler = new RoomRealtimeHttpHandler($roomWebsocket, $presenceWebsocket, $this->pushHandler);

            Loop::run(function () use ($host, $port, $serverLogger, $errorHandler, $httpHandler, $io, $roomWebsocket, $presenceWebsocket) {
                $socket = SocketServer::listen(sprintf('%s:%d', $host, $port));
                $server = new HttpServer([$socket], $httpHandler, $serverLogger);
                $server->attach($roomWebsocket);
                $server->attach($presenceWebsocket);
                $server->setErrorHandler($errorHandler);

                if (\function_exists('pcntl_signal')) {
                    foreach ([\SIGINT, \SIGTERM] as $signal) {
                        Loop::onSignal($signal, static function (string $watcherId) use ($server, $io, $signal): void {
                            Loop::cancel($watcherId);
                            $io->writeln(sprintf('Signal %d reçu, arrêt du serveur...', $signal));
                            asyncCall(static function () use ($server): \Generator {
                                yield $server->stop();
                                Loop::stop();
                            });
                        });
                    }
                }

                yield $server->start();
            });
        } catch (\Throwable $exception) {
            $io->error(sprintf('Impossible de démarrer le serveur WS : %s', $exception->getMessage()));
            $this->logger->error('Erreur serveur WS', ['exception' => $exception]);
            return Command::FAILURE;
        }

        return Command::SUCCESS;
    }
}
