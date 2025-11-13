package com.lemondelila.client.gamelogic.damenature.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureConfig;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureEngine;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureSession;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureSessionStore;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureState;
import com.lemondelila.client.user.model.ClientSession;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.InputStream;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Random;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

/**
 * Fournit un mode local pour Dame Nature lorsque le service distant n'est pas disponible.
 * Rejoue la logique côté client à partir des données du framework backend.
 */
public final class LocalDameNatureService {

    private static final Logger LOGGER = LoggerFactory.getLogger(LocalDameNatureService.class);

    private static final int MAX_POLLUTION = 12;
    private static final int TARGET_FAMILIES_TO_WIN = 4;
    private static final int MAX_LOG_ENTRIES = 120;
    private static final List<String> BOT_NAMES = List.of(
            "Bot Camélia",
            "Bot Iris",
            "Bot Chêne",
            "Bot Gentiane",
            "Bot Mélèze"
    );

    private final TaskScheduler scheduler;
    private final DameNatureEngine engine;
    private final DameNatureSessionStore sessionStore;
    private final ObjectMapper mapper = new ObjectMapper();
    private final Random random = new Random();

    private final List<FamilyData> families;
    private final List<DangerData> dangers;
    private final List<QuizData> quizzes;
    private final Map<String, String> familyNameById;
    private final Map<String, DangerData> dangerByCode;
    private final Map<String, QuizData> quizByCode;
    private final AtomicInteger roomSequence = new AtomicInteger(10_000);

    private final Object lock = new Object();
    private LocalGame currentGame;

    @Inject
    public LocalDameNatureService(TaskScheduler scheduler,
                                  DameNatureEngine engine,
                                  DameNatureSessionStore sessionStore) {
        this.scheduler = Objects.requireNonNull(scheduler, "scheduler");
        this.engine = Objects.requireNonNull(engine, "engine");
        this.sessionStore = Objects.requireNonNull(sessionStore, "sessionStore");
        try {
            this.families = loadFamilies();
            this.dangers = loadDangers();
            this.quizzes = loadQuizzes();
        } catch (Exception ex) {
            throw new IllegalStateException("Impossible de charger les données locales Dame Nature", ex);
        }
        this.familyNameById = families.stream()
                .collect(Collectors.toUnmodifiableMap(FamilyData::id, FamilyData::name));
        this.dangerByCode = dangers.stream()
                .collect(Collectors.toUnmodifiableMap(danger -> "danger:" + danger.id(), danger -> danger));
        this.quizByCode = quizzes.stream()
                .collect(Collectors.toUnmodifiableMap(quiz -> "quiz:" + quiz.id(), quiz -> quiz));
    }

    public CompletableFuture<DameNatureSession> startNewGame(ClientSession session,
                                                            DameNatureConfig configuration) {
        return runAsync(() -> {
            synchronized (lock) {
                DameNatureConfig sanitized = configuration != null ? configuration : DameNatureConfig.defaultConfig();
                LocalGame game = createInitialGame(resolveUsername(session), sanitized);
                currentGame = game;
                DameNatureSession built = toSession(game);
                sessionStore.save(built);
                LOGGER.info("Démarrage d'une partie Dame Nature en mode local (room #{}) avec {}", game.roomId, sanitized);
                return built;
            }
        });
    }

    public CompletableFuture<DameNatureSession> refresh(int roomId, ClientSession session) {
        return runAsync(() -> {
            synchronized (lock) {
                ensureGameExists(roomId);
                processBots(currentGame);
                DameNatureSession built = toSession(currentGame);
                sessionStore.save(built);
                return built;
            }
        });
    }

    public CompletableFuture<DameNatureSession> askCard(int roomId,
                                                        ClientSession session,
                                                        int targetId,
                                                        String familyId,
                                                        String memberId) {
        return runAsync(() -> {
            synchronized (lock) {
                LocalGame game = ensureGameExists(roomId);
                int playerIndex = game.userIndex;
                int targetIndex = indexOfPlayer(game, targetId);
                if (targetIndex == -1) {
                    throw new IllegalArgumentException("Joueur cible introuvable");
                }
                handleAskCard(game, playerIndex, targetIndex, familyId, memberId);
                processBots(game);
                DameNatureSession built = toSession(game);
                sessionStore.save(built);
                return built;
            }
        });
    }

