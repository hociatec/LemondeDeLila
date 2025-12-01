<?php

namespace App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Service;

use App\Module\Game\Bot\BotAllocator;
use App\Module\Game\Engine\GameEngineInterface;
use App\Module\Game\Entity\Room;
use App\Module\Game\Exchange\ExchangeCard;
use App\Module\Game\Exchange\ExchangePending;
use App\Module\Game\Exchange\ExchangePresenter;
use App\Module\Game\Service\Participant;
use App\Module\Game\Service\ParticipantResolver;
use App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Service\PanierExpressCommand;
use App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Service\Support\PanierExpressDeckManager;
use App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Service\Support\NativePanierExpressRandomizer;
use App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Service\Support\PanierExpressRandomizerInterface;
use App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Service\Support\PanierExpressTileAction;
use App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Service\Support\PanierExpressTileResolver;
use App\Module\Game\Shared\Action\Action;
use App\Module\Game\Shared\Action\ActionResolver;
use App\Module\Game\Shared\Dice\DiceRoll;
use App\Module\Game\Shared\Dice\DiceService;
use App\Module\User\Entity\User;
use App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Service\Support\PanierExpressTurnCoordinator;
use App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Service\Support\PanierExpressTurnStateFactory;
use App\Module\Game\Shared\Turn\TurnState;

final class PanierExpressGameService implements GameEngineInterface
{
    private const GAME_TYPE = 'panier-express';
    private const BOARD_SIZE = 40;
    private const MAX_CHAINED_ACTIONS = 5;

    /** @var array<string,string> */
    private array $courseCatalog = [];

    public function __construct(
        private readonly PanierExpressService $reference,
        private readonly PanierExpressDeckManager $deckManager,
        private readonly PanierExpressTileResolver $tileResolver,
        private readonly ParticipantResolver $participants,
        private readonly BotAllocator $botAllocator,
        private readonly DiceService $diceService = new DiceService(),
        private readonly ActionResolver $actionResolver = new ActionResolver(
            new \App\Module\Game\Shared\Deck\DeckManager(),
            new \App\Module\Game\Shared\Quiz\QuizService()
        ),
        private readonly PanierExpressRandomizerInterface $randomizer = new NativePanierExpressRandomizer(),
        private readonly ExchangePresenter $exchangePresenter = new ExchangePresenter(),
    ) {
    }

    private function neighborIndex(array $state, int $playerIndex, string $direction): ?int
    {
        $players = $state['players'] ?? [];
        $count = count($players);
        if ($count <= 1) {
            return null;
        }
        if ($direction === 'left') {
            return ($playerIndex - 1 + $count) % $count;
        }
        return ($playerIndex + 1) % $count;
    }

    private function passCardInDirection(array &$state, string $direction): void
    {
        $players = $state['players'] ?? [];
        $count = count($players);
        if ($count <= 1) {
            return;
        }
        $passing = [];
        foreach (array_keys($players) as $index) {
            $passing[$index] = $this->removeRandomCourseFromPlayer($state, (int)$index, true);
        }
        foreach ($passing as $index => $item) {
            if ($item === null) {
                continue;
            }
            $target = $this->neighborIndex($state, (int)$index, $direction);
            if ($target === null) {
                continue;
            }
            $this->addCourseToInventory($state, $target, $item);
            $this->log($state, sprintf('%s transmet %s à %s.', $state['players'][$index]['username'], $item, $state['players'][$target]['username']));
        }
    }

    private function collectivePoolExchange(array &$state): void
    {
        $pool = [];
        foreach (array_keys($state['players'] ?? []) as $index) {
            $card = $this->removeRandomCourseFromPlayer($state, (int)$index, true);
            if ($card !== null) {
                $pool[] = ['item' => $card, 'from' => (int)$index];
            }
        }
        if ($pool === []) {
            return;
        }
        $items = array_column($pool, 'item');
        $receivers = array_column($pool, 'from');
        $this->randomizer->shuffle($items);
        foreach ($receivers as $idx => $receiver) {
            $item = $items[$idx] ?? null;
            if ($item === null) {
                continue;
            }
            $this->addCourseToInventory($state, $receiver, $item);
        }
    }

    private function mixInventories(array &$state, int $playerIndex): void
    {
        $target = $this->findRandomOtherPlayerIndex($state, $playerIndex);
        if ($target === null) {
            return;
        }
        $pool = array_merge(
            $state['players'][$playerIndex]['inventory'] ?? [],
            $state['players'][$target]['inventory'] ?? []
        );
        if ($pool === []) {
            return;
        }
        $this->randomizer->shuffle($pool);
        $state['players'][$playerIndex]['inventory'] = [];
        $state['players'][$target]['inventory'] = [];
        foreach ($pool as $i => $item) {
            $receiver = ($i % 2 === 0) ? $playerIndex : $target;
            $this->addCourseToInventory($state, $receiver, $item);
        }
    }

    private function swapRandomCourseBetween(array &$state, int $firstIndex, int $secondIndex): void
    {
        $first = $this->removeRandomCourseFromPlayer($state, $firstIndex, true);
        $second = $this->removeRandomCourseFromPlayer($state, $secondIndex, true);
        if ($first !== null) {
            $this->addCourseToInventory($state, $secondIndex, $first);
        }
        if ($second !== null) {
            $this->addCourseToInventory($state, $firstIndex, $second);
        }
    }

    private function swapAllCourses(array &$state, int $firstIndex, int $secondIndex): void
    {
        $firstInv = $state['players'][$firstIndex]['inventory'] ?? [];
        $secondInv = $state['players'][$secondIndex]['inventory'] ?? [];
        $state['players'][$firstIndex]['inventory'] = array_values($secondInv);
        $state['players'][$secondIndex]['inventory'] = array_values($firstInv);

        $firstBasket = $state['players'][$firstIndex]['basket'] ?? [];
        $secondBasket = $state['players'][$secondIndex]['basket'] ?? [];
        $state['players'][$firstIndex]['basket'] = array_values($secondBasket);
        $state['players'][$secondIndex]['basket'] = array_values($firstBasket);

        $this->refreshCheckoutFlag($state, $firstIndex);
        $this->refreshCheckoutFlag($state, $secondIndex);
    }

    private function removeCourseByCategory(array &$state, int $playerIndex, string $category): ?string
    {
        $this->ensureCourseCatalog();
        $inventory = &$state['players'][$playerIndex]['inventory'];
        if (is_array($inventory)) {
            foreach ($inventory as $idx => $item) {
                $cat = $this->courseCategory((string)$item);
                if ($cat === $category) {
                    $value = $inventory[$idx];
                    unset($inventory[$idx]);
                    $inventory = array_values($inventory);
                    return $value;
                }
            }
        }
        return null;
    }

    private function ensureCourseCatalog(): void
    {
        if ($this->courseCatalog !== []) {
            return;
        }
        $reference = $this->reference->referenceData();
        foreach ($reference['courses']['fruits'] ?? [] as $card) {
            $name = (string)($card['name'] ?? '');
            if ($name !== '') {
                $this->courseCatalog[$name] = 'fruit';
            }
        }
        foreach ($reference['courses']['vegetables'] ?? [] as $card) {
            $name = (string)($card['name'] ?? '');
            if ($name !== '') {
                $this->courseCatalog[$name] = 'vegetable';
            }
        }
    }

    private function courseCategory(string $item): ?string
    {
        return $this->courseCatalog[$item] ?? null;
    }

    public function getType(): string
    {
        return self::GAME_TYPE;
    }

    public function defaultState(Room $room): array
    {
        $data = $this->reference->referenceData();
        $participants = $this->participants->resolve($room);
        if ($participants === []) {
            throw new \RuntimeException('Aucun joueur disponible pour lancer Panier Express.');
        }

        $players = [];
        foreach ($participants as $participant) {
            if (!$participant instanceof Participant) {
                continue;
            }
            $players[] = $this->buildPlayerFromParticipant($participant, $data['shoppingLists'] ?? []);
        }

        $state = [
            'type' => self::GAME_TYPE,
            // Toujours en attente tant qu'un start explicite n'a pas été demandé.
            'status' => 'open',
            'phase' => 'open',
            'round' => 1,
            'turnIndex' => 0,
            'board' => [
                'tiles' => $data['board'] ?? [],
            ],
            'decks' => $this->deckManager->initialiseDecks($data, $this->randomizer),
            'discard' => [
                PanierExpressDeckManager::DECK_COURSES => [],
                PanierExpressDeckManager::DECK_EVENT => [],
                PanierExpressDeckManager::DECK_EXCHANGE => [],
                PanierExpressDeckManager::DECK_QUIZ => [],
            ],
            'pending' => null,
            'exchangePending' => null,
            'log' => [],
            'players' => $players,
            'lastRoll' => null,
        ];

        return $state;
    }

