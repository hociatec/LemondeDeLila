<?php

namespace App\Module\Game\GameCatalogue\JeuxDeCartes\VentsDansants\DameNature\Service;

use App\Module\Game\Bot\BotAllocator;
use App\Module\Game\Engine\GameEngineInterface;
use App\Module\Game\Entity\Room;
use App\Module\Game\Service\Participant;
use App\Module\Game\Service\ParticipantResolver;
use App\Module\Game\Shared\Action\Action;
use App\Module\User\Entity\User;

final class DameNatureGameService implements GameEngineInterface
{
    private const GAME_TYPE = 'dame-nature';
    private const TARGET_FAMILIES_TO_WIN = 4;
    private const MAX_POLLUTION = 12;

    private ?array $families = null;
    private ?array $familyMembersMap = null;
    private ?array $quizCards = null;
    private ?array $dangerCards = null;

    public function __construct(
        private ParticipantResolver $participants,
        private BotAllocator $botAllocator,
        private DameNatureReferenceService $reference
    ) {
    }

    public function getType(): string
    {
        return self::GAME_TYPE;
    }

    public function defaultState(Room $room): array
    {
        $players = $this->initialPlayers($room);
        $setup = $this->buildDeckSetup();

        $deck = $setup['deck'];
        shuffle($deck);

        $handSize = $this->initialHandSize(count($players));
        $this->dealHands($players, $deck, $handSize);

        $state = [
            'type' => self::GAME_TYPE,
            'status' => 'open',
            'phase' => 'open',
            'round' => 1,
            'turnIndex' => 0,
            'players' => $players,
            'deck' => array_values($deck),
            'discard' => [],
            'cards' => $setup['cards'],
            'quizAnswers' => $setup['quizAnswers'],
            'pollution' => 0,
            'log' => [],
            'pendingQuiz' => null,
            'familyMap' => $setup['familyMap'],
            'metadata' => [
                'handSize' => $handSize,
                'familyGoal' => self::TARGET_FAMILIES_TO_WIN,
                'maxPollution' => self::MAX_POLLUTION,
            ],
            'catalog' => [
                'families' => $this->familyCatalog(),
                'dangerCards' => $this->dangerCatalog(),
                'quizCount' => count($this->loadQuizCards()),
            ],
        ];

        $this->checkCompletedFamilies($state, 0);

        return $state;
    }

    public function startState(array $state): array
    {
        if (($state['status'] ?? null) === 'playing') {
            return $state;
        }

        $state['status'] = 'playing';
        $state['phase'] = 'turn';
        if (!isset($state['log']) || !is_array($state['log'])) {
            $state['log'] = [];
        }
        $state['log'][] = [
            'message' => 'La partie commence. Gardez Dame Nature en bonne sante !',
            'type' => 'info',
        ];

        return $state;
    }

    /**
     * @param array<int, Action|array<string, mixed>> $actions
     */
    public function applyActions(array $state, array $actions, Room $room, User $user): array
    {
        if (($state['status'] ?? null) === 'ended') {
            return $state;
        }

        foreach ($actions as $raw) {
            $payload = $this->normalizeActionPayload($raw);
            if ($payload === null) {
                continue;
            }
            $state = $this->apply($state, $payload, $room, $user);
            if (($state['status'] ?? null) === 'ended') {
                break;
            }
        }

        return $state;
    }

    public function apply(array $state, array $payload, Room $room, User $user): array
    {
        if (($state['status'] ?? null) === 'ended') {
            return $state;
        }

        $players = $state['players'] ?? [];
        $playerIndex = $this->locatePlayer($players, (int)$user->getId());
        if ($playerIndex === -1) {
            return $state;
        }

        $action = $this->normalizeActionName((string)($payload['action'] ?? $payload['command'] ?? ''));

        $next = match ($action) {
            DameNatureCommand::ASK_CARD => $this->handleAskCard($state, $payload, $playerIndex),
            DameNatureCommand::ANSWER_QUIZ => $this->handleQuizAnswer($state, $payload, $playerIndex),
            DameNatureCommand::DRAW => $this->handleDraw($state, $playerIndex),
            default => $state,
        };

        return $this->executeBotTurns($next);
    }