    public CompletableFuture<DameNatureSession> draw(int roomId, ClientSession session) {
        return runAsync(() -> {
            synchronized (lock) {
                LocalGame game = ensureGameExists(roomId);
                handleDraw(game, game.userIndex);
                processBots(game);
                DameNatureSession built = toSession(game);
                sessionStore.save(built);
                return built;
            }
        });
    }

    public CompletableFuture<DameNatureSession> answerQuiz(int roomId, ClientSession session, int choice) {
        return runAsync(() -> {
            synchronized (lock) {
                LocalGame game = ensureGameExists(roomId);
                handleQuizAnswer(game, game.userIndex, choice);
                processBots(game);
                DameNatureSession built = toSession(game);
                sessionStore.save(built);
                return built;
            }
        });
    }

    private CompletableFuture<DameNatureSession> runAsync(TaskSupplier supplier) {
        CompletableFuture<DameNatureSession> future = new CompletableFuture<>();
        scheduler.runAsync(() -> {
            try {
                future.complete(supplier.get());
            } catch (Exception ex) {
                future.completeExceptionally(ex);
            }
        });
        return future;
    }

    private LocalGame createInitialGame(String username, DameNatureConfig configuration) {
        LocalGame game = new LocalGame(roomSequence.incrementAndGet(), configuration);
        game.status = "playing";
        game.phase = Phase.TURN;
        game.round = 1;
        game.turnIndex = 0;
        game.pollution = 0;
        game.userIndex = 0;

        List<PlayerState> players = new ArrayList<>();
        players.add(new PlayerState(1, username, false));
        for (int i = 0; i < configuration.botCount(); i++) {
            String botName = BOT_NAMES.get(i % BOT_NAMES.size());
            players.add(new PlayerState(2 + i, botName, true));
        }
        game.players = players;

        DeckSetup setup = buildDeckSetup(configuration);
        List<String> deck = new ArrayList<>(setup.deck());
        Collections.shuffle(deck, random);
        game.deck = new ArrayDeque<>(deck);
        game.cardDefinitions = setup.cardDefinitions();
        game.cardMetadata = setup.cardMetadata();
        game.familyMap = setup.familyMap();

        game.log.add(new LogEntry("La partie commence. Gardez Dame Nature en bonne santé !", "info"));

        int handSize = initialHandSize(players.size());
        dealHands(game, handSize);
        for (int i = 0; i < players.size(); i++) {
            checkCompletedFamilies(game, i);
        }
        processBots(game); // Permet aux bots de jouer si des quiz démarrent immédiatement
        return game;
    }

    private DeckSetup buildDeckSetup(DameNatureConfig configuration) {
        Map<String, DameNatureState.CardDefinition> definitions = new HashMap<>();
        Map<String, CardMetadata> metadata = new HashMap<>();
        Map<String, List<String>> familyMap = new HashMap<>();
        List<String> deck = new ArrayList<>();

        for (FamilyData family : families) {
            for (FamilyMemberData member : family.members()) {
                String code = familyCardCode(family.id(), member.id());
                definitions.put(code, new DameNatureState.CardDefinition(
                        "family",
                        family.id(),
                        family.name(),
                        member.id(),
                        member.name(),
                        member.role()
                ));
                metadata.put(code, CardMetadata.family(
                        code,
                        family.id(),
                        family.name(),
                        member.id(),
                        member.name(),
                        member.role()
                ));
                deck.add(code);
                familyMap.computeIfAbsent(family.id(), key -> new ArrayList<>()).add(code);
            }
        }

        if (configuration.includeDangerCards()) {
            for (DangerData danger : dangers) {
                String code = "danger:" + danger.id();
                definitions.put(code, new DameNatureState.CardDefinition(
                        "danger",
                        null,
                        null,
                        null,
                        danger.name(),
                        null
                ));
                metadata.put(code, CardMetadata.danger(code, danger.name(), danger.pollutionDelta()));
                deck.add(code);
            }
        }

        if (configuration.includeQuizCards()) {
            for (QuizData quiz : quizzes) {
                String code = "quiz:" + quiz.id();
                definitions.put(code, new DameNatureState.CardDefinition(
                        "quiz",
                        null,
                        null,
                        null,
                        null,
                        null
                ));
                metadata.put(code, CardMetadata.quiz(code, quiz.question(), quiz.choices()));
                deck.add(code);
            }
        }

        return new DeckSetup(deck, definitions, metadata, familyMap);
    }

