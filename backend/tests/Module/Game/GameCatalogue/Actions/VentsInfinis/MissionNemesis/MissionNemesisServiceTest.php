<?php

namespace App\Tests\Module\Game\GameCatalogue\Actions\VentsInfinis\MissionNemesis;

use App\Module\Game\Entity\Room;
use App\Module\Game\GameCatalogue\Actions\VentsInfinis\MissionNemesis\Service\MissionNemesisService;
use App\Module\User\Entity\User;
use PHPUnit\Framework\TestCase;

final class MissionNemesisServiceTest extends TestCase
{
    private MissionNemesisService $service;

    protected function setUp(): void
    {
        $this->service = new MissionNemesisService();
    }

    public function testPlacementTransitionsToCombat(): void
    {
        [$alpha, $bravo] = $this->makeUsers();
        $room = $this->makeRoom([$alpha, $bravo]);

        $state = $this->service->defaultState($room);

        $invalidState = $this->service->apply(
            $state,
            [
                'action' => 'place_ships',
                'ships' => [
                    [
                        'name' => 'Station spatiale',
                        'coords' => [
                            ['x' => 0, 'y' => 0],
                            ['x' => 1, 'y' => 1],
                            ['x' => 2, 'y' => 2],
                            ['x' => 3, 'y' => 3],
                            ['x' => 4, 'y' => 4],
                        ],
                    ],
                ],
            ],
            $room,
            $alpha
        );

        $this->assertSame('placement', $invalidState['status']);
        $this->assertEmpty($invalidState['players'][0]['ships']);

        $state = $this->service->apply(
            $invalidState,
            [
                'action' => 'place_ships',
                'ships' => $this->fleetAlpha(),
            ],
            $room,
            $alpha
        );
        $this->assertSame('placement', $state['status']);
        $this->assertNotEmpty($state['players'][0]['ships']);
        $this->assertSame('ready', $state['players'][0]['status']);

        $state = $this->service->apply(
            $state,
            [
                'action' => 'place_ships',
                'ships' => $this->fleetBravo(),
            ],
            $room,
            $bravo
        );

        $this->assertSame('playing', $state['status']);
        $this->assertSame('alive', $state['players'][0]['status']);
        $this->assertSame('alive', $state['players'][1]['status']);
        $this->assertSame(0, $state['turnIndex']);
        $this->assertSame(1, $state['round']);
        $this->assertSame('combat', $state['log'][0]['message'] ?? null);
    }

    public function testCombatEndsWhenFleetDestroyed(): void
    {
        [$alpha, $bravo] = $this->makeUsers();
        $room = $this->makeRoom([$alpha, $bravo]);

        $state = $this->service->defaultState($room);
        $state = $this->service->apply(
            $state,
            ['action' => 'place_ships', 'ships' => $this->fleetAlpha()],
            $room,
            $alpha
        );
        $state = $this->service->apply(
            $state,
            ['action' => 'place_ships', 'ships' => $this->fleetBravo()],
            $room,
            $bravo
        );

        $this->assertSame('playing', $state['status']);

        $playerOneShots = $this->fleetBravoCoordinates();
        $playerTwoShots = $this->fillerShots();

        foreach ($playerOneShots as $index => $shot) {
            $state = $this->service->apply(
                $state,
                ['action' => 'fire', 'coordinates' => $shot],
                $room,
                $alpha
            );

            if (($state['status'] ?? null) === 'ended') {
                break;
            }

            $this->assertSame(
                $bravo->getId(),
                $state['players'][$state['turnIndex']]['id']
            );

            $reply = $playerTwoShots[$index] ?? ['x' => 9, 'y' => max(0, 9 - $index)];
            $previousShotCount = count($state['players'][1]['shots']);

            $state = $this->service->apply(
                $state,
                ['action' => 'fire', 'coordinates' => $reply],
                $room,
                $bravo
            );

            $this->assertSame(
                $alpha->getId(),
                $state['players'][$state['turnIndex']]['id']
            );
            $this->assertCount($previousShotCount + 1, $state['players'][1]['shots']);
        }

        $this->assertSame('ended', $state['status']);
        $this->assertSame($alpha->getId(), $state['winner']);

        $score = $this->service->computeScore($state);
        $this->assertNotNull($score);
        $this->assertSame($alpha->getId(), $score['winnerId']);

        $remaining = array_values(
            array_filter(
                $score['players'],
                static fn (array $player): bool => $player['id'] === $alpha->getId()
            )
        );

        $this->assertNotEmpty($remaining);
        $this->assertGreaterThan(0, $remaining[0]['segmentsRemaining']);
    }

    public function testSinglePlayerRoomAddsBotAndPlaysAutomatically(): void
    {
        $users = $this->makeUsers();
        $alpha = $users[0];
        $room = $this->makeRoom([$alpha]);

        $state = $this->service->defaultState($room);

        $this->assertCount(2, $state['players']);
        $bot = $state['players'][1];
        $this->assertTrue($bot['isBot'] ?? false);
        $this->assertSame('ready', $bot['status']);
        $this->assertNotEmpty($bot['ships']);

        $state = $this->service->apply(
            $state,
            ['action' => 'place_ships', 'ships' => $this->fleetAlpha()],
            $room,
            $alpha
        );

        $this->assertSame('playing', $state['status']);
        $this->assertSame($alpha->getId(), $state['players'][$state['turnIndex']]['id']);

        $botShips = $state['players'][1]['ships'];
        $firstTarget = $botShips[0]['coords'][0];

        $state = $this->service->apply(
            $state,
            ['action' => 'fire', 'coordinates' => $firstTarget],
            $room,
            $alpha
        );

        $this->assertSame($alpha->getId(), $state['players'][$state['turnIndex']]['id']);
        $this->assertNotEmpty($state['players'][1]['shots'], 'Bot should have fired automatically.');
    }