    /**
     * Bascule l'état en mode « partie en cours » (phase de tour).
     */
    public function startState(array $state): array
    {
        $state['status'] = 'playing';
        $state['phase'] = 'turn';
        if (!isset($state['log']) || !is_array($state['log'])) {
            $state['log'] = [];
        }
        $state['log'][] = [
            'type' => 'info',
            'message' => 'Bienvenue au marché ! Lancez le dé pour commencer.',
        ];
        $this->syncTurnMeta($state);
        return $state;
    }

    /**
     * Traite une liste d'actions génériques (moteur partagé) pour Panier Express.
     * Chaque action est mappée sur les primitives internes (roll, quiz, pioche, log).
     *
     * @param Action[] $actions
     */
    public function applyActions(array $state, array $actions, Room $room, User $user): array
    {
        if (($state['status'] ?? null) === 'ended') {
            return $state;
        }

        $playerIndex = $this->locatePlayer($state, (int) $user->getId());
        if ($playerIndex === -1) {
            return $state;
        }

        foreach ($actions as $raw) {
            if ($raw instanceof Action) {
                $action = $raw;
            } elseif (is_array($raw)) {
                $type = (string) ($raw['type'] ?? '');
                $payload = is_array($raw['payload'] ?? null) ? $raw['payload'] : [];
                $action = new Action($type, $payload);
            } else {
                continue;
            }

            switch ($action->type) {
                case 'ROLL_DICE':
                    $config = $action->payload['config'] ?? null;
                    $diceCount = (int) ($config['diceCount'] ?? 1);
                    $faces = (int) ($config['faces'] ?? 6);
                    $modifier = (int) ($config['modifier'] ?? 0);
                    $roll = $this->diceService->roll(new DiceRoll(
                        max(1, $diceCount),
                        max(2, $faces),
                        $modifier
                    ));
                    $state = $this->handleRoll($state, ['steps' => max(1, $roll->total)], $playerIndex);
                    break;

                case 'DRAW_CARD':
                    $deck = strtolower((string) ($action->payload['deck'] ?? 'course'));
                    $this->drawFromDeck($state, $playerIndex, $deck);
                    break;

                case 'QUIZ_VALIDATE':
                    $choice = $action->payload['answer'] ?? $action->payload['choice'] ?? null;
                    if ($choice !== null) {
                        $state = $this->handleQuizAnswer($state, ['choice' => (int) $choice], $playerIndex);
                    }
                    break;

                case 'LOG':
                    $this->log($state, (string) ($action->payload['message'] ?? ''));
                    break;

                default:
                    // Action non reconnue : on délègue au resolver générique qui renverra des logs éventuels.
                    $effects = $this->actionResolver->resolve([$action]);
                    foreach ($effects as $effect) {
                        if (($effect['type'] ?? '') === 'log' && isset($effect['message'])) {
                            $this->log($state, (string) $effect['message']);
                        }
                    }
                    break;
            }

            if (($state['status'] ?? null) === 'ended') {
                break;
            }
        }

        return $this->advanceBots($state);
    }

    public function apply(array $state, array $payload, Room $room, User $user): array
    {
        if (($state['status'] ?? null) === 'ended') {
            return $state;
        }

        $playerIndex = $this->locatePlayer($state, (int) $user->getId());
        if ($playerIndex === -1) {
            return $state;
        }

        $action = (string) ($payload['action'] ?? '');
        $pendingType = $state['pending']['type'] ?? null;

        if ($pendingType === 'quiz') {
            if ($action === PanierExpressCommand::ANSWER_QUIZ) {
                $state = $this->handleQuizAnswer($state, $payload, $playerIndex);
            }
            return $this->advanceBots($state);
        }

        if ($pendingType === 'exchange') {
            if ($action === PanierExpressCommand::APPLY_EXCHANGE) {
                $state = $this->handleExchangeChoice($state, $payload, $playerIndex);
            }
            return $this->advanceBots($state);
        }

        if ($action === PanierExpressCommand::ROLL) {
            $state = $this->handleRoll($state, $payload, $playerIndex);
            return $this->advanceBots($state);
        }

        return $this->advanceBots($state);
    }

    public function currentRound(array $state): int
    {
        return max(1, (int) ($state['round'] ?? 1));
    }

    public function computeScore(array $state): ?array
    {
        $players = $state['players'] ?? [];
        $summary = [];
        foreach ($players as $player) {
            $summary[] = [
                'id' => $player['id'] ?? null,
                'username' => $player['username'] ?? '',
                'collected' => count($player['basket'] ?? []),
                'shoppingListSize' => count($player['shoppingList'] ?? []),
                'position' => $player['position'] ?? 1,
                'readyForCheckout' => (bool) ($player['readyForCheckout'] ?? false),
                'isBot' => (bool) ($player['isBot'] ?? false),
            ];
        }

        $data = [
            'round' => $this->currentRound($state),
            'players' => $summary,
        ];

        if (($state['status'] ?? null) === 'ended') {
            $data['winner'] = $state['winner'] ?? null;
        } else {
            $turnIndex = (int) ($state['turnIndex'] ?? 0);
            $data['activePlayer'] = $players[$turnIndex]['id'] ?? null;
        }

        return $data;
    }

    private function buildPlayerFromParticipant(Participant $participant, array $shoppingLists): array
    {
        $list = $this->drawShoppingList($shoppingLists);

        return [
            'id' => $participant->id(),
            'username' => $participant->username(),
            'position' => 1,
            'basket' => [],
            'inventory' => [],
            'shoppingList' => $list,
            'skipTurns' => 0,
            'readyForCheckout' => false,
            'isBot' => $participant->isBot(),
        ];
    }

    /**
     * @param array<int,array<string,mixed>> $players
     * @param array<int,mixed> $shoppingLists
     */
    private function createEphemeralBot(array $players, array $shoppingLists): array
    {
        $names = array_map(
            static fn(array $player): string => (string)($player['username'] ?? ''),
            $players
        );
        $name = $this->botAllocator->pick($names);

        $botParticipant = new Participant($this->generateBotId($players), $name, true);

        return $this->buildPlayerFromParticipant($botParticipant, $shoppingLists);
    }

    /**
     * @param array<int,array<string,mixed>> $players
     */
    private function generateBotId(array $players): int
    {
        $used = array_map(
            static fn(array $player): int => (int)($player['id'] ?? 0),
            $players
        );

        do {
            $id = -1 * random_int(1000, 1_000_000);
        } while (in_array($id, $used, true));

        return $id;
    }

    private function drawShoppingList(array $shoppingLists): array
    {
        if ($shoppingLists === []) {
            return [];
        }

        $index = $this->randomizer->randomInt(0, count($shoppingLists) - 1);
        $rawList = $shoppingLists[$index];

        if (is_array($rawList)) {
            return array_values(array_filter(array_map('strval', $rawList)));
        }
        if (is_string($rawList)) {
            return array_map('trim', explode(',', $rawList));
        }

        return [];
    }

    private function locatePlayer(array $state, int $userId): int
    {
        foreach ($state['players'] ?? [] as $index => $player) {
            if (($player['id'] ?? null) === $userId) {
                return $index;
            }
        }
        return -1;
    }