    private void dealHands(LocalGame game, int handSize) {
        int playerCount = game.players.size();
        if (playerCount == 0 || handSize <= 0) {
            return;
        }
        for (int position = 0; position < handSize; position++) {
            for (int playerIndex = 0; playerIndex < playerCount; playerIndex++) {
                if (game.deck.isEmpty()) {
                    return;
                }
                String code = game.deck.pollFirst();
                if (code != null) {
                    game.players.get(playerIndex).hand.add(code);
                }
            }
        }
    }

    private int initialHandSize(int playerCount) {
        if (playerCount <= 2) {
            return 7;
        }
        if (playerCount >= 5) {
            return 5;
        }
        return 6;
    }

    private void handleAskCard(LocalGame game,
                               int playerIndex,
                               int targetIndex,
                               String familyId,
                               String memberId) {
        if (game.phase != Phase.TURN || familyId == null || familyId.isBlank() || memberId == null || memberId.isBlank()) {
            return;
        }
        if (targetIndex == playerIndex || targetIndex < 0 || targetIndex >= game.players.size()) {
            return;
        }
        String cardCode = familyCardCode(familyId, memberId);
        CardMetadata definition = game.cardMetadata.get(cardCode);
        if (definition == null || !"family".equals(definition.type())) {
            return;
        }
        PlayerState actor = game.players.get(playerIndex);
        PlayerState target = game.players.get(targetIndex);

        boolean ownsFamily = actor.hand.stream()
                .map(game.cardMetadata::get)
                .filter(Objects::nonNull)
                .anyMatch(meta -> "family".equals(meta.type()) && familyId.equals(meta.familyId()));
        if (!ownsFamily) {
            return;
        }

        int cardPosition = target.hand.indexOf(cardCode);
        if (cardPosition == -1) {
            game.log.add(new LogEntry(
                    actor.username + " demande " + definition.memberName() + " à " + target.username + "... sans succès.",
                    "info"
            ));
            DrawResult drawResult = drawCard(game, playerIndex);
            if (!drawResult.pendingQuiz()) {
                advanceTurn(game);
            }
            checkPollutionThreshold(game);
            return;
        }

        target.hand.remove(cardPosition);
        actor.hand.add(cardCode);
        game.log.add(new LogEntry(
                actor.username + " reçoit " + definition.memberName() + " de " + target.username + ".",
                "success"
        ));
        checkCompletedFamilies(game, playerIndex);
        checkPollutionThreshold(game);
    }

    private void handleDraw(LocalGame game, int playerIndex) {
        if (game.phase != Phase.TURN) {
            return;
        }
        DrawResult result = drawCard(game, playerIndex);
        if (!result.pendingQuiz()) {
            advanceTurn(game);
        }
        checkPollutionThreshold(game);
    }

    private void handleQuizAnswer(LocalGame game, int playerIndex, int choice) {
        PendingQuiz pending = game.pendingQuiz;
        if (pending == null || pending.playerId != game.players.get(playerIndex).id) {
            return;
        }
        boolean isCorrect = choice == pending.answerIndex;
        if (isCorrect) {
            if (game.pollution > 0) {
                game.pollution--;
            }
            game.log.add(new LogEntry(
                    game.players.get(playerIndex).username + " répond correctement au quiz et retire un jeton pollution.",
                    "success"
            ));
        } else {
            game.pollution = Math.min(MAX_POLLUTION, game.pollution + 1);
            game.log.add(new LogEntry(
                    game.players.get(playerIndex).username + " se trompe sur la question et ajoute un jeton pollution.",
                    "warning"
            ));
        }
        game.pendingQuiz = null;
        game.phase = Phase.TURN;
        checkPollutionThreshold(game);
        if ("playing".equals(game.status)) {
            advanceTurn(game);
        }
    }

