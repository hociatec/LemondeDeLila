<?php

namespace App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Service;

use App\Module\Game\Bot\BotAllocator;
use App\Module\Game\Engine\GameEngineInterface;
use App\Module\Game\Entity\Room;
use App\Module\Game\Service\Participant;
use App\Module\Game\Service\ParticipantResolver;
use App\Module\User\Entity\User;
use App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Service\PanierExpressCommand;
use App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Service\Support\PanierExpressDeckManager;
use App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Service\Support\NativePanierExpressRandomizer;
use App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Service\Support\PanierExpressRandomizerInterface;
use App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Service\Support\PanierExpressTileAction;
use App\Module\Game\GameCatalogue\JeuxDePlateaux\LesQuatreVents\PanierExpress\Service\Support\PanierExpressTileResolver;

final class PanierExpressGameService implements GameEngineInterface
{
    private const GAME_TYPE = 'panier-express';
    private const BOARD_SIZE = 40;
    private const MAX_CHAINED_ACTIONS = 5;

    public function __construct(
        private readonly PanierExpressService $reference,
        private readonly PanierExpressDeckManager $deckManager,
        private readonly PanierExpressTileResolver $tileResolver,
        private readonly ParticipantResolver $participants,
        private readonly BotAllocator $botAllocator,
        private readonly PanierExpressRandomizerInterface $randomizer = new NativePanierExpressRandomizer(),
    ) {
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

        if (count($players) < 2) {
            $players[] = $this->createEphemeralBot($players, $data['shoppingLists'] ?? []);
        }

        $state = [
            'type' => self::GAME_TYPE,
            'status' => 'playing',
            'phase' => 'turn',
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
            'log' => [[
                'type' => 'info',
                'message' => 'Bienvenue au marché ! Lancez le dé pour commencer.',
            ]],
            'players' => $players,
            'lastRoll' => null,
        ];

        return $this->runBotTurns($state);
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
        $pending = $state['pending']['type'] ?? null;

        if ($pending === 'quiz') {
            if ($action === PanierExpressCommand::ANSWER_QUIZ) {
                $state = $this->handleQuizAnswer($state, $payload, $playerIndex);
                return $this->runBotTurns($state);
            }
            return $state;
        }

        if ($action === PanierExpressCommand::ROLL) {
            $state = $this->handleRoll($state, $payload, $playerIndex);
            return $this->runBotTurns($state);
        }

        return $this->runBotTurns($state);
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

    private function runBotTurns(array $state): array
    {
        while (($state['status'] ?? null) === 'playing') {
            $turnIndex = (int) ($state['turnIndex'] ?? 0);
            $players = $state['players'] ?? [];
            if (!isset($players[$turnIndex]) || ($players[$turnIndex]['isBot'] ?? false) !== true) {
                break;
            }

            $playerId = $players[$turnIndex]['id'] ?? null;
            $pending = $state['pending']['type'] ?? null;
            if ($pending === 'quiz' && $this->isPendingForPlayer($state, $playerId)) {
                $choices = $state['pending']['choices'] ?? [];
                $choice = $choices && is_array($choices)
                    ? random_int(0, max(0, count($choices) - 1))
                    : 0;
                $state = $this->handleQuizAnswer($state, ['choice' => $choice], $turnIndex);
                continue;
            }

            if ($pending !== null) {
                break;
            }

            $state = $this->handleRoll($state, [], $turnIndex);

            if (($state['status'] ?? null) !== 'playing') {
                break;
            }

            if ((int) ($state['turnIndex'] ?? -1) === $turnIndex) {
                break;
            }
        }

        return $state;
    }

    private function isPendingForPlayer(array $state, ?int $playerId): bool
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

        return $state;
    }

    private function runBotTurns(array $state): array
    {
        while (($state['status'] ?? null) === 'playing') {
            $turnIndex = (int) ($state['turnIndex'] ?? 0);
            $players = $state['players'] ?? [];
            if (!isset($players[$turnIndex]) || ($players[$turnIndex]['isBot'] ?? false) !== true) {
                break;
            }

            $playerId = $players[$turnIndex]['id'] ?? null;
            if ($this->isPendingQuizFor($state, $playerId)) {
                $choices = $state['pending']['choices'] ?? [];
                $choice = $choices && is_array($choices)
                    ? random_int(0, max(0, count($choices) - 1))
                    : 0;
                $state = $this->handleQuizAnswer($state, ['choice' => $choice], $turnIndex);
                continue;
            }

            if (($state['phase'] ?? 'turn') !== 'turn' || ($state['pending']['type'] ?? null) !== null) {
                break;
            }

            $state = $this->handleRoll($state, [], $turnIndex);

            if (($state['status'] ?? null) !== 'playing') {
                break;
            }

            if ((int) ($state['turnIndex'] ?? -1) === $turnIndex) {
                break;
            }
        }

        return $state;
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
    }

    private function drawEventCard(array &$state, int $playerIndex): void
    {
        $card = $this->deckManager->drawCard($state, PanierExpressDeckManager::DECK_EVENT, $this->randomizer);
        if ($card === null) {
            $this->log($state, 'La pioche Événement est vide.', 'warning');
            return;
        }

        $title = $card['title'] ?? 'Événement';
        $effect = $card['effect'] ?? '';

        $this->log($state, sprintf('Carte événement : %s. %s', $title, $effect));

        $normalized = $this->normalizeText($effect);
        if (str_contains($normalized, 'avance de 2')) {
            $this->adjustPosition($state, $playerIndex, 2, 0);
            return;
        }
        if (str_contains($normalized, 'recule de 3')) {
            $this->adjustPosition($state, $playerIndex, -3, 0);
            return;
        }
        if (str_contains($normalized, 'perds ton prochain tour') || str_contains($normalized, 'perd ton prochain tour')) {
            $state['players'][$playerIndex]['skipTurns'] = ($state['players'][$playerIndex]['skipTurns'] ?? 0) + 1;
        }
        if (str_contains($normalized, 'pioche une carte courses')) {
            $this->drawCourseCard($state, $playerIndex);
        }
    }

    private function drawExchangeCard(array &$state, int $playerIndex): void
    {
        $card = $this->deckManager->drawCard($state, PanierExpressDeckManager::DECK_EXCHANGE, $this->randomizer);
        if ($card === null) {
            $this->log($state, 'La pioche Échange est vide.', 'warning');
            return;
        }

        $title = $card['title'] ?? 'Échange';
        $effect = $card['effect'] ?? '';

        $this->log($state, sprintf('Carte échange : %s. %s', $title, $effect));
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

        $players = $state['players'] ?? [];
        $count = count($players);
        if ($count === 0) {
            return;
        }

        $next = $currentPlayerIndex;
        $safety = 0;

        do {
            $next = ($next + 1) % $count;
            if ($next === 0) {
                $state['round'] = $this->currentRound($state) + 1;
            }
            $safety++;
            if ($safety > $count) {
                break;
            }
        } while (($players[$next]['skipTurns'] ?? 0) > 0);

        if (($players[$next]['skipTurns'] ?? 0) > 0) {
            $state['players'][$next]['skipTurns']--;
            $state['log'][] = [
                'type' => 'info',
                'message' => sprintf('%s saute son tour.', $state['players'][$next]['username']),
            ];
            $this->advanceTurn($state, $next);
            return;
        }

        $state['turnIndex'] = $next;
        $state['phase'] = 'turn';
        $state['lastRoll'] = null;
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
}