    private function handleRoll(array $state, array $payload, int $playerIndex): array
    {
        if (($state['phase'] ?? 'turn') !== 'turn') {
            return $state;
        }

        if (($state['turnIndex'] ?? 0) !== $playerIndex) {
            return $state;
        }

        if (($state['players'][$playerIndex]['skipTurns'] ?? 0) > 0) {
            $state['players'][$playerIndex]['skipTurns']--;
            $this->log($state, sprintf('%s passe son tour.', $state['players'][$playerIndex]['username']));
            $this->advanceTurn($state, $playerIndex);
            return $state;
        }

        $forced = $payload['steps'] ?? null;
        $steps = is_int($forced) && $forced >= 1 && $forced <= 6
            ? $forced
            : $this->randomizer->randomInt(1, 6);

        $state['lastRoll'] = $steps;

        $this->log($state, sprintf('%s lance le dé et obtient %d.', $state['players'][$playerIndex]['username'], $steps));

        $this->movePlayer($state, $playerIndex, $steps);
        if (($state['status'] ?? null) !== 'ended' && ($state['pending']['type'] ?? null) === null) {
            $this->advanceTurn($state, $playerIndex);
        }

        $this->syncTurnMeta($state);

        return $this->advanceBots($state);
    }

    private function runBotTurns(array $state): array
    {
        if (($state['status'] ?? null) !== 'playing') {
            return $state;
        }

        $turnIndex = (int) ($state['turnIndex'] ?? 0);
        $players = $state['players'] ?? [];
        if (!isset($players[$turnIndex]) || ($players[$turnIndex]['isBot'] ?? false) !== true) {
            return $state;
        }

        $playerId = $players[$turnIndex]['id'] ?? null;
        if ($this->isPendingQuizFor($state, $playerId)) {
            $choices = $state['pending']['choices'] ?? [];
            $choice = $choices && is_array($choices)
                ? random_int(0, max(0, count($choices) - 1))
                : 0;
            return $this->handleQuizAnswer($state, ['choice' => $choice], $turnIndex);
        }

        if (($state['phase'] ?? 'turn') !== 'turn' || ($state['pending']['type'] ?? null) !== null) {
            return $state;
        }

        return $this->handleRoll($state, [], $turnIndex);
    }

    private function isPendingQuizFor(array $state, ?int $playerId): bool
    {
        if ($playerId === null) {
            return false;
        }
        $pending = $state['pending'] ?? null;
        if (!is_array($pending)) {
            return false;
        }
        if (($pending['type'] ?? null) !== 'quiz') {
            return false;
        }
        return (int) ($pending['playerId'] ?? 0) === $playerId;
    }

    private function handleQuizAnswer(array $state, array $payload, int $playerIndex): array
    {
        $pending = $state['pending'] ?? null;
        if (!$pending || ($pending['type'] ?? null) !== 'quiz') {
            return $state;
        }

        if (($pending['playerId'] ?? null) !== ($state['players'][$playerIndex]['id'] ?? null)) {
            return $state;
        }

        $choice = isset($payload['choice']) ? (int) $payload['choice'] : null;
        if ($choice === null) {
            return $state;
        }

        $answerIndex = (int) ($pending['answerIndex'] ?? -1);
        $choices = $pending['choices'] ?? [];
        $isCorrect = $choice === $answerIndex;

        if ($isCorrect) {
            $this->log($state, sprintf('Bonne réponse pour %s ! Vous gagnez une carte Courses.', $state['players'][$playerIndex]['username']), 'success');
            $this->drawCourseCard($state, $playerIndex);
        } else {
            $label = $choices[$answerIndex] ?? 'aucune réponse correcte';
            $this->log($state, sprintf('Mauvaise réponse pour %s. Réponse attendue : %s.', $state['players'][$playerIndex]['username'], $label), 'warning');
        }

        $state['pending'] = null;
        $state['phase'] = 'turn';

        if (($state['status'] ?? null) !== 'ended') {
            $this->advanceTurn($state, $playerIndex);
        }

        return $state;
    }

    private function movePlayer(array &$state, int $playerIndex, int $steps): void
    {
        $player = &$state['players'][$playerIndex];
        $previousPosition = (int)($player['position'] ?? 1);
        $player['position'] = $previousPosition + $steps;
        if ($player['position'] > self::BOARD_SIZE) {
            if ($player['readyForCheckout'] ?? false) {
                $player['position'] = self::BOARD_SIZE;
                $state['log'][] = [
                    'type' => 'info',
                    'message' => sprintf('%s atteint l\'entrée du marché et se prépare à passer en caisse.', $player['username']),
                ];
            } else {
                $overflow = $player['position'] - self::BOARD_SIZE;
                $player['position'] = (($overflow - 1) % self::BOARD_SIZE) + 1;
                $state['log'][] = [
                    'type' => 'info',
                    'message' => sprintf('%s termine un tour complet et repart depuis la case %d.', $player['username'], $player['position']),
                ];
            }
        }

        $this->processTile($state, $playerIndex, 0);
    }

    private function processTile(array &$state, int $playerIndex, int $depth): void
    {
        if ($depth > self::MAX_CHAINED_ACTIONS) {
            return;
        }

        $tile = $this->tileAt($state, $state['players'][$playerIndex]['position'] ?? 1);
        if ($tile === null) {
            return;
        }

        $label = (string) ($tile['label'] ?? '');
        $actions = $this->tileResolver->resolveActions($tile);
        $tileType = (string) ($tile['type'] ?? 'action');

        if ($tileType === 'stand') {
            $this->log($state, sprintf('%s arrive sur %s.', $state['players'][$playerIndex]['username'], $label));
            if ($actions === []) {
                $actions[] = ['type' => PanierExpressTileAction::DRAW_COURSE];
            }
        }

        if ($actions === []) {
            if ($label !== '') {
                $this->log($state, sprintf('%s arrive sur une case spéciale : %s.', $state['players'][$playerIndex]['username'], $label));
            } else {
                $this->log($state, sprintf('%s ne rencontre aucun effet particulier.', $state['players'][$playerIndex]['username']));
            }
            $this->checkVictory($state, $playerIndex);
            return;
        }

        foreach ($actions as $action) {
            $this->executeTileAction($state, $playerIndex, $action, $depth, $tile);

            if (($state['status'] ?? null) === 'ended' || ($state['pending']['type'] ?? null) !== null) {
                break;
            }
        }

        if (($state['status'] ?? null) !== 'ended' && ($state['pending']['type'] ?? null) === null) {
            $this->checkVictory($state, $playerIndex);
        }
    }

    /**
     * @param array<string, mixed> $action
     * @param array<string, mixed> $tile
     */
    private function executeTileAction(array &$state, int $playerIndex, array $action, int $depth, array $tile): void
    {
        $type = (string) ($action['type'] ?? '');
        $label = (string) ($tile['label'] ?? '');

        switch ($type) {
            case PanierExpressTileAction::DRAW_COURSE:
                $this->drawCourseCard($state, $playerIndex);
                break;

            case PanierExpressTileAction::DRAW_EVENT:
                $this->drawEventCard($state, $playerIndex);
                break;

            case PanierExpressTileAction::DRAW_EXCHANGE:
                $this->drawExchangeCard($state, $playerIndex);
                break;

            case PanierExpressTileAction::START_QUIZ:
                $this->startQuiz($state, $playerIndex);
                break;

            case PanierExpressTileAction::BONUS_COURSE:
                $this->log($state, sprintf('%s pioche une carte Courses supplémentaire.', $state['players'][$playerIndex]['username']));
                $this->drawCourseCard($state, $playerIndex);
                break;

            case PanierExpressTileAction::SKIP_TURN:
                $count = isset($action['count']) && is_numeric($action['count']) ? max(1, (int) $action['count']) : 1;
                $state['players'][$playerIndex]['skipTurns'] = ($state['players'][$playerIndex]['skipTurns'] ?? 0) + $count;
                $this->log(
                    $state,
                    sprintf(
                        '%s perdra %d tour(s).',
                        $state['players'][$playerIndex]['username'],
                        $count
                    ),
                    'warning'
                );
                break;

            case PanierExpressTileAction::MOVE:
                $delta = isset($action['delta']) && is_numeric($action['delta']) ? (int) $action['delta'] : 0;
                if ($delta > 0) {
                    $this->log($state, sprintf('%s avance de %d case(s).', $state['players'][$playerIndex]['username'], $delta));
                } elseif ($delta < 0) {
                    $this->log($state, sprintf('%s recule de %d case(s).', $state['players'][$playerIndex]['username'], abs($delta)));
                }
                if ($delta !== 0) {
                    $this->adjustPosition($state, $playerIndex, $delta, $depth);
                }
                break;

            case PanierExpressTileAction::ADVANCE_TO_NEXT_STAND:
                $target = $this->findNextStandPosition($state, $state['players'][$playerIndex]['position'] ?? 1);
                if ($target !== null) {
                    $this->log($state, sprintf('%s avance jusqu\'au prochain stand.', $state['players'][$playerIndex]['username']));
                    $state['players'][$playerIndex]['position'] = $target;
                    $this->processTile($state, $playerIndex, $depth + 1);
                }
                break;

            case PanierExpressTileAction::ARRIVAL:
                // Victory check will run after the loop, nothing else to do.
                break;

            case PanierExpressTileAction::LOG:
                $message = (string) ($action['message'] ?? '');
                if ($message === '') {
                    $message = $label !== ''
                        ? sprintf('%s arrive sur %s.', $state['players'][$playerIndex]['username'], $label)
                        : sprintf('%s ne rencontre aucun effet particulier.', $state['players'][$playerIndex]['username']);
                }
                $this->log($state, $message);
                break;

            default:
                if ($label !== '') {
                    $this->log($state, sprintf('%s arrive sur une case spéciale : %s.', $state['players'][$playerIndex]['username'], $label));
                }
                break;
        }
    }