    /**
     * @return array{0: User, 1: User}
     */
    private function makeUsers(): array
    {
        $alpha = (new User())
            ->setUsername('Alpha')
            ->setEmail('alpha@example.com')
            ->setPassword('noop');
        $this->forceId($alpha, 1001);

        $bravo = (new User())
            ->setUsername('Bravo')
            ->setEmail('bravo@example.com')
            ->setPassword('noop');
        $this->forceId($bravo, 1002);

        return [$alpha, $bravo];
    }

    /**
     * @param User[] $users
     */
    private function makeRoom(array $users): Room
    {
        $room = (new Room())
            ->setName('Test Room')
            ->setGameType('mission-nemesis')
            ->setOwner($users[0]);

        foreach ($users as $user) {
            $room->addPlayer($user);
        }

        return $room;
    }

    private function fleetAlpha(): array
    {
        return [
            [
                'name' => 'Station spatiale',
                'coords' => [
                    ['x' => 0, 'y' => 0],
                    ['x' => 1, 'y' => 0],
                    ['x' => 2, 'y' => 0],
                    ['x' => 3, 'y' => 0],
                    ['x' => 4, 'y' => 0],
                ],
            ],
            [
                'name' => 'Trou noir stabilise',
                'coords' => [
                    ['x' => 0, 'y' => 2],
                    ['x' => 1, 'y' => 2],
                    ['x' => 2, 'y' => 2],
                    ['x' => 3, 'y' => 2],
                ],
            ],
            [
                'name' => 'Asteroide defensif',
                'coords' => [
                    ['x' => 0, 'y' => 4],
                    ['x' => 1, 'y' => 4],
                    ['x' => 2, 'y' => 4],
                ],
            ],
            [
                'name' => 'Satellite longue portee',
                'coords' => [
                    ['x' => 6, 'y' => 0],
                    ['x' => 6, 'y' => 1],
                    ['x' => 6, 'y' => 2],
                ],
            ],
            [
                'name' => 'Sonde de reconnaissance',
                'coords' => [
                    ['x' => 8, 'y' => 0],
                    ['x' => 8, 'y' => 1],
                ],
            ],
        ];
    }

    private function fleetBravo(): array
    {
        return [
            [
                'name' => 'Station spatiale',
                'coords' => [
                    ['x' => 4, 'y' => 5],
                    ['x' => 5, 'y' => 5],
                    ['x' => 6, 'y' => 5],
                    ['x' => 7, 'y' => 5],
                    ['x' => 8, 'y' => 5],
                ],
            ],
            [
                'name' => 'Trou noir stabilise',
                'coords' => [
                    ['x' => 2, 'y' => 6],
                    ['x' => 2, 'y' => 7],
                    ['x' => 2, 'y' => 8],
                    ['x' => 2, 'y' => 9],
                ],
            ],
            [
                'name' => 'Asteroide defensif',
                'coords' => [
                    ['x' => 4, 'y' => 7],
                    ['x' => 5, 'y' => 7],
                    ['x' => 6, 'y' => 7],
                ],
            ],
            [
                'name' => 'Satellite longue portee',
                'coords' => [
                    ['x' => 9, 'y' => 0],
                    ['x' => 9, 'y' => 1],
                    ['x' => 9, 'y' => 2],
                ],
            ],
            [
                'name' => 'Sonde de reconnaissance',
                'coords' => [
                    ['x' => 0, 'y' => 3],
                    ['x' => 1, 'y' => 3],
                ],
            ],
        ];
    }

    /**
     * @return array<int, array{x:int, y:int}>
     */
    private function fleetBravoCoordinates(): array
    {
        $coords = [];
        foreach ($this->fleetBravo() as $ship) {
            foreach ($ship['coords'] as $coord) {
                $coords[] = $coord;
            }
        }
        return $coords;
    }

    /**
     * @return array<int, array{x:int, y:int}>
     */
    private function fillerShots(): array
    {
        return [
            ['x' => 9, 'y' => 9],
            ['x' => 8, 'y' => 9],
            ['x' => 7, 'y' => 9],
            ['x' => 6, 'y' => 9],
            ['x' => 5, 'y' => 9],
            ['x' => 4, 'y' => 9],
            ['x' => 3, 'y' => 9],
            ['x' => 2, 'y' => 9],
            ['x' => 1, 'y' => 9],
            ['x' => 0, 'y' => 9],
            ['x' => 9, 'y' => 8],
            ['x' => 8, 'y' => 8],
            ['x' => 7, 'y' => 8],
            ['x' => 6, 'y' => 8],
            ['x' => 5, 'y' => 8],
            ['x' => 4, 'y' => 8],
            ['x' => 3, 'y' => 8],
        ];
    }

    private function forceId(object $entity, int $id): void
    {
        $reflection = new \ReflectionObject($entity);
        if (!$reflection->hasProperty('id')) {
            $this->fail('Entity does not expose an id property.');
        }
        $property = $reflection->getProperty('id');
        $property->setAccessible(true);
        $property->setValue($entity, $id);
    }
}
