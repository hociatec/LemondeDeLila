using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Threading;
using System.Windows.Media;
using client_win.Core.Constants;
using client_win.Modules.Audio.Models;
using client_win.Modules.Settings.Services;
using Microsoft.Extensions.Logging;

namespace client_win.Modules.Audio.Services;

public sealed class SoundService : ISoundService, IDisposable
{
    private sealed record SoundEntry(
        string DefaultRelativePath,
        Func<string?>? OverridePath,
        Func<bool> IsEnabled,
        Func<double> Volume);

    private readonly IOptionsService _options;
    private readonly IRemoteSoundCache? _remote;
    private readonly Dispatcher _dispatcher;
    private readonly ILogger<SoundService> _logger;
    private readonly bool _remoteSoundsEnabled;
    private readonly object _gate = new();
    private readonly Dictionary<SoundId, MediaPlayer> _players = new();
    private readonly Dictionary<SoundId, string> _loadedPaths = new();
    private readonly Dictionary<SoundId, long> _lastPlayTicks = new();
    private readonly Dictionary<SoundId, int> _playGeneration = new();
    private readonly HashSet<SoundId> _opened = new();
    private readonly Dictionary<SoundId, SoundEntry> _sounds;
    private readonly HashSet<SoundId> _looping = new();
    private readonly Dictionary<SoundId, MediaPlayer> _loopPlayers = new();
    private readonly Dictionary<SoundId, EventHandler> _loopHandlers = new();
    private readonly Dictionary<SoundId, TaskCompletionSource<bool>> _playEndSignals = new();
    private MediaPlayer? _previewPlayer;
    private EventHandler? _previewOpenedHandler;
    private EventHandler<ExceptionEventArgs>? _previewFailedHandler;
    private readonly long _serviceStartTicks = Stopwatch.GetTimestamp();
    private readonly Queue<(SoundId Sound, long Ticks)> _recentPlays = new();
    private int _connectedGate;
    private long _connectedAtTicks;
    private int _startupGateOpened;
    private readonly bool _startupTraceEnabled;
    private readonly HashSet<string> _startupTraceOnce = new(StringComparer.Ordinal);
    private long _startupTraceLastLogTicks;

    private sealed record PlayRequest(SoundId Sound, SoundEntry Entry, string FilePath);

    // Avoid audio spam when a burst of messages happens (e.g. history replay, reconnect).
    private static readonly long MinIntervalTicks = Stopwatch.Frequency / 12; // ~83ms
    private static long GetMinIntervalTicks(SoundId sound) =>
        sound switch
        {
            // Connexion/déconnexion : éviter les doubles triggers (souvent dus à reconnect WS + replay).
            SoundId.ClientConnected => Stopwatch.Frequency * 2,
            SoundId.ClientDisconnected => Stopwatch.Frequency * 2,
            // Notifications admin : limiter le spam si plusieurs commentaires arrivent.
            SoundId.BugReportCommentReceived => Stopwatch.Frequency / 2,
            SoundId.ClientUpdateWarning => Stopwatch.Frequency * 2,
            _ => MinIntervalTicks
        };

    private static readonly long JustConnectedSuppressTicks = Stopwatch.Frequency; // ~1s

    private static bool ShouldSuppressJustAfterConnect(SoundId sound) =>
        sound switch
        {
            // These can trigger in bursts due to history replay / reconnect.
            SoundId.ChatMessageReceived => true,
            SoundId.TableChatMessageReceived => true,
            SoundId.PrivateMessageReceived => true,
            SoundId.FriendConnected => true,
            SoundId.FriendDisconnected => true,
            SoundId.FriendInvitationReceived => true,
            SoundId.InvitationReceived => true,
            SoundId.AdminContactReceived => true,
            SoundId.BugReportCommentReceived => true,
            _ => false
        };