    private function drawCourseCard(array &$state, int $playerIndex): void
    {
        if ($this->consumeDrawBlock($state, $playerIndex)) {
            $this->log(
                $state,
                sprintf('%s ne peut pas piocher de carte Courses ce tour.', $state['players'][$playerIndex]['username']),
                'warning'
            );
            return;
        }

        $card = $this->deckManager->drawCard($state, PanierExpressDeckManager::DECK_COURSES, $this->randomizer);
        if ($card === null) {
            $this->log($state, 'La pioche Courses est vide.', 'warning');
            return;
        }

        $player = &$state['players'][$playerIndex];
        $item = $card['name'] ?? 'Produit';
        if (in_array($item, $player['shoppingList'], true) && !in_array($item, $player['basket'], true)) {
            $player['basket'][] = $item;
            $this->log($state, sprintf('%s récupère %s pour sa liste.', $player['username'], $item), 'success');
            if ($this->hasCompletedList($player)) {
                $player['readyForCheckout'] = true;
                $this->log($state, sprintf('%s a complété sa liste ! Retournez à l\'entrée pour gagner.', $player['username']), 'success');
            }
        } else {
            $player['inventory'][] = $item;
            $this->log($state, sprintf('%s ajoute %s à son panier pour un échange futur.', $player['username'], $item));
        }

        $player['lastGain'] = $item;
    }

    private function drawEventCard(array &$state, int $playerIndex): void
    {
        $card = $this->deckManager->drawCard($state, PanierExpressDeckManager::DECK_EVENT, $this->randomizer);
        if ($card === null) {
            $this->log($state, 'La pioche evenement est vide.', 'warning');
            return;
        }

        $title = $card['title'] ?? 'Evenement';
        $effect = $card['effect'] ?? '';

        $this->log($state, sprintf('Carte evenement : %s. %s', $title, $effect));

        $this->handleEventEffect($state, $playerIndex, $effect);
    }

    private function handleEventEffect(array &$state, int $playerIndex, string $effect): void
    {
        $normalized = $this->normalizeText($effect);
        if ($normalized === '') {
            return;
        }

        if (str_contains($normalized, 'pioche 2 cartes courses') || str_contains($normalized, 'pioche deux cartes courses')) {
            $this->drawCourseCard($state, $playerIndex);
            $this->drawCourseCard($state, $playerIndex);
            return;
        }

        if (str_contains($normalized, 'pioche une carte courses') || str_contains($normalized, 'gagne un fruit') || str_contains($normalized, 'gagne une carte courses')) {
            $this->drawCourseCard($state, $playerIndex);
            return;
        }

        if (str_contains($normalized, 'tous les joueurs piochent')) {
            foreach (array_keys($state['players'] ?? []) as $index) {
                $this->drawCourseCard($state, (int)$index);
            }
            return;
        }

        if (str_contains($normalized, 'tous les joueurs sur un stand bio piochent')) {
            $this->drawForPlayersOnStand($state, 'bio');
            return;
        }

        if (str_contains($normalized, 'tous les joueurs presents sur ton stand')) {
            $this->drawForPlayersOnSameTile($state, $playerIndex);
            return;
        }

        if (preg_match('/avance de ([0-9]+)/', $normalized, $matches)) {
            $this->adjustPosition($state, $playerIndex, (int)$matches[1], 0);
            return;
        }

        if (preg_match('/recule de ([0-9]+)/', $normalized, $matches)) {
            $this->adjustPosition($state, $playerIndex, -1 * (int)$matches[1], 0);
            return;
        }

        if (str_contains($normalized, 'perds ton prochain tour') || str_contains($normalized, 'perd ton prochain tour') || str_contains($normalized, 'passe ton prochain tour')) {
            $state['players'][$playerIndex]['skipTurns'] = ($state['players'][$playerIndex]['skipTurns'] ?? 0) + 1;
            return;
        }

        if (str_contains($normalized, 'rejoue immediatement')) {
            $this->grantExtraTurn($state, $playerIndex);
            return;
        }

        if (str_contains($normalized, 'pioche inconnue') || str_contains($normalized, 'rien ne se passe')) {
            return;
        }

        if (str_contains($normalized, 'pioche une carte courses bonus')) {
            $this->drawCourseCard($state, $playerIndex);
            return;
        }

        if (str_contains($normalized, 'pioche une carte courses') || str_contains($normalized, 'gagne une carte courses')) {
            $this->drawCourseCard($state, $playerIndex);
            return;
        }

        if (str_contains($normalized, 'ne peut pas piocher') || str_contains($normalized, 'ne pioche rien ce tour')) {
            $this->blockDrawForPlayer($state, $playerIndex);
            return;
        }

        if (str_contains($normalized, 'compare') && str_contains($normalized, 'nombre de cartes')) {
            $this->penalizeLargestInventory($state);
            return;
        }

        if (str_contains($normalized, 'prends lui une carte courses au hasard')) {
            $target = $this->findRandomOtherPlayerIndex($state, $playerIndex);
            if ($target !== null) {
                $this->stealRandomCourse($state, $playerIndex, $target, false);
            }
            return;
        }

        if (str_contains($normalized, 'donne en une a un joueur')) {
            $target = $this->findRandomOtherPlayerIndex($state, $playerIndex);
            if ($target !== null) {
                $this->giveRandomCourseToPlayer($state, $playerIndex, $target);
            }
            return;
        }

        if (str_contains($normalized, 'si tu as 3 cartes') && str_contains($normalized, 'coches une')) {
            $this->completeShoppingItemWithoutCard($state, $playerIndex);
            return;
        }

        if (str_contains($normalized, 'remets une carte courses au bas de la pioche')) {
            $this->returnRandomCourseToDeck($state, $playerIndex);
            return;
        }

        if (str_contains($normalized, 'derniere carte courses que tu as obtenue')) {
            $this->removeLastGain($state, $playerIndex);
            return;
        }

        if (str_contains($normalized, 'ajoute un 6e produit')) {
            $this->addExtraShoppingItem($state, $playerIndex);
            return;
        }

        if (str_contains($normalized, 'carte courses dans la defausse')) {
            $this->takeCourseFromDiscard($state, $playerIndex);
            return;
        }

        if (str_contains($normalized, 'le sens du tour change')) {
            $this->invertTurnDirection($state, $playerIndex);
            return;
        }

        if (str_contains($normalized, 'stand surprise')) {
            $this->applyStandSurprise($state, $playerIndex);
            return;
        }

        if (str_contains($normalized, 'avance jusqu au stand de ton choix')) {
            $this->moveToPreferredStand($state, $playerIndex, true);
            return;
        }

        if (str_contains($normalized, 'stand exceptionnel')) {
            $this->drawCourseCard($state, $playerIndex);
            return;
        }

        if (str_contains($normalized, 'producteur genereux')) {
            $this->drawCourseCard($state, $playerIndex);
            $target = $this->findRandomOtherPlayerIndex($state, $playerIndex);
            if ($target !== null) {
                $this->giveRandomCourseToPlayer($state, $playerIndex, $target);
            }
            return;
        }
    }

