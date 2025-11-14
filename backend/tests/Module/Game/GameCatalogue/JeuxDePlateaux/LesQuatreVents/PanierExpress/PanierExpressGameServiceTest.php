<?php

namespace App\Tests\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress;

use App\Module\Game\Entity\Room;
use App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Service\PanierExpressCommand;
use App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Service\PanierExpressGameService;
use App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Service\PanierExpressService;
use App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Service\Support\PanierExpressDeckManager;
use App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Service\Support\PanierExpressRandomizerInterface;
use App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Service\Support\PanierExpressTileResolver;
use App\Module\User\Entity\User;
use PHPUnit\Framework\TestCase;

final class PanierExpressGameServiceTest extends TestCase
{
    private PanierExpressGameService $service;

    protected function setUp(): void
    {
        $this->service = new PanierExpressGameService(
            new PanierExpressService(),
            new PanierExpressDeckManager(),
            new PanierExpressTileResolver(),
            new class implements PanierExpressRandomizerInterface {
                public function randomInt(int $min, int $max): int
                {
                    return $min;
                }

                public function shuffle(array &$items): void
                {
                    // no-op to keep deterministic order in tests
                }
            }
        );
    }

    public function testDefaultStateInitialisesPlayers(): void
    {
        $room = $this->makeRoom(2);
        $state = $this->service->defaultState($room);

        self::assertSame('panier-express', $state['type']);
        self::assertSame('playing', $state['status']);
        self::assertCount(2, $state['players']);

        foreach ($state['players'] as $player) {
            self::assertSame(1, $player['position']);
            self::assertNotSame([], $player['shoppingList']);
        }
    }

    public function testRollAdvancesPlayer(): void
    {
        $room = $this->makeRoom(1);
        $state = $this->service->defaultState($room);
        $player = $room->getPlayers()->first();
        self::assertInstanceOf(User::class, $player);

        $state = $this->service->apply($state, ['action' => PanierExpressCommand::ROLL, 'steps' => 3], $room, $player);
        $active = $state['players'][0];
        self::assertSame(4, $active['position']);
    }

    public function testQuizAnswerResolvesPending(): void
    {
        $room = $this->makeRoom(1);
        $state = $this->service->defaultState($room);
        $player = $room->getPlayers()->first();
        self::assertInstanceOf(User::class, $player);

        $state['pending'] = [
            'type' => 'quiz',
            'playerId' => $state['players'][0]['id'],
            'question' => 'Quel fruit ?',
            'choices' => ['Pomme', 'Banane'],
            'answerIndex' => 1,
        ];
        $state['phase'] = 'quiz';

        $state = $this->service->apply($state, [
            'action' => PanierExpressCommand::ANSWER_QUIZ,
            'choice' => 1,
        ], $room, $player);

        self::assertNull($state['pending']);
        self::assertSame('turn', $state['phase']);
    }

    public function testLandingOnStandDrawsAtLeastOneItem(): void
    {
        $room = $this->makeRoom(1);
        $state = $this->service->defaultState($room);
        $player = $room->getPlayers()->first();
        self::assertInstanceOf(User::class, $player);

        $state = $this->service->apply($state, ['action' => PanierExpressCommand::ROLL, 'steps' => 1], $room, $player);

        $active = $state['players'][0];
        self::assertSame(2, $active['position']);
        self::assertTrue(
            count($active['basket']) > 0 || count($active['inventory']) > 0,
            'Player should have collected or stored at least one item.'
        );
    }

    public function testQuizTileCreatesPendingQuestion(): void
    {
        $room = $this->makeRoom(1);
        $state = $this->service->defaultState($room);
        $player = $room->getPlayers()->first();
        self::assertInstanceOf(User::class, $player);

        // Position the player just before the quiz tile (index 15)
        $state['players'][0]['position'] = 14;

        $state = $this->service->apply($state, ['action' => PanierExpressCommand::ROLL, 'steps' => 1], $room, $player);

        self::assertSame('quiz', $state['phase']);
        self::assertNotNull($state['pending']);
        self::assertSame('quiz', $state['pending']['type']);
    }

    private function makeRoom(int $players): Room
    {
        $room = new Room();
        $this->forceId($room, 100);

        for ($i = 1; $i <= $players; $i++) {
            $user = new User();
            $this->forceId($user, $i);
            $user->setUsername('Joueur ' . $i);
            $room->addPlayer($user);
        }

        return $room;
    }

    private function forceId(object $entity, int $id): void
    {
        $ref = new \ReflectionObject($entity);
        if (!$ref->hasProperty('id')) {
            return;
        }
        $prop = $ref->getProperty('id');
        $prop->setAccessible(true);
        $prop->setValue($entity, $id);
    }
}