    private DrawResult drawCard(LocalGame game, int playerIndex) {
        if (game.deck.isEmpty()) {
            game.log.add(new LogEntry("La pioche est vide.", "info"));
            return DrawResult.none();
        }
        String code = game.deck.pollFirst();
        CardMetadata definition = game.cardMetadata.get(code);
        if (definition == null) {
            return DrawResult.none();
        }

        PlayerState player = game.players.get(playerIndex);
        if ("family".equals(definition.type())) {
            player.hand.add(code);
            game.log.add(new LogEntry(player.username + " pioche " + definition.memberName() + ".", "info"));
            checkCompletedFamilies(game, playerIndex);
            return new DrawResult(code, false);
        }

        if ("danger".equals(definition.type())) {
            game.discard.add(code);
            int delta = definition.pollutionDelta();
            if (delta > 0) {
                game.pollution = Math.min(MAX_POLLUTION, game.pollution + delta);
                game.log.add(new LogEntry(
                        player.username + " révèle " + definition.memberName() + " (+" + delta + " pollution).",
                        "danger"
                ));
            } else if (delta < 0) {
                game.pollution = Math.max(0, game.pollution + delta);
                game.log.add(new LogEntry(
                        player.username + " révèle " + definition.memberName() + " (" + delta + " pollution).",
                        "success"
                ));
            } else {
                game.log.add(new LogEntry(
                        player.username + " révèle " + definition.memberName() + ".",
                        "info"
                ));
            }
            return new DrawResult(code, false);
        }

        if ("quiz".equals(definition.type())) {
            game.discard.add(code);
            QuizData quiz = quizByCode.get(code);
            if (quiz == null) {
                return DrawResult.none();
            }
            game.pendingQuiz = new PendingQuiz(
                    code,
                    player.id,
                    quiz.question(),
                    List.copyOf(quiz.choices()),
                    quiz.answerIndex()
            );
            game.phase = Phase.QUIZ;
            game.log.add(new LogEntry(
                    player.username + " doit répondre à un quiz : " + quiz.question(),
                    "quiz"
            ));
            return new DrawResult(code, true);
        }

        return DrawResult.none();
    }

    private void checkCompletedFamilies(LocalGame game, int playerIndex) {
        PlayerState player = game.players.get(playerIndex);
        Set<String> completed = new HashSet<>(player.books);
        for (Map.Entry<String, List<String>> entry : game.familyMap.entrySet()) {
            String familyId = entry.getKey();
            if (completed.contains(familyId)) {
                continue;
            }
            List<String> codes = entry.getValue();
            if (player.hand.containsAll(codes)) {
                player.hand.removeAll(codes);
                player.books.add(familyId);
                completed.add(familyId);
                String familyName = familyNameById.getOrDefault(familyId, familyId);
                game.log.add(new LogEntry(
                        player.username + " complète la famille " + familyName + ".",
                        "success"
                ));
                if (player.books.size() >= TARGET_FAMILIES_TO_WIN && game.pollution < MAX_POLLUTION) {
                    game.status = "ended";
                    game.winner = player.id;
                    game.outcome = "families";
                    game.log.add(new LogEntry(
                            player.username + " remporte la partie en protégeant Dame Nature !",
                            "success"
                    ));
                }
            }
        }
    }

    private void advanceTurn(LocalGame game) {
        int playerCount = game.players.size();
        if (playerCount == 0) {
            return;
        }
        int next = (game.turnIndex + 1) % playerCount;
        if (next == 0) {
            game.round = Math.max(1, game.round + 1);
        }
        game.turnIndex = next;
        game.phase = Phase.TURN;
    }