    private function grantExtraTurn(array &$state, int $playerIndex): void
    {
        $state['flags']['extraTurn'] = $playerIndex;
    }

    private function blockDrawForPlayer(array &$state, int $playerIndex): void
    {
        if (!isset($state['flags']['blockedDraw']) || !is_array($state['flags']['blockedDraw'])) {
            $state['flags']['blockedDraw'] = [];
        }
        $state['flags']['blockedDraw'][$playerIndex] = true;
    }

    private function consumeDrawBlock(array &$state, int $playerIndex): bool
    {
        if (isset($state['flags']['blockedDraw'][$playerIndex]) && $state['flags']['blockedDraw'][$playerIndex] === true) {
            unset($state['flags']['blockedDraw'][$playerIndex]);
            return true;
        }
        return false;
    }

    private function penalizeLargestInventory(array &$state): void
    {
        $players = $state['players'] ?? [];
        $max = 0;
        $targets = [];
        foreach ($players as $index => $player) {
            $count = count($player['inventory'] ?? []) + count($player['basket'] ?? []);
            if ($count > $max) {
                $max = $count;
                $targets = [$index];
            } elseif ($count === $max) {
                $targets[] = $index;
            }
        }
        if ($max === 0) {
            return;
        }
        foreach ($targets as $idx) {
            $this->removeRandomCourseFromPlayer($state, (int)$idx, true);
        }
    }

    private function findRandomOtherPlayerIndex(array $state, int $playerIndex): ?int
    {
        $indexes = array_keys($state['players'] ?? []);
        $candidates = array_values(array_filter($indexes, static fn($i) => (int)$i !== $playerIndex));
        if ($candidates === []) {
            return null;
        }
        $choice = $candidates[random_int(0, count($candidates) - 1)];
        return (int)$choice;
    }

    private function addCourseToInventory(array &$state, int $playerIndex, string $item): void
    {
        if ($item === '') {
            return;
        }
        if (!isset($state['players'][$playerIndex]['inventory']) || !is_array($state['players'][$playerIndex]['inventory'])) {
            $state['players'][$playerIndex]['inventory'] = [];
        }
        $state['players'][$playerIndex]['inventory'][] = $item;
        $state['players'][$playerIndex]['lastGain'] = $item;
    }

    private function removeRandomCourseFromPlayer(array &$state, int $playerIndex, bool $allowBasket): ?string
    {
        if (!isset($state['players'][$playerIndex]['inventory']) || !is_array($state['players'][$playerIndex]['inventory'])) {
            $state['players'][$playerIndex]['inventory'] = [];
        }
        $inventory = &$state['players'][$playerIndex]['inventory'];
        if ($inventory !== []) {
            $key = array_rand($inventory);
            $item = $inventory[$key];
            unset($inventory[$key]);
            $inventory = array_values($inventory);
            return $item;
        }

        if ($allowBasket) {
            if (!isset($state['players'][$playerIndex]['basket']) || !is_array($state['players'][$playerIndex]['basket'])) {
                $state['players'][$playerIndex]['basket'] = [];
            }
            $basket = &$state['players'][$playerIndex]['basket'];
            if ($basket !== []) {
                $key = array_rand($basket);
                $item = $basket[$key];
                unset($basket[$key]);
                $basket = array_values($basket);
                $this->refreshCheckoutFlag($state, $playerIndex);
                return $item;
            }
        }
        return null;
    }

    private function stealRandomCourse(array &$state, int $thiefIndex, int $victimIndex, bool $returnTheft = true): void
    {
        $item = $this->removeRandomCourseFromPlayer($state, $victimIndex, true);
        if ($item === null) {
            return;
        }
        $this->addCourseToInventory($state, $thiefIndex, $item);
        $this->log($state, sprintf('%s prend %s à %s.', $state['players'][$thiefIndex]['username'], $item, $state['players'][$victimIndex]['username']));

        if ($returnTheft) {
            $back = $this->removeRandomCourseFromPlayer($state, $thiefIndex, true);
            if ($back !== null) {
                $this->addCourseToInventory($state, $victimIndex, $back);
            }
        }
    }

    private function giveRandomCourseToPlayer(array &$state, int $fromIndex, int $toIndex): void
    {
        $item = $this->removeRandomCourseFromPlayer($state, $fromIndex, true);
        if ($item === null) {
            return;
        }
        $this->addCourseToInventory($state, $toIndex, $item);
        $this->log($state, sprintf('%s donne %s à %s.', $state['players'][$fromIndex]['username'], $item, $state['players'][$toIndex]['username']));
    }

    private function completeShoppingItemWithoutCard(array &$state, int $playerIndex): void
    {
        $player = &$state['players'][$playerIndex];
        $list = $player['shoppingList'] ?? [];
        $basket = $player['basket'] ?? [];
        foreach ($list as $item) {
            if (!in_array($item, $basket, true)) {
                $player['basket'][] = $item;
                $this->log($state, sprintf('%s coche %s sur sa liste.', $player['username'], $item), 'success');
                $this->refreshCheckoutFlag($state, $playerIndex);
                return;
            }
        }
    }

    private function returnRandomCourseToDeck(array &$state, int $playerIndex): void
    {
        $item = $this->removeRandomCourseFromPlayer($state, $playerIndex, true);
        if ($item === null) {
            return;
        }
        $state['discard'][PanierExpressDeckManager::DECK_COURSES][] = ['name' => $item];
        $this->log($state, sprintf('%s remet %s dans la pioche Courses.', $state['players'][$playerIndex]['username'], $item));
    }

    private function removeLastGain(array &$state, int $playerIndex): void
    {
        $last = $state['players'][$playerIndex]['lastGain'] ?? null;
        if ($last === null) {
            return;
        }
        $removed = false;
        $inv = &$state['players'][$playerIndex]['inventory'];
        if (($k = array_search($last, $inv ?? [], true)) !== false) {
            unset($inv[$k]);
            $inv = array_values($inv);
            $removed = true;
        } else {
            $basket = &$state['players'][$playerIndex]['basket'];
            if (($k = array_search($last, $basket ?? [], true)) !== false) {
                unset($basket[$k]);
                $basket = array_values($basket);
                $removed = true;
                $this->refreshCheckoutFlag($state, $playerIndex);
            }
        }
        if ($removed) {
            $this->log($state, sprintf('%s perd la dernière carte obtenue : %s.', $state['players'][$playerIndex]['username'], $last), 'warning');
        }
    }

    private function addExtraShoppingItem(array &$state, int $playerIndex): void
    {
        $this->ensureCourseCatalog();
        $pool = array_keys($this->courseCatalog);
        if ($pool === []) {
            return;
        }
        $item = $pool[random_int(0, count($pool) - 1)];
        $state['players'][$playerIndex]['shoppingList'][] = $item;
        $this->log($state, sprintf('%s ajoute un produit à sa liste : %s.', $state['players'][$playerIndex]['username'], $item), 'info');
    }

    private function takeCourseFromDiscard(array &$state, int $playerIndex): void
    {
        $discard = &$state['discard'][PanierExpressDeckManager::DECK_COURSES];
        if (!is_array($discard) || $discard === []) {
            return;
        }
        $card = array_pop($discard);
        $item = $card['name'] ?? null;
        if ($item === null) {
            return;
        }
        $this->addCourseToInventory($state, $playerIndex, $item);
        $this->log($state, sprintf('%s récupère %s dans la défausse.', $state['players'][$playerIndex]['username'], $item));
    }

    private function invertTurnDirection(array &$state, int $playerIndex): void
    {
        $state['flags']['turnDirection'] = (($state['flags']['turnDirection'] ?? 1) === 1) ? -1 : 1;
        $state['flags']['turnDirectionResetPlayer'] = $state['players'][$playerIndex]['id'] ?? null;
    }

    private function applyStandSurprise(array &$state, int $playerIndex): void
    {
        $roll = $this->randomizer->randomInt(1, 6);
        $targets = [
            1 => 'bio',
            2 => 'bio',
            3 => 'fruitier',
            4 => 'fruitier',
            5 => 'primeur',
            6 => 'primeur',
        ];
        $want = $targets[$roll] ?? null;
        if ($want === null) {
            return;
        }
        $target = $this->findStandByCategory($state, $want);
        if ($target !== null) {
            $state['players'][$playerIndex]['position'] = $target;
            $this->log($state, sprintf('%s est téléporté sur un stand %s.', $state['players'][$playerIndex]['username'], $want));
            $this->processTile($state, $playerIndex, 0);
        }
    }