    public function advanceBots(array $state): array
    {
        if (($state['status'] ?? null) !== 'playing') {
            return $state;
        }

        return $this->executeBotTurns($state);
    }

    /**
     * @param Action|array<string, mixed> $action
     */
    private function normalizeActionPayload(Action|array $action): ?array
    {
        if ($action instanceof Action) {
            $payload = is_array($action->payload ?? null) ? $action->payload : [];
            if (isset($payload['command']) && !isset($payload['action'])) {
                $payload['action'] = $payload['command'];
            }
            if (!isset($payload['action'])) {
                $mapped = $this->mapGenericActionName($action->type);
                if ($mapped !== null) {
                    $payload['action'] = $mapped;
                }
            }
            $payload['action'] ??= $action->type;

            return $payload;
        }

        if (is_array($action)) {
            if (isset($action['command']) && !isset($action['action'])) {
                $action['action'] = $action['command'];
            }
            return $action;
        }

        return null;
    }

    private function mapGenericActionName(string $type): ?string
    {
        $normalized = strtoupper($type);
        return match ($normalized) {
            'ASK_CARD', 'REQUEST_CARD' => DameNatureCommand::ASK_CARD,
            'DRAW_CARD', 'DRAW' => DameNatureCommand::DRAW,
            'ANSWER_QUIZ', 'QUIZ_VALIDATE' => DameNatureCommand::ANSWER_QUIZ,
            default => null,
        };
    }

    private function normalizeActionName(string $action): string
    {
        $action = trim($action);
        if ($action === '') {
            return '';
        }
        $action = strtolower($action);
        $action = str_replace(
            ['dame_nature:', 'dame-nature:', 'dame_nature_', 'dame-nature_'],
            '',
            $action
        );

        return match ($action) {
            'ask_card', 'ask-card' => DameNatureCommand::ASK_CARD,
            'answer_quiz', 'answer-quiz' => DameNatureCommand::ANSWER_QUIZ,
            'draw', 'draw_card', 'draw-card' => DameNatureCommand::DRAW,
            default => $action,
        };
    }

    public function currentRound(array $state): int
    {
        return max(1, (int)($state['round'] ?? 1));
    }

    public function computeScore(array $state): ?array
    {
        $players = $state['players'] ?? [];
        if (empty($players)) {
            return null;
        }

        $summary = [];
        foreach ($players as $player) {
            $summary[] = [
                'id' => $player['id'],
                'username' => $player['username'],
                'families' => count($player['books'] ?? []),
                'hand' => count($player['hand'] ?? []),
                'isBot' => (bool)($player['isBot'] ?? false),
            ];
        }

        return [
            'status' => $state['status'] ?? 'playing',
            'pollution' => $state['pollution'] ?? 0,
            'maxPollution' => self::MAX_POLLUTION,
            'players' => $summary,
            'winner' => $state['winner'] ?? null,
            'outcome' => $state['outcome'] ?? null,
        ];
    }

    public function presentState(array $state, User $viewer): array
    {
        $public = $state;

        $viewerId = (int)$viewer->getId();
        $players = $state['players'] ?? [];
        foreach ($players as $index => $player) {
            $hand = $player['hand'] ?? [];
            $public['players'][$index]['handCount'] = count($hand);
            $public['players'][$index]['isBot'] = (bool)($player['isBot'] ?? false);
            if ($player['id'] === $viewerId) {
                $public['players'][$index]['hand'] = $this->describeHand($state, $hand);
            } else {
                $public['players'][$index]['hand'] = [];
            }
        }

        $public['deck'] = [
            'remaining' => count($state['deck'] ?? []),
        ];

        if (isset($public['pendingQuiz']['answerIndex'])) {
            unset($public['pendingQuiz']['answerIndex']);
        }
        unset($public['quizAnswers'], $public['familyMap']);

        return $public;
    }

