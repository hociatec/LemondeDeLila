<?php

namespace App\Tests\Module\Game\GameCatalogue\JeuxDeCartes\VentsDansants\DameNature;

use App\Module\Game\Bot\BotAllocator;
use App\Module\Game\Entity\Room;
use App\Module\Game\GameCatalogue\JeuxDeCartes\VentsDansants\DameNature\Service\DameNatureGameService;
use App\Module\Game\GameCatalogue\JeuxDeCartes\VentsDansants\DameNature\Service\DameNatureReferenceService;
use App\Module\Game\Service\ParticipantResolver;
use App\Module\User\Entity\User;
use PHPUnit\Framework\TestCase;

final class DameNatureServiceTest extends TestCase
{
    private DameNatureGameService $service;

    protected function setUp(): void
    {
        $this->service = new DameNatureGameService(
            new ParticipantResolver(),
            new BotAllocator(),
            new DameNatureReferenceService()
        );
    }

    public function testDefaultStateDealsExpectedHandSize(): void
    {
        $users = $this->makeUsers(3);
        $room = $this->makeRoom($users);

        $state = $this->service->defaultState($room);
        $state = $this->service->startState($state);

        self::assertSame('dame-nature', $state['type']);
        $hands = array_map(static fn (array $player) => count($player['hand']), $state['players']);
        self::assertSame([6, 6, 6], $hands);

        $totalCards = count($state['cards']);
        $cardsInHands = array_sum($hands);
        self::assertSame($totalCards - $cardsInHands, count($state['deck']));
    }

    public function testSuccessfulAskTransfersCard(): void
    {
        [$alpha, $bravo] = $this->makeUsers(2);
        $room = $this->makeRoom([$alpha, $bravo]);

        $state = $this->service->defaultState($room);
        $state = $this->service->startState($state);

        $familyId = array_key_first($state['familyMap']);
        self::assertIsString($familyId);
        $familyCards = $state['familyMap'][$familyId];
        $alphaCard = $familyCards[0];
        $bravoCard = $familyCards[1];
        $state['players'][0]['hand'] = [$alphaCard];
        $state['players'][1]['hand'] = [$bravoCard];
        $state['deck'] = array_values(array_diff($state['deck'], [$alphaCard, $bravoCard]));
        $targetCard = $state['cards'][$bravoCard];

        $state = $this->service->apply(
            $state,
            [
                'action' => 'ask_card',
                'familyId' => $familyId,
                'memberId' => $targetCard['memberId'],
                'target' => $state['players'][1]['id'],
            ],
            $room,
            $alpha
        );

        self::assertContains($bravoCard, $state['players'][0]['hand']);
        self::assertNotContains($bravoCard, $state['players'][1]['hand']);
    }

    public function testFailedAskDrawsAndAdvancesTurn(): void
    {
        [$alpha, $bravo] = $this->makeUsers(2);
        $room = $this->makeRoom([$alpha, $bravo]);

        $state = $this->service->defaultState($room);
        $state = $this->service->startState($state);
        $alphaIndex = 0;
        $initialTurn = $state['turnIndex'];

        $unusedCard = $this->findUnownedFamilyCard($state);
        self::assertNotNull($unusedCard);

        $familyCards = $state['familyMap'][$unusedCard['familyId']] ?? [];
        $alphaHand = &$state['players'][$alphaIndex]['hand'];
        $alphaHasFamily = false;
        foreach ($alphaHand as $code) {
            if (($state['cards'][$code]['familyId'] ?? null) === $unusedCard['familyId']) {
                $alphaHasFamily = true;
                break;
            }
        }
        if (!$alphaHasFamily) {
            foreach ($familyCards as $familyCode) {
                if ($familyCode === $unusedCard['code']) {
                    continue;
                }
                $alphaHand[] = $familyCode;
                $state['deck'] = array_values(array_filter(
                    $state['deck'],
                    static fn ($candidate) => $candidate !== $familyCode
                ));
                $alphaHasFamily = true;
                break;
            }
        }
        self::assertTrue($alphaHasFamily, 'Le joueur actif doit posseder une carte de la famille demandee.');

        // Force deck to ne contenir qu'une seule carte familiale connue.
        $state['deck'] = [$unusedCard['code']];

        $state = $this->service->apply(
            $state,
            [
                'action' => 'ask_card',
                'familyId' => $unusedCard['familyId'],
                'memberId' => $unusedCard['memberId'],
                'target' => $state['players'][1]['id'],
            ],
            $room,
            $alpha
        );

        self::assertNotSame($initialTurn, $state['turnIndex'], 'Turn should advance after failed request.');
        self::assertSame('turn', $state['phase']);
    }

    /**
     * @return User[]
     */
    private function makeUsers(int $count): array
    {
        $users = [];
        for ($i = 1; $i <= $count; $i++) {
            $user = new User();
            $this->forceId($user, $i);
            $user->setUsername('Player ' . $i);
            $users[] = $user;
        }
        return $users;
    }

    /**
     * @param User[] $users
     */
    private function makeRoom(array $users): Room
    {
        $room = new Room();
        $this->forceId($room, 100);
        foreach ($users as $user) {
            $room->addPlayer($user);
        }
        return $room;
    }

    /**
     * @return array{code:string,familyId:string,memberId:string}|null
     */
    private function findUnownedFamilyCard(array $state): ?array
    {
        $owned = [];
        foreach ($state['players'] as $player) {
            foreach ($player['hand'] as $code) {
                $owned[$code] = true;
            }
        }

        foreach ($state['cards'] as $code => $card) {
            if (($card['type'] ?? null) !== 'family') {
                continue;
            }
            if (!isset($owned[$code])) {
                return [
                    'code' => $code,
                    'familyId' => $card['familyId'],
                    'memberId' => $card['memberId'],
                ];
            }
        }

        return null;
    }

    private function forceId(object $entity, int $id): void
    {
        $reflection = new \ReflectionObject($entity);
        if (!$reflection->hasProperty('id')) {
            return;
        }
        $property = $reflection->getProperty('id');
        $property->setAccessible(true);
        $property->setValue($entity, $id);
    }
}