    private function findStandByCategory(array $state, string $category): ?int
    {
        foreach ($state['board']['tiles'] ?? [] as $tile) {
            $label = $this->normalizeText((string)($tile['label'] ?? ''));
            if (($tile['type'] ?? '') === 'stand' && str_contains($label, $category)) {
                return (int)($tile['index'] ?? 0);
            }
        }
        return null;
    }

    private function moveToPreferredStand(array &$state, int $playerIndex, bool $drawAfter = false): void
    {
        $target = $this->findNextStandPosition($state, $state['players'][$playerIndex]['position'] ?? 1);
        if ($target !== null) {
            $state['players'][$playerIndex]['position'] = $target;
            $this->processTile($state, $playerIndex, 0);
            if ($drawAfter) {
                $this->drawCourseCard($state, $playerIndex);
            }
        }
    }

    private function drawForPlayersOnStand(array &$state, string $match): void
    {
        $match = $this->normalizeText($match);
        foreach ($state['players'] ?? [] as $index => $player) {
            $tile = $this->tileAt($state, (int)($player['position'] ?? 1));
            $label = $this->normalizeText((string)($tile['label'] ?? ''));
            if (str_contains($label, $match)) {
                $this->drawCourseCard($state, (int)$index);
            }
        }
    }

    private function drawForPlayersOnSameTile(array &$state, int $playerIndex): void
    {
        $pos = $state['players'][$playerIndex]['position'] ?? 1;
        foreach ($state['players'] ?? [] as $index => $player) {
            if (($player['position'] ?? null) === $pos) {
                $this->drawCourseCard($state, (int)$index);
            }
        }
    }

    private function handleExchangeCardEffect(array &$state, int $playerIndex, array $card): bool
    {
        $id = strtolower((string)($card['id'] ?? ''));
        if ($id === 'echange-simultane') {
            $this->passCardInDirection($state, 'left');
            return true;
        }
        if ($id === 'panier-collectif') {
            $this->collectivePoolExchange($state);
            return true;
        }
        if ($id === 'panier-mixe') {
            $this->mixInventories($state, $playerIndex);
            return true;
        }

        $effect = (string) ($card['effect'] ?? '');
        $normalized = $this->normalizeText($effect);
        if ($normalized === '') {
            return false;
        }

        if (str_contains($normalized, 'voisin de gauche')) {
            $target = $this->neighborIndex($state, $playerIndex, 'left');
            if ($target !== null) {
                $this->swapRandomCourseBetween($state, $playerIndex, $target);
            }
            return true;
        }

        if (str_contains($normalized, 'voisin de droite')) {
            $target = $this->neighborIndex($state, $playerIndex, 'right');
            if ($target !== null) {
                $this->swapRandomCourseBetween($state, $playerIndex, $target);
            }
            return true;
        }

        if (str_contains($normalized, 'sans lui en rendre') || str_contains($normalized, 'vol discret')) {
            $target = $this->findRandomOtherPlayerIndex($state, $playerIndex);
            if ($target !== null) {
                $this->stealRandomCourse($state, $playerIndex, $target, false);
            }
            return true;
        }

        if (str_contains($normalized, 'il t en prend une en retour') || str_contains($normalized, 'echange force')) {
            $target = $this->findRandomOtherPlayerIndex($state, $playerIndex);
            if ($target !== null) {
                $this->swapRandomCourseBetween($state, $playerIndex, $target);
            }
            return true;
        }

        if (str_contains($normalized, 'toutes tes cartes courses') || str_contains($normalized, 'chariot echange')) {
            $target = $this->findRandomOtherPlayerIndex($state, $playerIndex);
            if ($target !== null) {
                $this->swapAllCourses($state, $playerIndex, $target);
            }
            return true;
        }

        if (str_contains($normalized, 'tous les joueurs passent une carte') || str_contains($normalized, 'echange simultane')) {
            $this->passCardInDirection($state, 'left');
            return true;
        }

        if (str_contains($normalized, 'panier collectif')) {
            $this->collectivePoolExchange($state);
            return true;
        }

        if (str_contains($normalized, 'panier mixe')) {
            $this->mixInventories($state, $playerIndex);
            return true;
        }

        if (str_contains($normalized, 'troque un fruit contre un legume')) {
            $target = $this->findRandomOtherPlayerIndex($state, $playerIndex);
            if ($target !== null) {
                $fruit = $this->removeCourseByCategory($state, $playerIndex, 'fruit');
                $vegetable = $this->removeCourseByCategory($state, $target, 'vegetable');
                if ($fruit !== null && $vegetable !== null) {
                    $this->addCourseToInventory($state, $playerIndex, $vegetable);
                    $this->addCourseToInventory($state, $target, $fruit);
                } else {
                    if ($fruit !== null) {
                        $this->addCourseToInventory($state, $playerIndex, $fruit);
                    }
                    if ($vegetable !== null) {
                        $this->addCourseToInventory($state, $target, $vegetable);
                    }
                }
            }
            return true;
        }

        return false;
    }

    private function drawExchangeCard(array &$state, int $playerIndex): void
    {
        $card = $this->deckManager->drawCard($state, PanierExpressDeckManager::DECK_EXCHANGE, $this->randomizer);
        if ($card === null) {
            $this->log($state, 'La pioche echange est vide.', 'warning');
            return;
        }

        $title = $card['title'] ?? 'Echange';
        $effect = $card['effect'] ?? '';

        $this->log($state, sprintf('Carte echange : %s. %s', $title, $effect));

        if ($this->handleExchangeCardEffect($state, $playerIndex, $card)) {
            return;
        }

        $playerId = $state['players'][$playerIndex]['id'] ?? null;
        $rawCard = new ExchangeCard(
            (string)($card['id'] ?? uniqid('exchange_', true)),
            $title,
            $effect,
            ['raw' => $card]
        );
        $exchangePending = new ExchangePending($playerId, $rawCard);

        $payload = array_merge(
            ['type' => 'exchange'],
            $this->exchangePresenter->presentPending($exchangePending)
        );

        $payload['card'] = [
            'id' => $rawCard->id(),
            'title' => $rawCard->title(),
            'description' => $rawCard->description(),
            'effect' => $rawCard->description(),
            'metadata' => $rawCard->metadata(),
        ];

        $this->startExchangeInteraction($state, $playerIndex, $payload, (string)($card['id'] ?? uniqid('exchange_', true)));
    }

    private function startExchangeInteraction(array &$state, int $playerIndex, array $cardPayload, string $exchangeId): void
    {
        $cards = $this->listExchangeableItems($state, $playerIndex);
        $targets = $this->listExchangeTargets($state, $playerIndex);

        if ($cards === [] || $targets === []) {
            $this->log($state, 'Aucun echange possible.', 'warning');
            $state['exchangePending'] = null;
            return;
        }

        $isBot = (bool)($state['players'][$playerIndex]['isBot'] ?? false);
        if ($isBot) {
            $choice = $cards[array_rand($cards)];
            $offer = $this->removeExchangeItem($state, $playerIndex, (string)($choice['id'] ?? ''));
            if ($offer === null) {
                $this->log($state, 'Aucun echange possible pour ce bot.', 'warning');
                return;
            }
            $targetInfo = $targets[array_rand($targets)];
            $targetIndex = $this->locatePlayerByIdentifier($state, $targetInfo['id'] ?? null);
            if ($targetIndex === null) {
                $this->addCourseToInventory($state, $playerIndex, $offer);
                return;
            }
            $state['flags']['exchangeContext'] = [
                'id' => $exchangeId,
                'stage' => 'target',
                'initiator' => $playerIndex,
                'target' => $targetIndex,
                'offer' => $offer,
                'card' => $cardPayload['card'] ?? null,
            ];
            if (($state['players'][$targetIndex]['isBot'] ?? false) === true) {
                $received = $this->pickRandomExchangeItem($state, $targetIndex);
                $this->finalizeExchange($state, $received);
                return;
            }
            $targetCards = $this->listExchangeableItems($state, $targetIndex);
            if ($targetCards === []) {
                $this->finalizeExchange($state, null);
                return;
            }
            $pending = [
                'type' => 'exchange',
                'stage' => 'target',
                'exchangeId' => $exchangeId,
                'playerId' => $state['players'][$targetIndex]['id'] ?? null,
                'cards' => $targetCards,
                'requestedBy' => [
                    'id' => $state['players'][$playerIndex]['id'] ?? null,
                    'username' => $state['players'][$playerIndex]['username'] ?? '',
                ],
                'offer' => $offer,
                'card' => $cardPayload['card'] ?? null,
            ];
            $state['pending'] = $pending;
            $state['exchangePending'] = $pending;
            $state['phase'] = 'exchange';
            return;
        }

        $pending = array_merge($cardPayload, [
            'stage' => 'select',
            'exchangeId' => $exchangeId,
            'playerId' => $state['players'][$playerIndex]['id'] ?? null,
            'cards' => $cards,
            'targets' => $targets,
        ]);

        $state['pending'] = $pending;
        $state['exchangePending'] = $pending;
        $state['phase'] = 'exchange';
        $state['flags']['exchangeContext'] = [
            'id' => $exchangeId,
            'stage' => 'select',
            'initiator' => $playerIndex,
            'card' => $cardPayload['card'] ?? null,
        ];
    }