    private void checkPollutionThreshold(LocalGame game) {
        if (game.pollution < MAX_POLLUTION) {
            return;
        }
        game.status = "ended";
        game.winner = null;
        game.outcome = "pollution";
        game.log.add(new LogEntry("Dame Nature est submergée par la pollution. Tous les joueurs perdent.", "danger"));
    }

    private void processBots(LocalGame game) {
        // Limite les logs pour éviter l'explosion en mode automatique
        if (game.log.size() > MAX_LOG_ENTRIES) {
            game.log = new ArrayList<>(game.log.subList(Math.max(0, game.log.size() - MAX_LOG_ENTRIES), game.log.size()));
        }
        while ("playing".equals(game.status)) {
            if (game.phase == Phase.QUIZ) {
                if (game.pendingQuiz == null) {
                    game.phase = Phase.TURN;
                    continue;
                }
                int index = indexOfPlayer(game, game.pendingQuiz.playerId);
                if (index == game.userIndex || index == -1) {
                    break;
                }
                botAnswerQuiz(game, index);
                continue;
            }

            if (game.turnIndex == game.userIndex) {
                break;
            }

            botTakeTurn(game);
        }
    }

    private void botAnswerQuiz(LocalGame game, int playerIndex) {
        PendingQuiz pending = game.pendingQuiz;
        if (pending == null) {
            return;
        }
        int answerIndex = pending.answerIndex;
        int choice;
        if (pending.choices.size() <= 1) {
            choice = 0;
        } else {
            double correctness = random.nextDouble();
            if (correctness < 0.65) {
                choice = answerIndex;
            } else {
                List<Integer> others = new ArrayList<>();
                for (int i = 0; i < pending.choices.size(); i++) {
                    if (i != answerIndex) {
                        others.add(i);
                    }
                }
                choice = others.isEmpty() ? answerIndex : others.get(random.nextInt(others.size()));
            }
        }
        handleQuizAnswer(game, playerIndex, choice);
    }

    private void botTakeTurn(LocalGame game) {
        PlayerState player = game.players.get(game.turnIndex);
        Optional<BotRequest> request = chooseBotRequest(game, player);
        if (request.isPresent()) {
            BotRequest action = request.get();
            handleAskCard(game, game.turnIndex, action.targetIndex(), action.familyId(), action.memberId());
            return;
        }
        handleDraw(game, game.turnIndex);
    }