    /**
     * @return array<int, array{id:int,username:string,hand:array<int,string>,books:array<int,string>}>
     */
    private function initialPlayers(Room $room): array
    {
        $participants = $this->participants->resolve($room);
        if ($participants === []) {
            throw new \RuntimeException('Aucun joueur n\'est disponible pour la partie Dame Nature.');
        }

        $players = [];
        foreach ($participants as $participant) {
            if (!$participant instanceof Participant) {
                continue;
            }
            $players[] = $this->playerFromParticipant($participant);
        }

        return $players;
    }

    private function playerFromParticipant(Participant $participant): array
    {
        return [
            'id' => $participant->id(),
            'username' => $participant->username(),
            'hand' => [],
            'books' => [],
            'isBot' => $participant->isBot(),
        ];
    }

    /**
     * @param array<int,array<string,mixed>> $players
     */
    private function createEphemeralBot(array $players): array
    {
        $names = array_map(
            static fn(array $player): string => (string)($player['username'] ?? ''),
            $players
        );
        $name = $this->botAllocator->pick($names);

        return [
            'id' => $this->generateBotId($players),
            'username' => $name,
            'hand' => [],
            'books' => [],
            'isBot' => true,
        ];
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

    /**
     * @return array{cards:array<string,array<string,mixed>>,deck:array<int,string>,quizAnswers:array<string,int>,familyMap:array<string,array<int,string>>}
     */
    private function buildDeckSetup(): array
    {
        $cards = [];
        $deck = [];
        $quizAnswers = [];
        $familyMap = [];

        foreach ($this->loadFamilies() as $family) {
            $familyId = (string)$family['id'];
            foreach ($family['members'] as $member) {
                $memberId = (string)$member['id'];
                $code = $this->familyCardCode($familyId, $memberId);
                $cards[$code] = [
                    'type' => 'family',
                    'familyId' => $familyId,
                    'familyName' => $family['name'],
                    'memberId' => $memberId,
                    'memberName' => $member['name'],
                    'role' => $member['role'],
                ];
                $deck[] = $code;
                $familyMap[$familyId][] = $code;
            }
        }

        foreach ($this->loadDangerCards() as $danger) {
            $code = 'danger:' . $danger['id'];
            $cards[$code] = [
                'type' => 'danger',
                'name' => $danger['name'],
                'description' => $danger['description'],
                'pollutionDelta' => (int)$danger['pollutionDelta'],
            ];
            $deck[] = $code;
        }

        foreach ($this->loadQuizCards() as $quiz) {
            $code = 'quiz:' . $quiz['id'];
            $cards[$code] = [
                'type' => 'quiz',
                'question' => $quiz['question'],
                'choices' => $quiz['choices'],
            ];
            $quizAnswers[$code] = (int)$quiz['answerIndex'];
            $deck[] = $code;
        }

        return [
            'cards' => $cards,
            'deck' => $deck,
            'quizAnswers' => $quizAnswers,
            'familyMap' => $familyMap,
        ];
    }

    /**
     * @param array<int,array<string,mixed>> $players
     * @param array<int,string> $deck
     */
    private function dealHands(array &$players, array &$deck, int $handSize): void
    {
        $playerCount = count($players);
        if ($playerCount === 0 || $handSize <= 0) {
            return;
        }

        for ($position = 0; $position < $handSize; $position++) {
            for ($playerIndex = 0; $playerIndex < $playerCount; $playerIndex++) {
                if (empty($deck)) {
                    return;
                }
                $code = array_shift($deck);
                if ($code === null) {
                    continue;
                }
                $players[$playerIndex]['hand'][] = $code;
            }
        }
    }

    private function initialHandSize(int $playerCount): int
    {
        return match (true) {
            $playerCount <= 2 => 7,
            $playerCount >= 5 => 5,
            default => 6,
        };
    }

    private function handleAskCard(array $state, array $payload, int $playerIndex): array
    {
        if (($state['phase'] ?? 'turn') !== 'turn') {
            return $state;
        }

        $familyId = (string)($payload['familyId'] ?? '');
        $memberId = (string)($payload['memberId'] ?? '');
        $targetId = (int)($payload['target'] ?? 0);

        if ($familyId === '' || $memberId === '' || $targetId === 0) {
            return $state;
        }

        $cardCode = $this->familyCardCode($familyId, $memberId);
        if (!isset($state['cards'][$cardCode])) {
            return $state;
        }

        $targetIndex = $this->locatePlayer($state['players'], $targetId);
        if ($targetIndex === -1 || $targetIndex === $playerIndex) {
            return $state;
        }

        $hand = $state['players'][$playerIndex]['hand'];
        $ownsFamilyCard = false;
        foreach ($hand as $code) {
            if (isset($state['cards'][$code]) && $state['cards'][$code]['type'] === 'family' && $state['cards'][$code]['familyId'] === $familyId) {
                $ownsFamilyCard = true;
                break;
            }
        }
        if (!$ownsFamilyCard) {
            return $state;
        }

        $targetHand = $state['players'][$targetIndex]['hand'];
        $cardPosition = array_search($cardCode, $targetHand, true);
        $card = $state['cards'][$cardCode];
        if ($cardPosition === false) {
            $state['log'][] = [
                'message' => sprintf("%s demande %s a %s... sans succes.", $state['players'][$playerIndex]['username'], $card['memberName'], $state['players'][$targetIndex]['username']),
                'type' => 'info',
            ];
            $drawResult = $this->drawCard($state, $playerIndex, 'ask-failed');
            if (!$drawResult['pendingQuiz']) {
                $this->advanceTurn($state);
            }
            $this->checkPollutionThreshold($state);
            return $state;
        }

        array_splice($state['players'][$targetIndex]['hand'], $cardPosition, 1);
        $state['players'][$playerIndex]['hand'][] = $cardCode;
        $state['log'][] = [
            'message' => sprintf("%s recoit %s de %s.", $state['players'][$playerIndex]['username'], $card['memberName'], $state['players'][$targetIndex]['username']),
            'type' => 'success',
        ];

        $this->checkCompletedFamilies($state, $playerIndex);
        $this->checkPollutionThreshold($state);

        return $state;
    }

    private function handleDraw(array $state, int $playerIndex): array
    {
        if (($state['phase'] ?? 'turn') !== 'turn') {
            return $state;
        }

        $drawResult = $this->drawCard($state, $playerIndex, 'manual');
        if (!$drawResult['pendingQuiz']) {
            $this->advanceTurn($state);
        }
        $this->checkPollutionThreshold($state);

        return $state;
    }

    private function executeBotTurns(array $state): array
    {
        while (($state['status'] ?? null) !== 'ended') {
            $turnIndex = (int)($state['turnIndex'] ?? 0);
            $players = $state['players'] ?? [];
            if (!isset($players[$turnIndex]) || ($players[$turnIndex]['isBot'] ?? false) !== true) {
                break;
            }

            $playerId = $players[$turnIndex]['id'] ?? null;
            if ($playerId !== null && $this->isPendingQuizFor($state, $playerId)) {
                $choice = $this->pickBotQuizChoice($state['pendingQuiz'] ?? null);
                $state = $this->handleQuizAnswer($state, ['choice' => $choice], $turnIndex);
                continue;
            }

            $askPayload = $this->buildBotAskPayload($state, $turnIndex);
            if ($askPayload !== null) {
                $state = $this->handleAskCard($state, $askPayload, $turnIndex);
            } else {
                $state = $this->handleDraw($state, $turnIndex);
            }

            if (($state['status'] ?? null) !== 'playing') {
                break;
            }

            $players = $state['players'];
            if (!isset($players[$state['turnIndex'] ?? $turnIndex])) {
                break;
            }

            if (($players[$state['turnIndex'] ?? $turnIndex]['isBot'] ?? false) !== true) {
                break;
            }

            if ($state['turnIndex'] === $turnIndex && !$this->isPendingQuizFor($state, $playerId ?? 0)) {
                break;
            }
        }

        return $state;
    }

    private function isPendingQuizFor(array $state, int $playerId): bool
    {
        $pending = $state['pendingQuiz'] ?? null;
        if (!is_array($pending)) {
            return false;
        }
        return (int)($pending['playerId'] ?? 0) === $playerId;
    }

    private function pickBotQuizChoice(?array $pending): int
    {
        if (!is_array($pending)) {
            return 0;
        }
        $choices = $pending['choices'] ?? [];
        if (!is_array($choices) || $choices === []) {
            return 0;
        }
        $max = count($choices) - 1;
        return max(0, random_int(0, $max));
    }

    private function buildBotAskPayload(array $state, int $playerIndex): ?array
    {
        $players = $state['players'] ?? [];
        $player = $players[$playerIndex] ?? null;
        if (!$player) {
            return null;
        }

        $hand = $player['hand'] ?? [];
        if ($hand === []) {
            return null;
        }

        $familyCandidates = [];
        foreach ($hand as $code) {
            $definition = $state['cards'][$code] ?? null;
            if (!is_array($definition) || ($definition['type'] ?? null) !== 'family') {
                continue;
            }
            $familyId = $definition['familyId'] ?? null;
            if ($familyId === null) {
                continue;
            }
            $familyCandidates[$familyId] = true;
        }

        if ($familyCandidates === []) {
            return null;
        }

        $familyIds = array_keys($familyCandidates);
        $familyId = $familyIds[random_int(0, count($familyIds) - 1)];
        $familyMap = $state['familyMap'][$familyId] ?? [];
        if (!is_array($familyMap) || $familyMap === []) {
            return null;
        }

        $owned = array_flip($hand);
        $candidates = array_values(array_filter($familyMap, static function ($code) use ($owned): bool {
            return !isset($owned[$code]);
        }));
        if ($candidates === []) {
            $candidates = $familyMap;
        }

        $choiceCode = $candidates[random_int(0, count($candidates) - 1)];
        $parts = explode(':', $choiceCode, 3);
        if (count($parts) < 3) {
            return null;
        }
        $memberId = $parts[2];

        $targets = [];
        foreach ($players as $idx => $candidate) {
            if ($idx === $playerIndex) {
                continue;
            }
            if (($candidate['status'] ?? 'alive') === 'eliminated') {
                continue;
            }
            $targets[] = $candidate;
        }

        if ($targets === []) {
            return null;
        }

        $target = $targets[random_int(0, count($targets) - 1)];

        return [
            'familyId' => $familyId,
            'memberId' => $memberId,
            'target' => (int)($target['id'] ?? 0),
        ];
    }

    private function handleQuizAnswer(array $state, array $payload, int $playerIndex): array
    {
        $pending = $state['pendingQuiz'] ?? null;
        if (!$pending || ($pending['playerId'] ?? null) !== $state['players'][$playerIndex]['id']) {
            return $state;
        }

        $choice = isset($payload['choice']) ? (int)$payload['choice'] : null;
        if ($choice === null) {
            return $state;
        }

        $correctIndex = (int)($pending['answerIndex'] ?? -1);
        $isCorrect = $choice === $correctIndex;

        if ($isCorrect) {
            if (($state['pollution'] ?? 0) > 0) {
                $state['pollution']--;
            }
            $state['log'][] = [
                'message' => sprintf("%s repond correctement au quiz et retire un jeton pollution.", $state['players'][$playerIndex]['username']),
                'type' => 'success',
            ];
        } else {
            $state['pollution'] = min(self::MAX_POLLUTION, ($state['pollution'] ?? 0) + 1);
            $state['log'][] = [
                'message' => sprintf("%s se trompe sur la question et ajoute un jeton pollution.", $state['players'][$playerIndex]['username']),
                'type' => 'warning',
            ];
        }

        $state['pendingQuiz'] = null;
        $state['phase'] = 'turn';

        $this->checkPollutionThreshold($state);
        if (($state['status'] ?? 'playing') === 'playing') {
            $this->advanceTurn($state);
        }

        return $state;
    }

    /**
     * @return array{card:?string,type:?string,pendingQuiz:bool}
     */
    private function drawCard(array &$state, int $playerIndex, string $context): array
    {
        if (empty($state['deck'])) {
            $state['log'][] = [
                'message' => 'La pioche est vide.',
                'type' => 'info',
            ];
            return ['card' => null, 'type' => null, 'pendingQuiz' => false];
        }

        $code = array_shift($state['deck']);
        if (!isset($state['cards'][$code])) {
            return ['card' => null, 'type' => null, 'pendingQuiz' => false];
        }

        $card = $state['cards'][$code];
        $type = $card['type'];

        if ($type === 'family') {
            $state['players'][$playerIndex]['hand'][] = $code;
            $state['log'][] = [
                'message' => sprintf("%s pioche %s.", $state['players'][$playerIndex]['username'], $card['memberName']),
                'type' => 'info',
            ];
            $this->checkCompletedFamilies($state, $playerIndex);
            return ['card' => $code, 'type' => $type, 'pendingQuiz' => false];
        }

        if ($type === 'danger') {
            $state['discard'][] = $code;
            $delta = (int)($card['pollutionDelta'] ?? 0);
            if ($delta > 0) {
                $state['pollution'] = min(self::MAX_POLLUTION, ($state['pollution'] ?? 0) + $delta);
                $state['log'][] = [
                    'message' => sprintf("%s revele %s (+%d pollution).", $state['players'][$playerIndex]['username'], $card['name'], $delta),
                    'type' => 'danger',
                ];
            } elseif ($delta < 0) {
                $state['pollution'] = max(0, ($state['pollution'] ?? 0) + $delta);
                $state['log'][] = [
                    'message' => sprintf("%s revele %s (%d pollution).", $state['players'][$playerIndex]['username'], $card['name'], $delta),
                    'type' => 'success',
                ];
            }
            return ['card' => $code, 'type' => $type, 'pendingQuiz' => false];
        }

        if ($type === 'quiz') {
            $state['discard'][] = $code;
            $state['pendingQuiz'] = [
                'card' => $code,
                'playerId' => $state['players'][$playerIndex]['id'],
                'question' => $card['question'],
                'choices' => $card['choices'],
                'answerIndex' => $state['quizAnswers'][$code] ?? -1,
            ];
            $state['phase'] = 'quiz';
            $state['log'][] = [
                'message' => sprintf("%s doit repondre a un quiz: %s", $state['players'][$playerIndex]['username'], $card['question']),
                'type' => 'quiz',
            ];
            return ['card' => $code, 'type' => $type, 'pendingQuiz' => true];
        }

        return ['card' => null, 'type' => null, 'pendingQuiz' => false];
    }

    private function checkCompletedFamilies(array &$state, int $playerIndex): void
    {
        $player = $state['players'][$playerIndex];
        $hand = $player['hand'];
        $completed = $player['books'] ?? [];
        $familyMap = $state['familyMap'] ?? [];

        foreach ($familyMap as $familyId => $codes) {
            if (in_array($familyId, $completed, true)) {
                continue;
            }
            $hasAllCards = true;
            foreach ($codes as $code) {
                if (!in_array($code, $hand, true)) {
                    $hasAllCards = false;
                    break;
                }
            }
            if (!$hasAllCards) {
                continue;
            }

            foreach ($codes as $code) {
                $position = array_search($code, $state['players'][$playerIndex]['hand'], true);
                if ($position !== false) {
                    array_splice($state['players'][$playerIndex]['hand'], $position, 1);
                }
            }
            $state['players'][$playerIndex]['books'][] = $familyId;
            $completed[] = $familyId;

            $familyName = $this->familyNameById($familyId);
            $state['log'][] = [
                'message' => sprintf("%s complete la famille %s.", $state['players'][$playerIndex]['username'], $familyName),
                'type' => 'success',
            ];

            if (count($state['players'][$playerIndex]['books']) >= self::TARGET_FAMILIES_TO_WIN) {
                if (($state['pollution'] ?? 0) < self::MAX_POLLUTION) {
                    $state['status'] = 'ended';
                    $state['winner'] = $state['players'][$playerIndex]['id'];
                    $state['outcome'] = 'families';
                    $state['log'][] = [
                        'message' => sprintf("%s remporte la partie en protegeant Dame Nature !", $state['players'][$playerIndex]['username']),
                        'type' => 'success',
                    ];
                }
            }
        }

        $state['players'][$playerIndex]['hand'] = array_values($state['players'][$playerIndex]['hand']);
    }

    private function checkPollutionThreshold(array &$state): void
    {
        if (($state['pollution'] ?? 0) < self::MAX_POLLUTION) {
            return;
        }
        $state['status'] = 'ended';
        $state['winner'] = null;
        $state['outcome'] = 'pollution';
        $state['log'][] = [
            'message' => 'Dame Nature est submergee par la pollution. Tous les joueurs perdent.',
            'type' => 'danger',
        ];
    }

    private function advanceTurn(array &$state): void
    {
        $players = $state['players'] ?? [];
        $playerCount = count($players);
        if ($playerCount === 0) {
            return;
        }
        $current = (int)($state['turnIndex'] ?? 0);
        $next = ($current + 1) % $playerCount;
        if ($next === 0) {
            $state['round'] = $this->currentRound($state) + 1;
        }

        $state['turnIndex'] = $next;
        $state['phase'] = 'turn';
    }

    private function describeHand(array $state, array $hand): array
    {
        $cards = [];
        foreach ($hand as $code) {
            $definition = $state['cards'][$code] ?? null;
            if (!$definition) {
                continue;
            }
            $cards[] = [
                'code' => $code,
                'type' => $definition['type'],
                'familyId' => $definition['familyId'] ?? null,
                'familyName' => $definition['familyName'] ?? null,
                'memberName' => $definition['memberName'] ?? ($definition['name'] ?? null),
                'role' => $definition['role'] ?? null,
            ];
        }
        return $cards;
    }

    private function locatePlayer(array $players, int $userId): int
    {
        foreach ($players as $index => $player) {
            if ((int)$player['id'] === $userId) {
                return $index;
            }
        }
        return -1;
    }

    private function familyCardCode(string $familyId, string $memberId): string
    {
        return sprintf('family:%s:%s', $familyId, $memberId);
    }

    /**
     * @return array<int,array{id:string,name:string,members:array<int,array{id:string,name:string,role:string}>}>
     */
    private function loadFamilies(): array
    {
        if ($this->families !== null) {
            return $this->families;
        }
        $this->families = $this->reference->families();
        return $this->families;
    }

    /**
     * @return array<int,array{id:string,name:string,description:string,pollutionDelta:int}>
     */
    private function loadDangerCards(): array
    {
        if ($this->dangerCards !== null) {
            return $this->dangerCards;
        }
        $this->dangerCards = $this->reference->dangerCards();
        return $this->dangerCards;
    }

    /**
     * @return array<int,array{id:string,question:string,choices:array<int,string>,answerIndex:int}>
     */
    private function loadQuizCards(): array
    {
        if ($this->quizCards !== null) {
            return $this->quizCards;
        }
        $this->quizCards = $this->reference->quizCards();
        return $this->quizCards;
    }

    /**
     * @return array<int,array{id:string,name:string,members:array<int,array{id:string,name:string,role:string}>}>
     */
    private function familyCatalog(): array
    {
        return $this->loadFamilies();
    }

    /**
     * @return array<int,array{id:string,name:string,pollutionDelta:int}>
     */
    private function dangerCatalog(): array
    {
        $danger = [];
        foreach ($this->loadDangerCards() as $card) {
            $danger[] = [
                'id' => $card['id'],
                'name' => $card['name'],
                'pollutionDelta' => (int)$card['pollutionDelta'],
            ];
        }
        return $danger;
    }

    private function familyNameById(string $familyId): string
    {
        foreach ($this->loadFamilies() as $family) {
            if ($family['id'] === $familyId) {
                return $family['name'];
            }
        }
        return ucfirst($familyId);
    }

}