    private function handleExchangeChoice(array $state, array $payload, int $playerIndex): array
    {
        $context = $state['flags']['exchangeContext'] ?? null;
        if (!is_array($context)) {
            return $state;
        }
        $exchangeId = $payload['exchangeId'] ?? null;
        if (!is_string($exchangeId) || $exchangeId === '' || $exchangeId !== ($context['id'] ?? null)) {
            return $state;
        }

        $stage = (string) ($context['stage'] ?? 'select');
        if ($stage === 'select') {
            if ((int) ($context['initiator'] ?? -1) !== $playerIndex) {
                return $state;
            }
            $cardKey = (string) ($payload['card'] ?? '');
            if ($cardKey === '') {
                return $state;
            }
            $targetId = $payload['targetId'] ?? null;
            $targetIndex = $this->locatePlayerByIdentifier($state, $targetId);
            if ($targetIndex === null || $targetIndex === $playerIndex) {
                return $state;
            }
            $offer = $this->removeExchangeItem($state, $playerIndex, $cardKey);
            if ($offer === null) {
                return $state;
            }

            $state['flags']['exchangeContext'] = [
                'id' => $exchangeId,
                'stage' => 'target',
                'initiator' => $playerIndex,
                'target' => $targetIndex,
                'offer' => $offer,
            ];

            if (($state['players'][$targetIndex]['isBot'] ?? false) === true) {
                $received = $this->pickRandomExchangeItem($state, $targetIndex);
                return $this->finalizeExchange($state, $received);
            }

            $cards = $this->listExchangeableItems($state, $targetIndex);
            if ($cards === []) {
                return $this->finalizeExchange($state, null);
            }

            $pending = [
                'type' => 'exchange',
                'stage' => 'target',
                'exchangeId' => $exchangeId,
                'playerId' => $state['players'][$targetIndex]['id'] ?? null,
                'cards' => $cards,
                'requestedBy' => [
                    'id' => $state['players'][$playerIndex]['id'] ?? null,
                    'username' => $state['players'][$playerIndex]['username'] ?? '',
                ],
                'offer' => $offer,
                'card' => $context['card'] ?? null,
            ];
            $state['pending'] = $pending;
            $state['exchangePending'] = $pending;
            $state['phase'] = 'exchange';
            return $state;
        }

        if ($stage === 'target') {
            if ((int) ($context['target'] ?? -1) !== $playerIndex) {
                return $state;
            }
            $cardKey = (string) ($payload['card'] ?? '');
            $received = $this->removeExchangeItem($state, $playerIndex, $cardKey);
            if ($received === null) {
                return $state;
            }
            return $this->finalizeExchange($state, $received);
        }

        return $state;
    }