    public SoundService(IOptionsService options, IRemoteSoundCache? remote, Dispatcher dispatcher, ILogger<SoundService> logger)
    {
        _options = options ?? throw new ArgumentNullException(nameof(options));
        _remote = remote;
        _dispatcher = dispatcher ?? throw new ArgumentNullException(nameof(dispatcher));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));

        // Safety valve: allow disabling server-provided sounds if they are broken/silent on a given setup.
        // Set `LMDL_DISABLE_REMOTE_SOUNDS=1` to force local assets (and per-user overrides) to be used.
        _remoteSoundsEnabled =
            !string.Equals(Environment.GetEnvironmentVariable("LMDL_DISABLE_REMOTE_SOUNDS"), "1", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(Environment.GetEnvironmentVariable("LMDL_DISABLE_REMOTE_SOUNDS"), "true", StringComparison.OrdinalIgnoreCase);

        _options.Changed += OnOptionsChanged;

        // Enable targeted audio tracing at startup (to debug "parasite" sounds).
        // Set env var `LMDL_AUDIO_STARTUP_TRACE=1` to include limited call stacks.
        _startupTraceEnabled = string.Equals(
            Environment.GetEnvironmentVariable("LMDL_AUDIO_STARTUP_TRACE"),
            "1",
            StringComparison.OrdinalIgnoreCase);

        try
        {
            _logger.LogInformation("SoundService init pid={Pid} dispatcher={Dispatcher}", Environment.ProcessId, dispatcher?.Thread?.Name ?? "(unnamed)");
        }
        catch
        {
            // ignore
        }

        // Prevent sound spam at startup: allow only the explicit app launch sound until it has finished.
        // Gate is opened when ClientOpened ends/fails, or when ClientOpened can't play (disabled/missing).
        Volatile.Write(ref _startupGateOpened, 0);

        _sounds = new Dictionary<SoundId, SoundEntry>
        {
            [SoundId.ClientOpened] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: () => _options.Current.SoundClientOpenedPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundAppLaunch,
                Volume: () => Clamp01(_options.Current.SoundAppLaunchVolume / 100.0)),
            [SoundId.ClientConnected] = new SoundEntry(
                // Son court et distinct pour rendre la connexion perceptible.
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "invitationrecu.mp3"),
                OverridePath: () => _options.Current.SoundClientConnectedPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundNavigate,
                Volume: () => Clamp01(_options.Current.SoundNavigateVolume / 100.0)),
            [SoundId.ClientDisconnected] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomexit.mp3"),
                OverridePath: () => _options.Current.SoundClientDisconnectedPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundNavigate,
                Volume: () => Clamp01(_options.Current.SoundNavigateVolume / 100.0)),
            [SoundId.ClientClosing] = new SoundEntry(
                // Son joué lors de la fermeture volontaire du client (différent de la déconnexion serveur).
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomexit.mp3"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundNavigate,
                Volume: () => Clamp01(_options.Current.SoundNavigateVolume / 100.0)),
            [SoundId.ClientUpdateWarning] = new SoundEntry(
                // Alerte sonore pour mises à jour (annonce / imminente).
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "invitationrecu.mp3"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundNavigate,
                Volume: () => Clamp01(_options.Current.SoundNavigateVolume / 100.0)),
            [SoundId.MainMenuMusic] = new SoundEntry(
                // PLACEHOLDER: Ce fichier par défaut n'est pas approprié pour une musique de fond.
                // L'administrateur doit uploader une vraie musique de menu via l'interface admin.
                // Le son uploadé sera automatiquement utilisé via RemoteSoundCache.
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundAmbience,
                Volume: () => Clamp01((_options.Current.SoundAmbienceSplit
                    ? _options.Current.SoundMenuAmbienceVolume
                    : _options.Current.SoundAmbienceVolume) / 100.0)),
            [SoundId.TavernAmbience] = new SoundEntry(
                // PLACEHOLDER: Ce fichier par défaut n'est pas approprié pour une ambiance de taverne.
                // L'administrateur doit uploader une vraie ambiance via l'interface admin.
                // Le son uploadé sera automatiquement utilisé via RemoteSoundCache.
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundAmbience,
                Volume: () => Clamp01((_options.Current.SoundAmbienceSplit
                    ? _options.Current.SoundTavernAmbienceVolume
                    : _options.Current.SoundAmbienceVolume) / 100.0)),
            [SoundId.TavernOpened] = new SoundEntry(
                // Son déclenché à l'entrée dans la taverne (one-shot).
                // Configurable globalement via l'interface admin (son uploadé = RemoteSoundCache).
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundNavigate,
                Volume: () => Clamp01(_options.Current.SoundNavigateVolume / 100.0)),
            [SoundId.DiceRolled] = new SoundEntry(
                // Son déclenché à chaque lancer de dé (générique, basé sur `lastRoll`).
                // Configurable globalement via l'interface admin (son uploadé = RemoteSoundCache).
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "pawn_picked.wav"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundSelect,
                Volume: () => Clamp01(_options.Current.SoundSelectVolume / 100.0)),
            [SoundId.ChatMessageSent] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "envoimsgtchat.mp3"),
                OverridePath: () => _options.Current.SoundChatMessageSentPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundChatMessages,
                Volume: () => Clamp01(_options.Current.SoundChatMessagesVolume / 100.0)),
            [SoundId.ChatMessageReceived] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "receptionmsgtchat.mp3"),
                OverridePath: () => _options.Current.SoundChatMessageReceivedPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundChatMessages,
                Volume: () => Clamp01(_options.Current.SoundChatMessagesVolume / 100.0)),
            [SoundId.TableChatMessageSent] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "envoimsgtchat.mp3"),
                OverridePath: () => _options.Current.SoundTableChatMessageSentPath ?? _options.Current.SoundChatMessageSentPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundChatMessages,
                Volume: () => Clamp01(_options.Current.SoundChatMessagesVolume / 100.0)),
            [SoundId.TableChatMessageReceived] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "receptionmsgtchat.mp3"),
                OverridePath: () => _options.Current.SoundTableChatMessageReceivedPath ?? _options.Current.SoundChatMessageReceivedPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundChatMessages,
                Volume: () => Clamp01(_options.Current.SoundChatMessagesVolume / 100.0)),
            [SoundId.PrivateMessageSent] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "msgprivateenvoi.mp3"),
                OverridePath: () => _options.Current.SoundPrivateMessageSentPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundChatMessages,
                Volume: () => Clamp01(_options.Current.SoundChatMessagesVolume / 100.0)),
            [SoundId.PrivateMessageReceived] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "msgprivatereceve.mp3"),
                OverridePath: () => _options.Current.SoundPrivateMessageReceivedPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundChatMessages,
                Volume: () => Clamp01(_options.Current.SoundChatMessagesVolume / 100.0)),
            [SoundId.AdminContactSent] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "msgprivateenvoi.mp3"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundChatMessages,
                Volume: () => Clamp01(_options.Current.SoundChatMessagesVolume / 100.0)),
            [SoundId.AdminContactReceived] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "msgprivatereceve.mp3"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundChatMessages,
                Volume: () => Clamp01(_options.Current.SoundChatMessagesVolume / 100.0)),
            [SoundId.BugReportCommentReceived] = new SoundEntry(
                // Son de notification pour les commentaires ajoutés sur un rapport.
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "receptionmsgtchat.mp3"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundNavigate,
                Volume: () => Clamp01(_options.Current.SoundNavigateVolume / 100.0)),
            [SoundId.FriendConnected] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "invitationrecu.mp3"),
                OverridePath: () => _options.Current.SoundFriendConnectedPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundSelect,
                Volume: () => Clamp01(_options.Current.SoundSelectVolume / 100.0)),
            [SoundId.FriendDisconnected] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomexit.mp3"),
                OverridePath: () => _options.Current.SoundFriendDisconnectedPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundSelect,
                Volume: () => Clamp01(_options.Current.SoundSelectVolume / 100.0)),
            [SoundId.FriendInvitationSent] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "invitationenvoyer.mp3"),
                OverridePath: () => _options.Current.SoundFriendInvitationSentPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundSelect,
                Volume: () => Clamp01(_options.Current.SoundSelectVolume / 100.0)),
            [SoundId.FriendInvitationReceived] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "invitationrecu.mp3"),
                OverridePath: () => _options.Current.SoundFriendInvitationReceivedPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundSelect,
                Volume: () => Clamp01(_options.Current.SoundSelectVolume / 100.0)),
            [SoundId.GameVictory] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: () => _options.Current.SoundGameVictoryPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundChatMessages,
                Volume: () => Clamp01(_options.Current.SoundChatMessagesVolume / 100.0)),
            [SoundId.GameDefeat] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomexit.mp3"),
                OverridePath: () => _options.Current.SoundGameDefeatPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundChatMessages,
                Volume: () => Clamp01(_options.Current.SoundChatMessagesVolume / 100.0)),
            [SoundId.QuizCorrect] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundChatMessages,
                Volume: () => Clamp01(_options.Current.SoundChatMessagesVolume / 100.0)),
            [SoundId.QuizWrong] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomexit.mp3"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundChatMessages,
                Volume: () => Clamp01(_options.Current.SoundChatMessagesVolume / 100.0)),
            [SoundId.RoundEnded] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "pawn_picked.wav"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundSelect,
                Volume: () => Clamp01(_options.Current.SoundSelectVolume / 100.0)),
            [SoundId.InvitationSent] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "invitationenvoyer.mp3"),
                OverridePath: () => _options.Current.SoundInvitationSentPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundSelect,
                Volume: () => Clamp01(_options.Current.SoundSelectVolume / 100.0)),
            [SoundId.InvitationReceived] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "invitationrecu.mp3"),
                OverridePath: () => _options.Current.SoundInvitationReceivedPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundSelect,
                Volume: () => Clamp01(_options.Current.SoundSelectVolume / 100.0)),
            [SoundId.RoomOpened] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: () => _options.Current.SoundRoomOpenedPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundSelect,
                Volume: () => Clamp01(_options.Current.SoundSelectVolume / 100.0)),
            [SoundId.RoomJoined] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: () => _options.Current.SoundRoomJoinedPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundSelect,
                Volume: () => Clamp01(_options.Current.SoundSelectVolume / 100.0)),
            [SoundId.RoomExit] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomexit.mp3"),
                OverridePath: () => _options.Current.SoundRoomExitPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundSelect,
                Volume: () => Clamp01(_options.Current.SoundSelectVolume / 100.0)),
            [SoundId.PawnPicked] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "pawn_picked.wav"),
                OverridePath: () => _options.Current.SoundPawnPickedPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundSelect,
                Volume: () => Clamp01(_options.Current.SoundSelectVolume / 100.0)),
            [SoundId.PawnPlacedSelf] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "pawn_placed_self.wav"),
                OverridePath: () => _options.Current.SoundPawnPlacedSelfPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundSelect,
                Volume: () => Clamp01(_options.Current.SoundSelectVolume / 100.0)),
            [SoundId.PawnPlacedOpponent] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "pawn_placed_opponent.wav"),
                OverridePath: () => _options.Current.SoundPawnPlacedOpponentPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundSelect,
                Volume: () => Clamp01(_options.Current.SoundSelectVolume / 100.0)),
            [SoundId.WallPlacedSelf] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "wall_placed_self.wav"),
                OverridePath: () => _options.Current.SoundWallPlacedSelfPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundSelect,
                Volume: () => Clamp01(_options.Current.SoundSelectVolume / 100.0)),
            [SoundId.WallPlacedOpponent] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "wall_placed_opponent.wav"),
                OverridePath: () => _options.Current.SoundWallPlacedOpponentPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundSelect,
                Volume: () => Clamp01(_options.Current.SoundSelectVolume / 100.0)),

            // Table ambience (loop) slots - configured via admin uploads (RemoteSoundCache).
            [SoundId.TableAmbience1] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundTableAmbience,
                Volume: () => Clamp01(_options.Current.SoundTableAmbienceVolume / 100.0)),
            [SoundId.TableAmbience2] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundTableAmbience,
                Volume: () => Clamp01(_options.Current.SoundTableAmbienceVolume / 100.0)),
            [SoundId.TableAmbience3] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundTableAmbience,
                Volume: () => Clamp01(_options.Current.SoundTableAmbienceVolume / 100.0)),
            [SoundId.TableAmbience4] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundTableAmbience,
                Volume: () => Clamp01(_options.Current.SoundTableAmbienceVolume / 100.0)),
            [SoundId.TableAmbience5] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundTableAmbience,
                Volume: () => Clamp01(_options.Current.SoundTableAmbienceVolume / 100.0)),
            [SoundId.TableAmbience6] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundTableAmbience,
                Volume: () => Clamp01(_options.Current.SoundTableAmbienceVolume / 100.0)),
            [SoundId.TableAmbience7] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundTableAmbience,
                Volume: () => Clamp01(_options.Current.SoundTableAmbienceVolume / 100.0)),
            [SoundId.TableAmbience8] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundTableAmbience,
                Volume: () => Clamp01(_options.Current.SoundTableAmbienceVolume / 100.0)),
            [SoundId.TableAmbience9] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundTableAmbience,
                Volume: () => Clamp01(_options.Current.SoundTableAmbienceVolume / 100.0)),
            [SoundId.TableAmbience10] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundTableAmbience,
                Volume: () => Clamp01(_options.Current.SoundTableAmbienceVolume / 100.0)),
            [SoundId.TableAmbience11] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundTableAmbience,
                Volume: () => Clamp01(_options.Current.SoundTableAmbienceVolume / 100.0)),
            [SoundId.TableAmbience12] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundTableAmbience,
                Volume: () => Clamp01(_options.Current.SoundTableAmbienceVolume / 100.0)),
            [SoundId.TableAmbience13] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundTableAmbience,
                Volume: () => Clamp01(_options.Current.SoundTableAmbienceVolume / 100.0)),
            [SoundId.TableAmbience14] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundTableAmbience,
                Volume: () => Clamp01(_options.Current.SoundTableAmbienceVolume / 100.0)),
            [SoundId.TableAmbience15] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundTableAmbience,
                Volume: () => Clamp01(_options.Current.SoundTableAmbienceVolume / 100.0)),
            [SoundId.TableAmbience16] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundTableAmbience,
                Volume: () => Clamp01(_options.Current.SoundTableAmbienceVolume / 100.0)),
            [SoundId.TableAmbience17] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundTableAmbience,
                Volume: () => Clamp01(_options.Current.SoundTableAmbienceVolume / 100.0)),
            [SoundId.TableAmbience18] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundTableAmbience,
                Volume: () => Clamp01(_options.Current.SoundTableAmbienceVolume / 100.0)),
            [SoundId.TableAmbience19] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundTableAmbience,
                Volume: () => Clamp01(_options.Current.SoundTableAmbienceVolume / 100.0)),
            [SoundId.TableAmbience20] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundTableAmbience,
                Volume: () => Clamp01(_options.Current.SoundTableAmbienceVolume / 100.0)),
        };
    }

    private bool IsInStartupWindow(long nowTicks)
    {
        var sinceStart = nowTicks - _serviceStartTicks;
        return sinceStart >= 0 && sinceStart < Stopwatch.Frequency * 20;
    }

    private void TraceStartupOnce(string key, Func<string> messageFactory)
    {
        try
        {
            var now = Stopwatch.GetTimestamp();
            if (!IsInStartupWindow(now))
            {
                return;
            }

            lock (_gate)
            {
                if (_startupTraceOnce.Contains(key))
                {
                    // throttle: re-log at most once per ~2s during startup
                    if (now - _startupTraceLastLogTicks < Stopwatch.Frequency * 2)
                    {
                        return;
                    }
                }

                _startupTraceOnce.Add(key);
                _startupTraceLastLogTicks = now;
            }

            var msg = messageFactory();
            _logger.LogWarning("Audio startup trace: pid={Pid} {Message}", Environment.ProcessId, msg);
            if (_startupTraceEnabled)
            {
                _logger.LogWarning("Audio startup trace stack:\n{Stack}", Environment.StackTrace);
            }
        }
        catch
        {
            // ignore
        }
    }

    private void OpenStartupGate(string reason)
    {
        if (Interlocked.Exchange(ref _startupGateOpened, 1) == 1)
        {
            return;
        }

        TraceStartupOnce("startup.gate.open", () => $"startup gate opened ({reason})");
    }

    private void TraceStartupPlayRequest(SoundId sound, string filePath, string reason)
    {
        TraceStartupOnce($"startup.play.request.{sound}", () =>
            $"request play {sound} ({reason}) gate(startup={Volatile.Read(ref _startupGateOpened)} connected={Volatile.Read(ref _connectedGate)}) file={Path.GetFileName(filePath)}");
    }

    private void TraceStartupPlayStart(SoundId sound, string filePath)
    {
        TraceStartupOnce($"startup.play.start.{sound}", () =>
            $"start playback {sound} gate(startup={Volatile.Read(ref _startupGateOpened)} connected={Volatile.Read(ref _connectedGate)}) file={Path.GetFileName(filePath)}");
    }

    public void PreloadAll()
    {
        void PreloadOnUiThread()
        {
            foreach (var (sound, entry) in _sounds)
            {
                var filePath = ResolveFilePath(sound, entry);
                if (!File.Exists(filePath))
                {
                    _logger.LogDebug("Sound file missing: {Path}", filePath);
                    continue;
                }

                try
                {
                    lock (_gate)
                    {
                        EnsurePlayerLoaded(sound, filePath, canInterruptPlayback: false);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "Sound preload error ({Sound})", sound);
                }
            }
        }

        // Never block the UI thread with preload IO/decoder warm-up: it can delay first user-feedback sounds
        // and create "bursts" when queued playbacks catch up.
        _ = _dispatcher.BeginInvoke((Action)PreloadOnUiThread, DispatcherPriority.Background);
    }

    public void Preload(SoundId sound, bool warmUp = false)
    {
        if (!_sounds.TryGetValue(sound, out var entry))
        {
            return;
        }

        var filePath = ResolveFilePath(sound, entry);
        if (!File.Exists(filePath))
        {
            _logger.LogDebug("Sound file missing: {Path}", filePath);
            return;
        }

        void PreloadOnUiThread()
        {
            try
            {
                MediaPlayer player;
                int generationSnapshot;
                lock (_gate)
                {
                    EnsurePlayerLoaded(sound, filePath, canInterruptPlayback: false);
                    player = _players[sound];
                    _playGeneration.TryGetValue(sound, out generationSnapshot);
                }

                if (!warmUp)
                {
                    return;
                }

                // Audio warm-up: reduces latency on first play by initializing the decoder.
                // We play at volume 0 to avoid audible "blips".
                void DoWarmUp()
                {
                    try
                    {
                        var originalVolume = player.Volume;
                        var originalMute = player.IsMuted;
                        player.IsMuted = true;
                        player.Volume = 0;
                        player.Play();
                        player.Stop();
                        player.Position = TimeSpan.Zero;
                    }
                    catch
                    {
                        // ignore
                    }
                }

                if (_opened.Contains(sound))
                {
                    DoWarmUp();
                }
                else
                {
                    EventHandler? handler = null;
                    handler = (_, _) =>
                    {
                        try { player.MediaOpened -= handler; } catch { }
                        DoWarmUp();
                    };
                    player.MediaOpened += handler;
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Sound preload error ({Sound})", sound);
            }
        }

        // Warm-up preloads should run ASAP (before the first play), while default preloads stay background.
        if (_dispatcher.CheckAccess())
        {
            PreloadOnUiThread();
        }
        else if (warmUp)
        {
            _ = _dispatcher.InvokeAsync((Action)PreloadOnUiThread, DispatcherPriority.Send);
        }
        else
        {
            // Always schedule default preloads in the background to avoid blocking gameplay/UI interactions.
            _ = _dispatcher.BeginInvoke((Action)PreloadOnUiThread, DispatcherPriority.Background);
        }
    }

    public void Play(SoundId sound)
    {
        if (!_sounds.TryGetValue(sound, out var entry))
        {
            return;
        }
        if (!entry.IsEnabled())
        {
            if (sound == SoundId.ClientOpened)
            {
                // If the launch sound is disabled, don't block all other sounds forever.
                OpenStartupGate("ClientOpened disabled in options");
            }
            else if (sound == SoundId.ClientConnected && Volatile.Read(ref _startupGateOpened) == 0)
            {
                // If startup was cut short (fast login) and the "connected" one-shot is disabled,
                // do not keep the whole app muted behind the startup gate.
                OpenStartupGate("ClientConnected disabled in options");
            }
            return;
        }

        // At app startup, avoid playing any other sounds before the explicit launch sound.
        // This prevents bursts caused by reconnect/history replay and makes the first sound predictable.
        // Exception: allow the connection one-shot and system sounds to play even if the launch sound was cut.
        if (Volatile.Read(ref _startupGateOpened) == 0 &&
            sound != SoundId.ClientOpened &&
            sound != SoundId.ClientConnected &&
            sound != SoundId.ClientDisconnected &&
            sound != SoundId.ClientClosing &&
            sound != SoundId.ClientUpdateWarning)
        {
            TraceStartupOnce($"startup.suppress.{sound}", () =>
                $"suppressed {sound} because startup gate is closed (waiting for ClientOpened to finish)");
            return;
        }

        var now = Stopwatch.GetTimestamp();

        // Gating: before being authenticated/connected, only allow non-spammy system sounds.
        // This prevents bursts of notification sounds during app startup or WS warm-up, while still
        // allowing user-feedback sounds like voluntary disconnect/close/connect.
        if (Volatile.Read(ref _connectedGate) == 0 &&
            sound != SoundId.ClientOpened &&
            sound != SoundId.ClientConnected &&
            sound != SoundId.ClientDisconnected &&
            sound != SoundId.ClientClosing &&
            sound != SoundId.ClientUpdateWarning)
        {
            TraceStartupOnce($"startup.suppress.notconnected.{sound}", () =>
                $"suppressed {sound} because connected gate is closed (not authenticated/connected yet)");
            return;
        }

        // Right after connection, suppress only noisy one-shots triggered by replay/history.
        var connectedAt = Volatile.Read(ref _connectedAtTicks);
        if (Volatile.Read(ref _connectedGate) == 1 &&
            connectedAt > 0 &&
            now - connectedAt < JustConnectedSuppressTicks &&
            ShouldSuppressJustAfterConnect(sound))
        {
            TraceStartupOnce($"startup.suppress.justconnected.{sound}", () =>
                $"suppressed {sound} because just-connected suppress window is active");
            return;
        }
        var filePath = ResolveFilePath(sound, entry);
        if (!File.Exists(filePath))
        {
            _logger.LogDebug("Sound file missing: {Path}", filePath);
            if (sound == SoundId.ClientOpened)
            {
                OpenStartupGate("ClientOpened file missing");
            }
            else if (sound == SoundId.ClientConnected && Volatile.Read(ref _startupGateOpened) == 0)
            {
                OpenStartupGate("ClientConnected file missing");
            }
            return;
        }

        TraceStartupPlayRequest(sound, filePath, "Play() called");

        var shouldLogStartupBurst = false;
        var startupBurstCount = 0;

        lock (_gate)
        {
            var minInterval = GetMinIntervalTicks(sound);
            if (_lastPlayTicks.TryGetValue(sound, out var last) && now - last < minInterval)
            {
                return;
            }
            _lastPlayTicks[sound] = now;
            _playGeneration[sound] = _playGeneration.TryGetValue(sound, out var current) ? current + 1 : 1;

            var sinceStart = now - _serviceStartTicks;
            if (sinceStart >= 0 && sinceStart < Stopwatch.Frequency * 10)
            {
                _recentPlays.Enqueue((sound, now));
                while (_recentPlays.Count > 0 && now - _recentPlays.Peek().Ticks > Stopwatch.Frequency)
                {
                    _recentPlays.Dequeue();
                }
                if (_recentPlays.Count >= 6)
                {
                    shouldLogStartupBurst = true;
                    startupBurstCount = _recentPlays.Count;
                }
            }
        }

        if (shouldLogStartupBurst)
        {
            try
            {
                _logger.LogDebug("Sound startup burst: {Count} sounds in ~1s", startupBurstCount);
            }
            catch
            {
                // ignore
            }
        }

        EnqueuePlayback(new PlayRequest(sound, entry, filePath));
    }

    public void Stop(SoundId sound)
    {
        void StopOnAudioThread()
        {
            try
            {
                MediaPlayer? player = null;
                TaskCompletionSource<bool>? tcs = null;

                lock (_gate)
                {
                    _playEndSignals.TryGetValue(sound, out tcs);
                    _playEndSignals.Remove(sound);

                    if (_players.TryGetValue(sound, out var p))
                    {
                        player = p;
                        _players.Remove(sound);
                    }

                    _loadedPaths.Remove(sound);
                    _opened.Remove(sound);
                }

                try { tcs?.TrySetResult(true); } catch { /* ignore */ }

                if (player != null)
                {
                    try { player.Stop(); } catch { /* ignore */ }
                    try { player.Close(); } catch { /* ignore */ }
                }

                if (sound == SoundId.ClientOpened)
                {
                    // Si on stoppe ClientOpened (ex: login rapide), on doit ouvrir la startup gate,
                    // sinon les boucles (menu/taverne) restent silencieuses jusqu'à la fin du son suivant.
                    if (Volatile.Read(ref _startupGateOpened) == 0)
                    {
                        OpenStartupGate("ClientOpened stopped");
                    }
                }
                else if (sound == SoundId.ClientConnected && Volatile.Read(ref _startupGateOpened) == 0)
                {
                    OpenStartupGate("ClientConnected stopped");
                }
            }
            catch
            {
                // ignore
            }
        }

        if (_dispatcher.CheckAccess())
        {
            StopOnAudioThread();
        }
        else
        {
            _ = _dispatcher.BeginInvoke((Action)StopOnAudioThread, DispatcherPriority.Send);
        }
    }

    private void EnqueuePlayback(PlayRequest request)
    {
        void PlayOnUiThread()
        {
            try
            {
                MediaPlayer player;
                TaskCompletionSource<bool> tcs;

                lock (_gate)
                {
                    EnsurePlayerLoaded(request.Sound, request.FilePath, canInterruptPlayback: true);
                    player = _players[request.Sound];

                    // If we restart a sound while a previous instance was "in progress", ensure waiters don't hang.
                    if (_playEndSignals.TryGetValue(request.Sound, out var previous))
                    {
                        previous.TrySetResult(true);
                    }

                    tcs = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
                    _playEndSignals[request.Sound] = tcs;
                }

                void StartPlaybackIfCurrent()
                {
                    // Drop stale callbacks (e.g. multiple plays fired quickly while MediaOpened is pending).
                    lock (_gate)
                    {
                        if (_playEndSignals.TryGetValue(request.Sound, out var current) && !ReferenceEquals(current, tcs))
                        {
                            return;
                        }
                        if (!_players.TryGetValue(request.Sound, out var currentPlayer) || !ReferenceEquals(currentPlayer, player))
                        {
                            return;
                        }
                    }

                    player.IsMuted = false;
                    player.Volume = GetPlaybackVolume(request.Sound, request.Entry, request.FilePath);
                    player.Stop();
                    player.Position = TimeSpan.Zero;
                    player.Play();
                    TraceStartupPlayStart(request.Sound, request.FilePath);
                }

                var needsMediaOpened = false;
                lock (_gate)
                {
                    needsMediaOpened = !_opened.Contains(request.Sound);
                }

                if (needsMediaOpened)
                {
                    EventHandler? opened = null;
                    opened = (_, _) =>
                    {
                        try { player.MediaOpened -= opened; } catch { /* ignore */ }
                        try { StartPlaybackIfCurrent(); } catch { /* ignore */ }
                    };
                    player.MediaOpened += opened;

                    // Avoid missing MediaOpened if it fired just before subscribing.
                    lock (_gate)
                    {
                        needsMediaOpened = !_opened.Contains(request.Sound);
                    }
                    if (!needsMediaOpened)
                    {
                        try { player.MediaOpened -= opened; } catch { /* ignore */ }
                    }
                }

                if (!needsMediaOpened)
                {
                    try { StartPlaybackIfCurrent(); } catch { /* ignore */ }
                }

                EventHandler? ended = null;
                ended = (_, _) =>
                {
                    try { player.MediaEnded -= ended; } catch { /* ignore */ }
                    if (request.Sound == SoundId.ClientOpened)
                    {
                        OpenStartupGate("ClientOpened ended");
                    }
                    else if (request.Sound == SoundId.ClientConnected && Volatile.Read(ref _startupGateOpened) == 0)
                    {
                        OpenStartupGate("ClientConnected ended");
                    }
                    lock (_gate)
                    {
                        if (_playEndSignals.TryGetValue(request.Sound, out var current) && ReferenceEquals(current, tcs))
                        {
                            _playEndSignals.Remove(request.Sound);
                        }
                    }
                    tcs.TrySetResult(true);
                };
                player.MediaEnded += ended;
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Sound playback error ({Sound})", request.Sound);
                lock (_gate)
                {
                    if (_playEndSignals.TryGetValue(request.Sound, out var current))
                    {
                        _playEndSignals.Remove(request.Sound);
                        current.TrySetResult(true);
                    }
                }
            }
        }

        if (_dispatcher.CheckAccess())
        {
            PlayOnUiThread();
        }
        else
        {
            // Audio feedback should start quickly, even if the UI thread is busy (e.g. heavy navigation/reflow).
            _ = _dispatcher.BeginInvoke((Action)PlayOnUiThread, DispatcherPriority.Send);
        }
    }

    public void PlayPreview(SoundId sound)
    {
        if (!_sounds.TryGetValue(sound, out var entry))
        {
            return;
        }

        var filePath = ResolveFilePath(sound, entry);
        if (!File.Exists(filePath))
        {
            _logger.LogDebug("Sound file missing: {Path}", filePath);
            return;
        }

        void PlayOnUiThread()
        {
            try
            {
                StopPreviewOnUiThread();

                var player = new MediaPlayer();
                _previewPlayer = player;
                var opened = false;

                // MediaOpened est déclenché de manière async : démarrer uniquement quand prêt.
                _previewOpenedHandler = (_, _) =>
                {
                    if (_previewPlayer == null || !ReferenceEquals(_previewPlayer, player))
                    {
                        return;
                    }

                    opened = true;
                    try
                    {
                        player.IsMuted = false;
                        // En admin, l'aperçu doit rester audible même si le volume de la catégorie est à 0.
                        player.Volume = Math.Max(0.35, entry.Volume());
                        player.Stop();
                        player.Position = TimeSpan.Zero;
                        player.Play();
                    }
                    catch
                    {
                        // ignore
                    }
                };
                player.MediaOpened += _previewOpenedHandler;
                _previewFailedHandler = (_, args) =>
                {
                    try
                    {
                        _logger.LogWarning(
                            "Sound preview failed ({Sound}): {Error}",
                            sound,
                            args.ErrorException?.Message ?? "unknown error");
                    }
                    catch
                    {
                        // ignore
                    }

                    try
                    {
                        // Ne pas couper un nouvel aperçu si un ancien player échoue en retard.
                        if (_previewPlayer != null && ReferenceEquals(_previewPlayer, player))
                        {
                            StopPreviewOnUiThread();
                        }
                    }
                    catch { /* ignore */ }
                };
                player.MediaFailed += _previewFailedHandler;

                try
                {
                    player.Open(new Uri(filePath, UriKind.Absolute));

                    // Fallback: certains environnements ne déclenchent pas toujours MediaOpened (ou trop tard).
                    // Tenter un démarrage best-effort après un court délai.
                    _ = _dispatcher.BeginInvoke((Action)(() =>
                    {
                        try
                        {
                            if (!opened && _previewPlayer != null && ReferenceEquals(_previewPlayer, player))
                            {
                                player.IsMuted = false;
                                player.Volume = Math.Max(0.35, entry.Volume());
                                player.Stop();
                                player.Position = TimeSpan.Zero;
                                player.Play();
                            }
                        }
                        catch
                        {
                            // ignore
                        }
                    }), DispatcherPriority.Background);
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "Sound preview open failed ({Sound})", sound);
                    StopPreviewOnUiThread();
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Sound preview error ({Sound})", sound);
                StopPreviewOnUiThread();
            }
        }

        if (_dispatcher.CheckAccess())
        {
            PlayOnUiThread();
        }
        else
        {
            _ = _dispatcher.BeginInvoke((Action)PlayOnUiThread, DispatcherPriority.Normal);
        }
    }

    public void StopPreview()
    {
        if (_dispatcher.CheckAccess())
        {
            StopPreviewOnUiThread();
        }
        else
        {
            _ = _dispatcher.BeginInvoke((Action)StopPreviewOnUiThread, DispatcherPriority.Background);
        }
    }

    private void StopPreviewOnUiThread()
    {
        if (_previewPlayer == null)
        {
            return;
        }

        try
        {
            if (_previewOpenedHandler != null)
            {
                try { _previewPlayer.MediaOpened -= _previewOpenedHandler; } catch { /* ignore */ }
                _previewOpenedHandler = null;
            }
            if (_previewFailedHandler != null)
            {
                try { _previewPlayer.MediaFailed -= _previewFailedHandler; } catch { /* ignore */ }
                _previewFailedHandler = null;
            }
        }
        catch
        {
            // ignore
        }

        try { _previewPlayer.Stop(); } catch { /* ignore */ }
        try { _previewPlayer.Close(); } catch { /* ignore */ }
        _previewPlayer = null;
    }

    public void SetConnected(bool connected)
    {
        Volatile.Write(ref _connectedGate, connected ? 1 : 0);
        if (!connected)
        {
            Volatile.Write(ref _connectedAtTicks, 0);
            // Quand on repasse "déconnecté", stopper les boucles d'ambiance (elles peuvent continuer sinon).
            StopLoop(SoundId.MainMenuMusic);
            StopLoop(SoundId.TavernAmbience);
            return;
        }

        Volatile.Write(ref _connectedAtTicks, Stopwatch.GetTimestamp());
    }

    public async Task WaitForSoundToEndAsync(SoundId sound, TimeSpan timeout)
    {
        if (timeout <= TimeSpan.Zero)
        {
            return;
        }

        // Le son peut démarrer légèrement après l'appel (ex: event WS Connected),
        // donc on attend un court délai qu'il "commence" avant de considérer qu'il n'y a rien à attendre.
        var sw = Stopwatch.StartNew();
        TaskCompletionSource<bool>? tcs;
        lock (_gate)
        {
            _playEndSignals.TryGetValue(sound, out tcs);
        }

        var startWaitMs = Math.Min(1500, (int)Math.Max(0, timeout.TotalMilliseconds));
        while (tcs == null && sw.ElapsedMilliseconds < startWaitMs)
        {
            try
            {
                await Task.Delay(50).ConfigureAwait(false);
            }
            catch
            {
                return;
            }

            lock (_gate)
            {
                _playEndSignals.TryGetValue(sound, out tcs);
            }
        }

        if (tcs == null)
        {
            return;
        }

        var remaining = timeout - sw.Elapsed;
        if (remaining <= TimeSpan.Zero)
        {
            return;
        }

        try
        {
            await Task.WhenAny(tcs.Task, Task.Delay(remaining)).ConfigureAwait(false);
        }
        catch
        {
            // ignore
        }
    }

    private void SyncOptions()
    {
        lock (_gate)
        {
            // Update volumes of all active players.
            foreach (var kv in _players)
            {
                if (_sounds.TryGetValue(kv.Key, out var entry))
                {
                    try
                    {
                        if (_loadedPaths.TryGetValue(kv.Key, out var path))
                        {
                            kv.Value.Volume = GetPlaybackVolume(kv.Key, entry, path);
                        }
                        else
                        {
                            kv.Value.Volume = entry.Volume();
                        }
                    }
                    catch
                    {
                        // ignore
                    }
                }
            }

            // Update volumes and enabled state of loops.
            var loopsToStop = new List<SoundId>();
            foreach (var kv in _loopPlayers)
            {
                if (_sounds.TryGetValue(kv.Key, out var entry))
                {
                    if (!entry.IsEnabled())
                    {
                        loopsToStop.Add(kv.Key);
                    }
                    else
                    {
                        try
                        {
                            if (_loadedPaths.TryGetValue(kv.Key, out var path))
                            {
                                kv.Value.Volume = GetPlaybackVolume(kv.Key, entry, path);
                            }
                            else
                            {
                                kv.Value.Volume = entry.Volume();
                            }
                        }
                        catch
                        {
                            // ignore
                        }
                    }
                }
            }

            foreach (var sound in loopsToStop)
            {
                StopLoop(sound);
            }
        }
    }

    public void StartLoop(SoundId sound)
    {
        // At startup, keep the app silent (except ClientOpened one-shot) until the launch sound finishes.
        if (Volatile.Read(ref _startupGateOpened) == 0)
        {
            TraceStartupOnce($"startup.suppress.loop.{sound}", () =>
                $"suppressed loop {sound} because startup gate is closed (waiting for ClientOpened to finish)");
            return;
        }
        // Avant connexion: aucune boucle (ambiance/musique) ne doit démarrer.
        if (Volatile.Read(ref _connectedGate) == 0)
        {
            return;
        }

        // Juste après connexion, éviter la superposition avec le son "connexion réussie".
        // (Des events comme sounds.updated peuvent déclencher des StartLoop trop tôt.)
        if (!_sounds.TryGetValue(sound, out var entry))
        {
            return;
        }
        if (!entry.IsEnabled())
        {
            StopLoop(sound);
            return;
        }

        var filePath = ResolveFilePath(sound, entry);
        if (!File.Exists(filePath))
        {
            _logger.LogDebug("Loop sound file missing: {Path}", filePath);
            return;
        }

        // Les boucles "ambiance/musique" ont des placeholders (roomopened.mp3) par défaut.
        // Tant que l'admin n'a pas uploadé un vrai son, ne pas lancer la boucle (sinon on entend un "son court" en boucle).
        if ((sound == SoundId.MainMenuMusic || sound == SoundId.TavernAmbience) &&
            string.IsNullOrWhiteSpace(_remote?.TryGetPath(sound)) &&
            string.Equals(Path.GetFileName(filePath), "roomopened.mp3", StringComparison.OrdinalIgnoreCase))
        {
            try { _logger.LogDebug("Skip loop sound (placeholder): {Sound}", sound); } catch { /* ignore */ }
            return;
        }

        void StartOnUiThread()
        {
            MediaPlayer player;
            EventHandler handler;

            lock (_gate)
            {
                EnsurePlayerLoaded(sound, filePath, canInterruptPlayback: true);
                player = _players[sound];

                if (_loopPlayers.TryGetValue(sound, out var previousPlayer) && !ReferenceEquals(previousPlayer, player))
                {
                    if (_loopHandlers.TryGetValue(sound, out var previousHandler))
                    {
                        try { previousPlayer.MediaEnded -= previousHandler; } catch { /* ignore */ }
                    }
                    _loopPlayers.Remove(sound);
                    _loopHandlers.Remove(sound);
                    _looping.Remove(sound);
                }

                if (_looping.Contains(sound))
                {
                    try
                    {
                        player.IsMuted = false;
                        player.Volume = entry.Volume();
                        player.Play();
                    }
                    catch
                    {
                        // ignore
                    }
                    return;
                }

                handler = (_, _) =>
                {
                    lock (_gate)
                    {
                        if (!_looping.Contains(sound))
                        {
                            return;
                        }
                    }

                    try
                    {
                        player.IsMuted = false;
                        player.Position = TimeSpan.Zero;
                        player.Play();
                    }
                    catch
                    {
                        // ignore
                    }
                };

                _looping.Add(sound);
                _loopPlayers[sound] = player;
                _loopHandlers[sound] = handler;
                player.MediaEnded += handler;
            }

            try
            {
                player.IsMuted = false;
                player.Volume = entry.Volume();
                player.Stop();
                player.Position = TimeSpan.Zero;
                player.Play();
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Loop sound start failed ({Sound})", sound);
            }
        }

        if (_dispatcher.CheckAccess())
        {
            StartOnUiThread();
        }
        else
        {
            _ = _dispatcher.BeginInvoke((Action)StartOnUiThread, DispatcherPriority.Background);
        }
    }

    public void StopLoop(SoundId sound)
    {
        void StopOnUiThread()
        {
            MediaPlayer? player = null;
            EventHandler? handler = null;

            lock (_gate)
            {
                _looping.Remove(sound);

                if (_loopPlayers.TryGetValue(sound, out var p))
                {
                    player = p;
                    _loopPlayers.Remove(sound);
                }

                if (_loopHandlers.TryGetValue(sound, out var h))
                {
                    handler = h;
                    _loopHandlers.Remove(sound);
                }
            }

            if (player != null && handler != null)
            {
                try { player.MediaEnded -= handler; } catch { /* ignore */ }
            }

            if (player != null)
            {
                try { player.Stop(); } catch { /* ignore */ }
            }

            lock (_gate)
            {
                if (_playEndSignals.TryGetValue(sound, out var tcs))
                {
                    _playEndSignals.Remove(sound);
                    tcs.TrySetResult(true);
                }
            }
        }

        if (_dispatcher.CheckAccess())
        {
            StopOnUiThread();
        }
        else
        {
            _ = _dispatcher.BeginInvoke((Action)StopOnUiThread, DispatcherPriority.Background);
        }
    }

    public void Dispose()
    {
        _options.Changed -= OnOptionsChanged;

        lock (_gate)
        {
            _looping.Clear();
            _loopPlayers.Clear();
            _loopHandlers.Clear();
            foreach (var tcs in _playEndSignals.Values)
            {
                tcs.TrySetResult(true);
            }
            _playEndSignals.Clear();
            foreach (var p in _players.Values)
            {
                try { p.Close(); } catch { /* ignore */ }
            }
            _players.Clear();
            _loadedPaths.Clear();
            _lastPlayTicks.Clear();
            _playGeneration.Clear();
            _opened.Clear();
        }

        try
        {
            if (_dispatcher.CheckAccess())
            {
                StopPreviewOnUiThread();
            }
            else
            {
                _ = _dispatcher.BeginInvoke((Action)StopPreviewOnUiThread, DispatcherPriority.Background);
            }
        }
        catch
        {
            // ignore
        }
    }

    private string ResolveFilePath(SoundEntry entry)
    {
        var overridePath = entry.OverridePath?.Invoke();
        if (!string.IsNullOrWhiteSpace(overridePath))
        {
            try
            {
                var candidate = Path.GetFullPath(overridePath);
                if (File.Exists(candidate))
                {
                    return candidate;
                }
            }
            catch
            {
                // ignore
            }
        }

        return Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, entry.DefaultRelativePath));
    }

    private string ResolveFilePath(SoundId sound, SoundEntry entry)
    {
        if (_remoteSoundsEnabled)
        {
            var remotePath = _remote?.TryGetPath(sound);
            if (!string.IsNullOrWhiteSpace(remotePath))
            {
                try
                {
                    var candidate = Path.GetFullPath(remotePath);
                    if (File.Exists(candidate))
                    {
                        return candidate;
                    }
                }
                catch
                {
                    // ignore
                }
            }
        }

        return ResolveFilePath(entry);
    }

    private void EnsurePlayerLoaded(SoundId sound, string absolutePath, bool canInterruptPlayback)
    {
        if (_players.TryGetValue(sound, out var existing) &&
            _loadedPaths.TryGetValue(sound, out var loaded) &&
            string.Equals(loaded, absolutePath, StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        if (!canInterruptPlayback && _playEndSignals.ContainsKey(sound))
        {
            return;
        }

        if (!canInterruptPlayback && _looping.Contains(sound))
        {
            return;
        }

        if (_players.TryGetValue(sound, out var old))
        {
            // Stop first to avoid rare cases where Close() doesn't immediately cut audio output.
            try { old.Stop(); } catch { /* ignore */ }

            // If this sound was looping on the old player, clear loop state to avoid dangling handlers/players.
            if (_loopPlayers.TryGetValue(sound, out var loopPlayer) && ReferenceEquals(loopPlayer, old))
            {
                if (_loopHandlers.TryGetValue(sound, out var loopHandler))
                {
                    try { old.MediaEnded -= loopHandler; } catch { /* ignore */ }
                }
                _loopPlayers.Remove(sound);
                _loopHandlers.Remove(sound);
                _looping.Remove(sound);
            }

            try { old.Close(); } catch { /* ignore */ }
            _players.Remove(sound);
        }
        _loadedPaths.Remove(sound);
        _opened.Remove(sound);

        var player = new MediaPlayer();
        // Preload must never emit audio: some devices/drivers can leak audible "blips" on Open().
        // Keep the player muted until a real Play/StartLoop explicitly unmutes it.
        player.IsMuted = true;
        player.Volume = 0;
        player.MediaOpened += (_, _) =>
        {
            lock (_gate)
            {
                if (_players.TryGetValue(sound, out var current) && ReferenceEquals(current, player))
                {
                    _opened.Add(sound);
                }
            }
        };
        player.MediaFailed += (_, args) =>
        {
            _logger.LogWarning(
                "Sound playback failed ({Sound}): {Error}",
                sound,
                args.ErrorException?.Message ?? "unknown error");
            lock (_gate)
            {
                if (sound == SoundId.ClientOpened)
                {
                    OpenStartupGate("ClientOpened media failed");
                }
                else if (sound == SoundId.ClientConnected && Volatile.Read(ref _startupGateOpened) == 0)
                {
                    OpenStartupGate("ClientConnected media failed");
                }
                if (_playEndSignals.TryGetValue(sound, out var tcs))
                {
                    _playEndSignals.Remove(sound);
                    tcs.TrySetResult(true);
                }
                if (_players.TryGetValue(sound, out var current) && ReferenceEquals(current, player))
                {
                    _players.Remove(sound);
                    _loadedPaths.Remove(sound);
                    _opened.Remove(sound);
                }
            }
            try { player.Close(); } catch { /* ignore */ }
        };
        player.Open(new Uri(absolutePath, UriKind.Absolute));
        _players[sound] = player;
        _loadedPaths[sound] = absolutePath;
    }

    private void OnOptionsChanged(object? sender, EventArgs e)
    {
        _dispatcher.BeginInvoke((Action)SyncOptions, DispatcherPriority.Normal);
    }

    private static double Clamp01(double v)
    {
        if (v < 0) return 0;
        if (v > 1) return 1;
        return v;
    }

    private static string GetSoundsCacheDir() =>
        Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            AppConstants.AppDataFolderName,
            "sounds-cache");

    private static bool IsFromSoundsCache(string filePath)
    {
        if (string.IsNullOrWhiteSpace(filePath))
        {
            return false;
        }

        try
        {
            var cacheDir = GetSoundsCacheDir();
            if (string.IsNullOrWhiteSpace(cacheDir))
            {
                return false;
            }

            var normalizedCache = Path.GetFullPath(cacheDir)
                .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) +
                Path.DirectorySeparatorChar;
            var normalizedFile = Path.GetFullPath(filePath);
            return normalizedFile.StartsWith(normalizedCache, StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }

    private static double GetPlaybackVolume(SoundId sound, SoundEntry entry, string filePath)
    {
        var baseVolume = entry.Volume();

        // These two sounds are commonly server-provided and can be uploaded too quietly.
        // External players often apply normalization; MediaPlayer does not.
        if ((sound == SoundId.ClientConnected || sound == SoundId.ClientDisconnected) &&
            baseVolume > 0 &&
            IsFromSoundsCache(filePath))
        {
            return Clamp01(baseVolume * 2.0);
        }

        return baseVolume;
    }
}