    private Optional<BotRequest> chooseBotRequest(LocalGame game, PlayerState player) {
        Map<String, List<String>> ownedByFamily = new HashMap<>();
        for (String code : player.hand) {
            CardMetadata meta = game.cardMetadata.get(code);
            if (meta != null && "family".equals(meta.type())) {
                ownedByFamily.computeIfAbsent(meta.familyId(), key -> new ArrayList<>()).add(code);
            }
        }
        List<BotRequest> requests = new ArrayList<>();
        for (Map.Entry<String, List<String>> entry : ownedByFamily.entrySet()) {
            String familyId = entry.getKey();
            List<String> allCards = game.familyMap.getOrDefault(familyId, List.of());
            Set<String> handCodes = new HashSet<>(entry.getValue());
            List<String> missing = allCards.stream()
                    .filter(code -> !handCodes.contains(code))
                    .toList();
            if (missing.isEmpty()) {
                continue;
            }
            String cardCode = missing.get(random.nextInt(missing.size()));
            CardMetadata meta = game.cardMetadata.get(cardCode);
            if (meta == null) {
                continue;
            }
            int targetIndex = pickTarget(game, player.id);
            if (targetIndex == -1) {
                continue;
            }
            requests.add(new BotRequest(targetIndex, meta.familyId(), meta.memberId()));
        }
        if (requests.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(requests.get(random.nextInt(requests.size())));
    }

    private int pickTarget(LocalGame game, int playerId) {
        List<Integer> candidates = new ArrayList<>();
        for (int i = 0; i < game.players.size(); i++) {
            PlayerState p = game.players.get(i);
            if (p.id != playerId && !p.hand.isEmpty()) {
                candidates.add(i);
            }
        }
        if (candidates.isEmpty()) {
            for (int i = 0; i < game.players.size(); i++) {
                if (game.players.get(i).id != playerId) {
                    candidates.add(i);
                }
            }
        }
        return candidates.isEmpty() ? -1 : candidates.get(random.nextInt(candidates.size()));
    }

    private DameNatureSession toSession(LocalGame game) {
        DameNatureState state = buildState(game);
        Optional<DameNatureState.Player> selfOpt = state.players().stream()
                .filter(player -> player.id() == game.players.get(game.userIndex).id)
                .findFirst();
        int selfIndex = -1;
        if (selfOpt.isPresent()) {
            DameNatureState.Player self = selfOpt.get();
            for (int i = 0; i < state.players().size(); i++) {
                if (state.players().get(i).id() == self.id()) {
                    selfIndex = i;
                    break;
                }
            }
        }
        return new DameNatureSession(
                game.roomId,
                state,
                selfOpt.orElse(null),
                selfIndex,
                engine.score(state)
        );
    }

    private DameNatureState buildState(LocalGame game) {
        List<DameNatureState.Player> players = new ArrayList<>();
        int userId = game.players.get(game.userIndex).id;
        for (PlayerState player : game.players) {
            List<DameNatureState.HandCard> handDetails = new ArrayList<>();
            if (player.id == userId) {
                for (String code : player.hand) {
                    CardMetadata meta = game.cardMetadata.get(code);
                    if (meta != null && "family".equals(meta.type())) {
                        handDetails.add(new DameNatureState.HandCard(
                                code,
                                meta.type(),
                                meta.familyId(),
                                meta.familyName(),
                                meta.memberName(),
                                meta.role()
                        ));
                    }
                }
            }
            players.add(new DameNatureState.Player(
                    player.id,
                    player.username,
                    player.hand.size(),
                    handDetails,
                    List.copyOf(player.books),
                    player.bot
            ));
        }

        DameNatureState.PendingQuiz quiz = null;
        if (game.pendingQuiz != null) {
            quiz = new DameNatureState.PendingQuiz(
                    game.pendingQuiz.question,
                    List.copyOf(game.pendingQuiz.choices)
            );
        }

        List<DameNatureState.LogEntry> log = game.log.stream()
                .map(entry -> new DameNatureState.LogEntry(entry.message, entry.type))
                .toList();

        List<DameNatureState.Family> catalogFamilies = families.stream()
                .map(family -> new DameNatureState.Family(
                        family.id(),
                        family.name(),
                        family.members().stream()
                                .map(member -> new DameNatureState.FamilyMember(
                                        member.id(),
                                        member.name(),
                                        member.role()
                                ))
                                .toList()
                ))
                .toList();
        List<DameNatureState.DangerCard> catalogDangers = dangers.stream()
                .map(card -> new DameNatureState.DangerCard(
                        card.id(),
                        card.name(),
                        card.pollutionDelta()
                ))
                .toList();

        Map<String, DameNatureState.CardDefinition> cards = new HashMap<>(game.cardDefinitions);

        return new DameNatureState(
                "dame-nature",
                game.status,
                game.turnIndex,
                game.round,
                game.pollution,
                MAX_POLLUTION,
                new DameNatureState.Deck(game.deck.size()),
                players,
                quiz,
                log,
                new DameNatureState.Catalog(catalogFamilies, catalogDangers),
                cards
        );
    }

    private LocalGame ensureGameExists(int roomId) {
        if (currentGame == null || currentGame.roomId != roomId) {
            throw new CompletionException(new IllegalStateException("Aucune partie locale active (id " + roomId + ")"));
        }
        return currentGame;
    }

    private int indexOfPlayer(LocalGame game, int playerId) {
        for (int i = 0; i < game.players.size(); i++) {
            if (game.players.get(i).id == playerId) {
                return i;
            }
        }
        return -1;
    }

    private String resolveUsername(ClientSession session) {
        return session.authenticated()
                .map(ClientSession.AuthState::username)
                .filter(name -> !name.isBlank())
                .orElse("Joueuse");
    }

    private String familyCardCode(String familyId, String memberId) {
        return "family:" + familyId + ":" + memberId;
    }

    private List<FamilyData> loadFamilies() throws Exception {
        try (InputStream stream = resource("/games/dame-nature/families.json")) {
            return mapper.readValue(stream, new TypeReference<>() {});
        }
    }

    private List<DangerData> loadDangers() throws Exception {
        try (InputStream stream = resource("/games/dame-nature/dangers.json")) {
            return mapper.readValue(stream, new TypeReference<>() {});
        }
    }

    private List<QuizData> loadQuizzes() throws Exception {
        try (InputStream stream = resource("/games/dame-nature/quiz.json")) {
            return mapper.readValue(stream, new TypeReference<>() {});
        }
    }

    private InputStream resource(String path) {
        InputStream stream = LocalDameNatureService.class.getResourceAsStream(path);
        if (stream == null) {
            throw new IllegalStateException("Ressource manquante : " + path);
        }
        return stream;
    }

    private interface TaskSupplier {
        DameNatureSession get() throws Exception;
    }

    private enum Phase {
        TURN,
        QUIZ
    }

    private static final class LocalGame {
        final int roomId;
        final DameNatureConfig configuration;
        List<PlayerState> players;
        Deque<String> deck;
        List<String> discard = new ArrayList<>();
        Map<String, DameNatureState.CardDefinition> cardDefinitions;
        Map<String, CardMetadata> cardMetadata;
        Map<String, List<String>> familyMap;
        List<LogEntry> log = new ArrayList<>();
        String status;
        Phase phase;
        int turnIndex;
        int round;
        int pollution;
        PendingQuiz pendingQuiz;
        Integer winner;
        String outcome;
        int userIndex;

        LocalGame(int roomId, DameNatureConfig configuration) {
            this.roomId = roomId;
            this.configuration = configuration;
        }
    }

    private static final class PlayerState {
        final int id;
        final String username;
        final boolean bot;
        final List<String> hand = new ArrayList<>();
        final List<String> books = new ArrayList<>();

        PlayerState(int id, String username, boolean bot) {
            this.id = id;
            this.username = username;
            this.bot = bot;
        }
    }

    private record DeckSetup(
            List<String> deck,
            Map<String, DameNatureState.CardDefinition> cardDefinitions,
            Map<String, CardMetadata> cardMetadata,
            Map<String, List<String>> familyMap
    ) {
    }

    private record CardMetadata(
            String code,
            String type,
            String familyId,
            String familyName,
            String memberId,
            String memberName,
            String role,
            int pollutionDelta
    ) {
        static CardMetadata family(String code,
                                   String familyId,
                                   String familyName,
                                   String memberId,
                                   String memberName,
                                   String role) {
            return new CardMetadata(code, "family", familyId, familyName, memberId, memberName, role, 0);
        }

        static CardMetadata danger(String code, String name, int pollutionDelta) {
            return new CardMetadata(code, "danger", null, null, null, name, null, pollutionDelta);
        }

        static CardMetadata quiz(String code, String question, List<String> choices) {
            return new CardMetadata(code, "quiz", null, null, null, question, null, 0);
        }
    }

    private record PendingQuiz(
            String cardCode,
            int playerId,
            String question,
            List<String> choices,
            int answerIndex
    ) {
    }

    private record DrawResult(String cardCode, boolean pendingQuiz) {
        static DrawResult none() {
            return new DrawResult(null, false);
        }
    }

    private record LogEntry(String message, String type) {
    }

    private record BotRequest(int targetIndex, String familyId, String memberId) {
    }

    private record FamilyData(String id, String name, List<FamilyMemberData> members) {
    }

    private record FamilyMemberData(String id, String name, String role) {
    }

    private record DangerData(String id, String name, String description, int pollutionDelta) {
    }

    private record QuizData(String id, String question, List<String> choices, int answerIndex) {
    }
}