    private function finalizeExchange(array $state, ?string $received): array
    {
        $context = $state['flags']['exchangeContext'] ?? null;
        if (!is_array($context)) {
            return $state;
        }
        $initiator = (int) ($context['initiator'] ?? -1);
        $target = (int) ($context['target'] ?? -1);
        $offer = $context['offer'] ?? null;
        if ($offer !== null && $target >= 0) {
            $this->addCourseToInventory($state, $target, $offer);
            $this->log($state, sprintf('%s donne %s a %s.', $state['players'][$initiator]['username'], $offer, $state['players'][$target]['username']));
        }
        if ($received !== null && $initiator >= 0) {
            $this->addCourseToInventory($state, $initiator, $received);
            $this->log($state, sprintf('%s recoit %s en echange.', $state['players'][$initiator]['username'], $received));
        }

        $state['pending'] = null;
        $state['exchangePending'] = null;
        $state['phase'] = 'turn';
        unset($state['flags']['exchangeContext']);
        if (($state['status'] ?? null) !== 'ended' && $initiator >= 0) {
            $this->advanceTurn($state, $initiator);
        }

        return $state;
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    private function listExchangeableItems(array $state, int $playerIndex): array
    {
        $cards = [];
        $inventory = $state['players'][$playerIndex]['inventory'] ?? [];
        if (is_array($inventory)) {
            foreach ($inventory as $idx => $item) {
                if (!is_string($item) || $item === '') {
                    continue;
                }
                $cards[] = [
                    'id' => 'inventory:' . $idx,
                    'label' => $item,
                ];
            }
        }
        $basket = $state['players'][$playerIndex]['basket'] ?? [];
        if (is_array($basket)) {
            foreach ($basket as $idx => $item) {
                if (!is_string($item) || $item === '') {
                    continue;
                }
                $cards[] = [
                    'id' => 'basket:' . $idx,
                    'label' => $item,
                ];
            }
        }
        return $cards;
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    private function listExchangeTargets(array $state, int $playerIndex): array
    {
        $targets = [];
        foreach ($state['players'] ?? [] as $idx => $player) {
            if ($idx === $playerIndex) {
                continue;
            }
            $cards = $this->listExchangeableItems($state, (int) $idx);
            if ($cards === []) {
                continue;
            }
            $targets[] = [
                'id' => $player['id'] ?? null,
                'username' => $player['username'] ?? '',
                'isBot' => (bool) ($player['isBot'] ?? false),
            ];
        }
        return $targets;
    }

    private function removeExchangeItem(array &$state, int $playerIndex, string $key): ?string
    {
        if (strncmp($key, 'inventory:', 10) === 0) {
            $idx = (int) substr($key, 10);
            $inventory = &$state['players'][$playerIndex]['inventory'];
            if (!is_array($inventory) || !isset($inventory[$idx])) {
                return null;
            }
            $item = $inventory[$idx];
            unset($inventory[$idx]);
            $inventory = array_values($inventory);
            return is_string($item) ? $item : null;
        }
        if (strncmp($key, 'basket:', 7) === 0) {
            $idx = (int) substr($key, 7);
            $basket = &$state['players'][$playerIndex]['basket'];
            if (!is_array($basket) || !isset($basket[$idx])) {
                return null;
            }
            $item = $basket[$idx];
            unset($basket[$idx]);
            $basket = array_values($basket);
            $this->refreshCheckoutFlag($state, $playerIndex);
            return is_string($item) ? $item : null;
        }
        return null;
    }

    private function pickRandomExchangeItem(array &$state, int $playerIndex): ?string
    {
        $cards = $this->listExchangeableItems($state, $playerIndex);
        if ($cards === []) {
            return null;
        }
        $choice = $cards[array_rand($cards)];
        return $this->removeExchangeItem($state, $playerIndex, (string) ($choice['id'] ?? ''));
    }

    private function locatePlayerByIdentifier(array $state, $identifier): ?int
    {
        if ($identifier === null) {
            return null;
        }
        foreach ($state['players'] ?? [] as $index => $player) {
            if (($player['id'] ?? null) == $identifier) { // loose comparison to allow string/int
                return (int) $index;
            }
        }
        return null;
    }

    public function advanceBots(array $state): array
    {
        if (($state['status'] ?? null) !== 'playing') {
            return $state;
        }
        $turnIndex = (int) ($state['turnIndex'] ?? 0);
        $players = $state['players'] ?? [];
        if (!isset($players[$turnIndex]) || ($players[$turnIndex]['isBot'] ?? false) !== true) {
            return $state;
        }
        $pendingType = $state['pending']['type'] ?? null;
        if ($pendingType === 'exchange') {
            return $state;
        }
        if (!isset($state['flags']) || !is_array($state['flags'])) {
            $state['flags'] = [];
        }
        if (($state['flags']['botProcessing'] ?? false) === true) {
            return $state;
        }
        $now = (int) round(microtime(true) * 1000);
        $cooldown = (int) ($state['flags']['botCooldownUntil'] ?? 0);
        if ($now < $cooldown) {
            return $state;
        }
        $state['flags']['botProcessing'] = true;
        try {
            $state = $this->runBotTurns($state);
        } finally {
            $state['flags']['botProcessing'] = false;
        }
        $state['flags']['botCooldownUntil'] = $now + 2000;
        return $state;
    }

    private function startQuiz(array &$state, int $playerIndex): void
    {
        $card = $this->deckManager->drawCard($state, PanierExpressDeckManager::DECK_QUIZ, $this->randomizer);
        if ($card === null) {
            $this->log($state, 'La pioche Quiz est vide.', 'warning');
            return;
        }

        $choices = $card['options'] ?? [];
        $question = $card['question'] ?? 'Question';
        $answerIndex = (int) ($card['answer'] ?? $card['answerIndex'] ?? -1);

        $state['pending'] = [
            'type' => 'quiz',
            'playerId' => $state['players'][$playerIndex]['id'] ?? null,
            'question' => $question,
            'choices' => $choices,
            'answerIndex' => $answerIndex,
        ];
        $state['phase'] = 'quiz';

        $this->log($state, sprintf('Quiz pour %s : %s', $state['players'][$playerIndex]['username'], $question));
    }

    private function drawFromDeck(array &$state, int $playerIndex, string $deck): void
    {
        switch ($deck) {
            case 'course':
            case PanierExpressDeckManager::DECK_COURSES:
                $this->drawCourseCard($state, $playerIndex);
                break;
            case 'event':
            case PanierExpressDeckManager::DECK_EVENT:
                $this->drawEventCard($state, $playerIndex);
                break;
            case 'exchange':
            case PanierExpressDeckManager::DECK_EXCHANGE:
                $this->drawExchangeCard($state, $playerIndex);
                break;
            case 'quiz':
            case PanierExpressDeckManager::DECK_QUIZ:
                $this->startQuiz($state, $playerIndex);
                break;
            default:
                $this->log($state, 'Pioche inconnue pour Panier Express.', 'warning');
                break;
        }
    }

    private function adjustPosition(array &$state, int $playerIndex, int $delta, int $depth): void
    {
        $state['players'][$playerIndex]['position'] = max(1, min(
            self::BOARD_SIZE,
            (int)($state['players'][$playerIndex]['position'] ?? 1) + $delta
        ));
        $this->processTile($state, $playerIndex, $depth + 1);
    }

    private function findNextStandPosition(array $state, int $from): ?int
    {
        $tiles = $state['board']['tiles'] ?? [];
        foreach ($tiles as $tile) {
            $index = (int)($tile['index'] ?? 0);
            if ($index > $from && ($tile['type'] ?? 'action') === 'stand') {
                return $index;
            }
        }
        return null;
    }

    private function hasCompletedList(array $player): bool
    {
        $list = $player['shoppingList'] ?? [];
        $basket = $player['basket'] ?? [];
        if ($list === []) {
            return false;
        }
        foreach ($list as $item) {
            if (!in_array($item, $basket, true)) {
                return false;
            }
        }
        return true;
    }

    private function checkVictory(array &$state, int $playerIndex): void
    {
        if (($state['status'] ?? null) === 'ended') {
            return;
        }
        $player = $state['players'][$playerIndex];
        if (!($player['readyForCheckout'] ?? false)) {
            return;
        }
        if (($player['position'] ?? 1) !== self::BOARD_SIZE) {
            return;
        }

        $state['status'] = 'ended';
        $state['winner'] = $player['id'] ?? null;
        $state['phase'] = 'ended';
        $state['log'][] = [
            'type' => 'success',
            'message' => sprintf('%s termine sa liste et remporte la partie !', $player['username']),
        ];
    }

    private function advanceTurn(array &$state, int $currentPlayerIndex): void
    {
        if (($state['status'] ?? null) === 'ended') {
            return;
        }

        if (!isset($state['players']) || !is_array($state['players'])) {
            $state['players'] = [];
        }
        $players = &$state['players'];
        $count = count($players);
        if ($count === 0) {
            return;
        }

        if (!isset($state['flags']) || !is_array($state['flags'])) {
            $state['flags'] = [];
        }

        $coordinator = PanierExpressTurnCoordinator::forState($state, $currentPlayerIndex);
        $next = $coordinator->nextIndex();

        $directionResetId = $state['flags']['turnDirectionResetPlayer'] ?? null;
        if ($directionResetId !== null && ($players[$next]['id'] ?? null) === $directionResetId) {
            unset($state['flags']['turnDirectionResetPlayer']);
            $coordinator->resetDirection();
        }

        $coordinator->syncSkips($players);

        $state['flags']['turnDirection'] = $coordinator->getDirection();
        $state['turnIndex'] = $next;
        $state['round'] = $coordinator->getRound();
        $state['phase'] = 'turn';
        $state['lastRoll'] = null;

        $this->syncTurnMeta($state, $coordinator->getTurnState());
    }

    private function tileAt(array $state, int $position): ?array
    {
        foreach ($state['board']['tiles'] ?? [] as $tile) {
            if ((int)($tile['index'] ?? 0) === $position) {
                return $tile;
            }
        }
        return null;
    }

    private function normalizeText(string $value): string
    {
        $value = mb_strtolower($value);
        if (\function_exists('transliterator_transliterate')) {
            $value = transliterator_transliterate('Any-Latin; Latin-ASCII', $value) ?: $value;
        }
        return preg_replace('/[^a-z0-9 ]+/', ' ', $value) ?? $value;
    }

    public function presentState(array $state, User $viewer): array
    {
        $public = $state;
        unset($public['decks']);

        $username = (string) $viewer->getUsername();
        if (isset($public['players']) && is_array($public['players'])) {
            foreach ($public['players'] as $index => $player) {
                if (!is_array($player)) {
                    continue;
                }
                $public['players'][$index]['isBot'] = (bool) ($player['isBot'] ?? false);
                $public['players'][$index]['basket'] = array_values($player['basket'] ?? []);
                $public['players'][$index]['inventory'] = array_values($player['inventory'] ?? []);
                $public['players'][$index]['shoppingList'] = array_values($player['shoppingList'] ?? []);
                if (strcasecmp($player['username'] ?? '', $username) !== 0) {
                    $public['players'][$index]['inventory'] = [];
                    $public['players'][$index]['shoppingList'] = $this->remainingShoppingItems($player);
                }
            }
        }

        if (isset($public['pending']['answerIndex'])) {
            unset($public['pending']['answerIndex']);
        }

        if (isset($public['exchangePending'])) {
            $public['exchangePending'] = array_merge(
                $public['exchangePending'],
                ['type' => 'exchange']
            );
        }

        if (isset($public['log']) && is_array($public['log'])) {
            $public['log'] = array_slice(array_values($public['log']), -20);
        }

        return $public;
    }

    /**
     * @param array<string,mixed> $player
     * @return array<int,string>
     */
    private function remainingShoppingItems(array $player): array
    {
        $list = $player['shoppingList'] ?? [];
        $basket = $player['basket'] ?? [];
        if (!is_array($list) || !is_array($basket)) {
            return [];
        }
        return array_values(array_diff($list, $basket));
    }

    private function log(array &$state, string $message, string $type = 'info'): void
    {
        $state['log'][] = [
            'type' => $type,
            'message' => $message,
        ];
    }

    private function syncTurnMeta(array &$state, ?TurnState $turnState = null): void
    {
        $turnState = $turnState ?? PanierExpressTurnStateFactory::build($state, (int)($state['turnIndex'] ?? 0));
        $state['turn'] = $turnState->toArray();
    }
}



