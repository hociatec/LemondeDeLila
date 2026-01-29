using System;
using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Audio.Models;
using client_win.Core.Constants;
using Microsoft.Extensions.Logging;

namespace client_win.Modules.Audio.Services;

public sealed class AppAudioCoordinator : IAppAudioCoordinator
{
    private readonly ISoundService _sounds;
    private readonly IOptionsService? _options;
    private readonly IRemoteSoundCache _remote;
    private readonly ILogger<AppAudioCoordinator> _logger;
    private readonly SemaphoreSlim _transitionLock = new(1, 1);
    private readonly SemaphoreSlim _refreshLock = new(1, 1);

    private readonly object _stateGate = new();
    private CancellationTokenSource _transitionCts = new();
    private int _transitionVersion;

    private int _loginSequence;
    private int _logoutSequence;
    private int _appOpenedSequence;
    private int _tavernEnteredSequence;
    private int _connectedSoundPlayedSequence;
    private int _disconnectedSoundPlayedSequence;
    private int _openedSoundPlayedSequence;
    private int _tavernOpenedSoundPlayedSequence;

    private bool _isConnected;
    private long _connectedAtTicks;
    private long _backgroundRequestedAtTicks;
    private AppAudioBackground _desiredBackground = AppAudioBackground.None;
    private AppAudioBackground _appliedBackground = AppAudioBackground.None;
    private int _pauseCount;
    private int _pendingConnectedSound;
    private int _pendingDisconnectedSound;
    private int _pendingOpenedSound;
    private int _pendingTavernOpenedSound;
    private int _pendingReapplyBackground;

    // ClickOnce peut relancer le client pendant une mise à jour et démarrer un nouveau process
    // dans un autre dossier "Apps\\2.0". On supprime le son d'ouverture sur cette relance uniquement.
    private static readonly TimeSpan StartupSoundDebounceWindow = TimeSpan.FromMinutes(2);

    public AppAudioCoordinator(
        ISoundService sounds,
        IOptionsService? options,
        IRemoteSoundCache remote,
        ILogger<AppAudioCoordinator> logger)
    {
        _sounds = sounds ?? throw new ArgumentNullException(nameof(sounds));
        _options = options;
        _remote = remote ?? throw new ArgumentNullException(nameof(remote));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));

        // Best-effort: prefetch remote sounds early so latest overrides are available ASAP.
        _ = Task.Run(async () =>
        {
            try
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
                await RefreshRemoteSoundsAsync(force: false, reapplyBackground: false, cts.Token).ConfigureAwait(false);
            }
            catch
            {
                // ignore
            }
        });

        // Reduce first-play latency for common backgrounds (placeholders or admin overrides).
        TryPreload(SoundId.MainMenuMusic);
        TryPreload(SoundId.TavernAmbience);
        TryPreload(SoundId.TavernOpened);
        // Reduce first-play latency for table one-shots.
        TryPreload(SoundId.RoomOpened);
        TryPreload(SoundId.RoomJoined);
        // Reduce first-play latency for common gameplay one-shots (notably quiz feedback).
        TryPreload(SoundId.DiceRolled);
        TryPreload(SoundId.QuizCorrect);
        TryPreload(SoundId.QuizWrong);

        if (_options != null)
        {
            _options.Changed += (_, _) => RequestTransition();
        }
    }

    private static string GetStartupSoundMarkerPath()
    {
        var appDataPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            AppConstants.AppDataFolderName,
            "audio");
        Directory.CreateDirectory(appDataPath);
        return Path.Combine(appDataPath, "startup-sound.last");
    }

    private bool ShouldSuppressStartupSound()
    {
        try
        {
            var markerPath = GetStartupSoundMarkerPath();
            if (!File.Exists(markerPath))
            {
                return false;
            }

            var text = File.ReadAllText(markerPath).Trim();
            if (string.IsNullOrWhiteSpace(text))
            {
                return false;
            }

            // Format (v2): "{utc:O}|{pid}|{baseDir}"
            // Format (v1): "{utc:O}|{baseDir}"
            var parts = text.Split('|');
            var tsPart = parts.Length > 0 ? parts[0] : text;
            var pidPart = parts.Length > 2 ? parts[1] : null;
            var baseDirPart = parts.Length > 2 ? parts[2] : (parts.Length > 1 ? parts[1] : null);

            if (DateTime.TryParse(tsPart, out var lastUtc))
            {
                if (lastUtc.Kind == DateTimeKind.Unspecified)
                {
                    lastUtc = DateTime.SpecifyKind(lastUtc, DateTimeKind.Utc);
                }
                var age = DateTime.UtcNow - lastUtc.ToUniversalTime();

                if (!(age >= TimeSpan.Zero && age < StartupSoundDebounceWindow))
                {
                    return false;
                }

                // Ne supprimer que si on a bien changé de dossier d'exécution (cas ClickOnce update/restart).
                if (!string.IsNullOrWhiteSpace(baseDirPart))
                {
                    var currentBaseDir = AppContext.BaseDirectory ?? string.Empty;
                    if (string.Equals(baseDirPart, currentBaseDir, StringComparison.OrdinalIgnoreCase))
                    {
                        return false;
                    }

                    // Ne supprimer que si l'ancien process est encore en vie (cas ClickOnce update/restart).
                    if (!string.IsNullOrWhiteSpace(pidPart) && int.TryParse(pidPart, out var pid))
                    {
                        if (pid == Environment.ProcessId)
                        {
                            return false;
                        }

                        try
                        {
                            var p = Process.GetProcessById(pid);
                            return p != null && !p.HasExited;
                        }
                        catch
                        {
                            return false;
                        }
                    }

                    // Ancien format (sans pid): best-effort, ne pas supprimer par défaut.
                    return false;
                }

                // Ancien format (sans baseDir) : best-effort, on ne supprime pas par défaut.
                return false;
            }
        }
        catch
        {
            // best-effort
        }

        return false;
    }

    private void MarkStartupSoundAttempt()
    {
        try
        {
            var markerPath = GetStartupSoundMarkerPath();
            var content = $"{DateTime.UtcNow:O}|{Environment.ProcessId}|{AppContext.BaseDirectory}";
            File.WriteAllText(markerPath, content);
        }
        catch
        {
            // best-effort
        }
    }

    public void NotifyAppOpened()
    {
        var shouldTransition = false;
        lock (_stateGate)
        {
            // One-shot at application startup: ignore redundant calls.
            if (_pendingOpenedSound == 1 || _appOpenedSequence > 0)
            {
                return;
            }

            // ClickOnce peut relancer le client très vite (update/restart) : éviter de rejouer le son d'ouverture
            // plusieurs fois de suite, ce que l'utilisateur perçoit comme "plusieurs sons au lancement".
            if (ShouldSuppressStartupSound())
            {
                try { _logger.LogInformation("Audio: suppress ClientOpened (recent restart detected)"); } catch { /* ignore */ }
                _appOpenedSequence = 1;
                _pendingOpenedSound = 0;
                return;
            }

            _appOpenedSequence = 1;
            _pendingOpenedSound = 1;
            shouldTransition = true;
        }

        MarkStartupSoundAttempt();
        if (shouldTransition)
        {
            RequestTransition();
        }
    }

    public void NotifyLoginSucceeded()
    {
        var shouldTransition = false;
        var skipOpenedSeq = 0;
        lock (_stateGate)
        {
            // Redundant login: ignore (prevents double "connected" sound).
            if (_isConnected)
            {
                return;
            }

            _isConnected = true;
            _connectedAtTicks = Stopwatch.GetTimestamp();
            _loginSequence++;
            _pendingConnectedSound = 1;

            // If the user connects before the startup transition had time to play the launch sound,
            // don't play it later (it would feel "out of order" and can cause perceived audio spam).
            if (_pendingOpenedSound == 1 &&
                _appOpenedSequence > 0 &&
                Volatile.Read(ref _openedSoundPlayedSequence) == 0)
            {
                _pendingOpenedSound = 0;
                skipOpenedSeq = _appOpenedSequence;
            }
            shouldTransition = true;
        }

        if (skipOpenedSeq != 0)
        {
            Volatile.Write(ref _openedSoundPlayedSequence, skipOpenedSeq);
        }

        if (shouldTransition)
        {
            RequestTransition();
        }

        // If the user connects quickly, cut the launch sound immediately so the connection sound
        // can play without waiting for the startup gate.
        try
        {
            _logger.LogInformation("Audio: login succeeded, stopping ClientOpened for immediate ClientConnected");
            _sounds.Stop(SoundId.ClientOpened);
        }
        catch
        {
            // ignore
        }

        _ = WarmRefreshAfterLoginAsync();
    }

    public void NotifyLogoutRequested()
    {
        var shouldTransition = false;
        lock (_stateGate)
        {
            // Redundant logout: ignore (prevents double "disconnected" sound).
            if (!_isConnected && _pendingDisconnectedSound == 0)
            {
                return;
            }

            _isConnected = false;
            _desiredBackground = AppAudioBackground.None;
            _logoutSequence++;
            _pendingDisconnectedSound = 1;
            shouldTransition = true;
        }

        if (shouldTransition)
        {
            RequestTransition();
        }
    }

    public void NotifyTavernEntered()
    {
        TryPreload(SoundId.TavernOpened);
        TryPreload(SoundId.TavernAmbience);

        var shouldTransition = false;
        lock (_stateGate)
        {
            // Redundant event: ignore while already in tavern background.
            if (_desiredBackground == AppAudioBackground.Tavern && _pendingTavernOpenedSound == 0)
            {
                return;
            }

            _tavernEnteredSequence++;
            _pendingTavernOpenedSound = 1;
            shouldTransition = true;
        }

        if (shouldTransition)
        {
            RequestTransition();
        }
    }

    public void SetBackground(AppAudioBackground background)
    {
        if (background == AppAudioBackground.MainMenu)
        {
            TryPreload(SoundId.MainMenuMusic);
        }
        else if (background == AppAudioBackground.Tavern)
        {
            TryPreload(SoundId.TavernAmbience);
            TryPreload(SoundId.TavernOpened);
        }

        var shouldTransition = false;
        lock (_stateGate)
        {
            if (_desiredBackground == background)
            {
                return;
            }

            _desiredBackground = background;
            _backgroundRequestedAtTicks = Stopwatch.GetTimestamp();
            shouldTransition = true;
        }

        if (shouldTransition)
        {
            RequestTransition();
        }
    }

    public void PauseBackground()
    {
        var shouldTransition = false;
        lock (_stateGate)
        {
            _pauseCount++;
            shouldTransition = true;
        }

        if (shouldTransition)
        {
            RequestTransition();
        }
    }

    public void ResumeBackground()
    {
        var shouldTransition = false;
        lock (_stateGate)
        {
            if (_pauseCount > 0)
            {
                _pauseCount--;
                shouldTransition = true;
            }
        }

        if (shouldTransition)
        {
            RequestTransition();
        }
    }

    public async Task RefreshRemoteSoundsAsync(bool force, bool reapplyBackground, CancellationToken cancellationToken = default)
    {
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        try
        {
            await _refreshLock.WaitAsync(linked.Token).ConfigureAwait(false);
        }
        catch
        {
            return;
        }

        try
        {
            await _remote.RefreshAsync(force: force, cancellationToken: linked.Token).ConfigureAwait(false);

            // If admin overrides were downloaded, preload them so the next Play/StartLoop is immediate.
            TryPreload(SoundId.MainMenuMusic);
            TryPreload(SoundId.TavernAmbience);
            TryPreload(SoundId.TavernOpened);
            TryPreload(SoundId.ClientConnected);
            TryPreload(SoundId.ClientDisconnected);
            // Table one-shots: preload early so "RoomOpened/Joined" feels instant when opening a table.
            TryPreload(SoundId.RoomOpened);
            TryPreload(SoundId.RoomJoined);
            // Gameplay one-shots: avoid first-action latency after joining a table.
            TryPreload(SoundId.DiceRolled);
            TryPreload(SoundId.QuizCorrect);
            TryPreload(SoundId.QuizWrong);

            if (reapplyBackground)
            {
                lock (_stateGate)
                {
                    _pendingReapplyBackground = 1;
                }
                RequestTransition();
            }
        }
        catch (OperationCanceledException)
        {
            // ignore
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Remote sound refresh failed");
        }
        finally
        {
            try { _refreshLock.Release(); } catch { /* ignore */ }
        }
    }

    public async Task PlayDisconnectAndWaitAsync(TimeSpan timeout)
    {
        try
        {
            StopBackgroundLoops();
        }
        catch
        {
            // ignore
        }

        // Ensure latest admin overrides are applied before playing the sound.
        try
        {
            using var refreshCts = new CancellationTokenSource(TimeSpan.FromSeconds(2));
            await RefreshRemoteSoundsAsync(force: true, reapplyBackground: false, refreshCts.Token).ConfigureAwait(false);
        }
        catch
        {
            // ignore
        }

        try
        {
            _sounds.Play(SoundId.ClientDisconnected);
        }
        catch
        {
            // ignore
        }

        try
        {
            await _sounds.WaitForSoundToEndAsync(SoundId.ClientDisconnected, timeout).ConfigureAwait(false);
        }
        catch
        {
            // ignore
        }
    }

    public async Task PlayClosingAndWaitAsync(TimeSpan timeout)
    {
        try
        {
            StopBackgroundLoops();
        }
        catch
        {
            // ignore
        }

        // Ensure latest admin overrides are applied before playing the sound.
        try
        {
            using var refreshCts = new CancellationTokenSource(TimeSpan.FromSeconds(2));
            await RefreshRemoteSoundsAsync(force: true, reapplyBackground: false, refreshCts.Token).ConfigureAwait(false);
        }
        catch
        {
            // ignore
        }

        try
        {
            _sounds.Play(SoundId.ClientClosing);
        }
        catch
        {
            // ignore
        }

        try
        {
            await _sounds.WaitForSoundToEndAsync(SoundId.ClientClosing, timeout).ConfigureAwait(false);
        }
        catch
        {
            // ignore
        }
    }

    private void RequestTransition()
    {
        CancellationToken token;
        int version;
        lock (_stateGate)
        {
            version = ++_transitionVersion;
            try { _transitionCts.Cancel(); } catch { /* ignore */ }
            try { _transitionCts.Dispose(); } catch { /* ignore */ }
            _transitionCts = new CancellationTokenSource();
            token = _transitionCts.Token;
        }

        _ = TransitionAsync(version, token);
    }

    private async Task WarmRefreshAfterLoginAsync()
    {
        try
        {
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(12));
            await RefreshRemoteSoundsAsync(force: false, reapplyBackground: true, cts.Token).ConfigureAwait(false);
        }
        catch
        {
            // ignore
        }
    }

    private async Task TransitionAsync(int version, CancellationToken token)
    {
        try
        {
            await _transitionLock.WaitAsync(token).ConfigureAwait(false);
        }
        catch
        {
            return;
        }

        try
        {
            bool isConnected;
            long connectedAtTicks;
            AppAudioBackground desiredBackground;
            int pauseCount;
            bool playConnected;
            bool playDisconnected;
            bool playOpened;
            bool playTavernOpened;
            bool reapplyBackground;
            int loginSeq;
            int logoutSeq;
            int openedSeq;
            int tavernSeq;
            long backgroundRequestedAtTicks;

            lock (_stateGate)
            {
                isConnected = _isConnected;
                connectedAtTicks = _connectedAtTicks;
                desiredBackground = _desiredBackground;
                pauseCount = _pauseCount;
                playConnected = _pendingConnectedSound == 1;
                playDisconnected = _pendingDisconnectedSound == 1;
                loginSeq = _loginSequence;
                logoutSeq = _logoutSequence;
                playOpened = _pendingOpenedSound == 1;
                playTavernOpened = _pendingTavernOpenedSound == 1;
                openedSeq = _appOpenedSequence;
                tavernSeq = _tavernEnteredSequence;
                backgroundRequestedAtTicks = _backgroundRequestedAtTicks;
                reapplyBackground = _pendingReapplyBackground == 1;
            }

            if (token.IsCancellationRequested || version != Volatile.Read(ref _transitionVersion))
            {
                return;
            }

            try
            {
                _sounds.SetConnected(isConnected);
            }
            catch
            {
                // ignore
            }

            // Application launch sound is independent of connection state.
            if (playOpened && openedSeq != Volatile.Read(ref _openedSoundPlayedSequence))
            {
                TryPlay(SoundId.ClientOpened);
                lock (_stateGate)
                {
                    _pendingOpenedSound = 0;
                }
                Volatile.Write(ref _openedSoundPlayedSequence, openedSeq);

                // Once the launch sound has finished, re-run transitions so background loops (if any)
                // can start without ever playing before the launch sound.
                _ = Task.Run(async () =>
                {
                    try { await _sounds.WaitForSoundToEndAsync(SoundId.ClientOpened, TimeSpan.FromSeconds(15)).ConfigureAwait(false); } catch { /* ignore */ }
                    try { RequestTransition(); } catch { /* ignore */ }
                });

                // Refresh remote sounds after playing the launch sound.
                // This keeps startup audio deterministic and avoids delaying it (or letting a fallback gate open).
                _ = Task.Run(async () =>
                {
                    try
                    {
                        using var refreshCts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
                        await RefreshRemoteSoundsAsync(force: true, reapplyBackground: false, refreshCts.Token).ConfigureAwait(false);
                    }
                    catch
                    {
                        // ignore
                    }
                });
            }

            if (!isConnected || pauseCount > 0)
            {
                StopBackgroundLoops();
                _appliedBackground = AppAudioBackground.None;
                if (!isConnected && playDisconnected && logoutSeq != Volatile.Read(ref _disconnectedSoundPlayedSequence))
                {
                    // Ensure latest admin overrides are applied before playing the sound.
                    try
                    {
                        using var refreshCts = new CancellationTokenSource(TimeSpan.FromSeconds(2));
                        await RefreshRemoteSoundsAsync(force: true, reapplyBackground: false, refreshCts.Token).ConfigureAwait(false);
                    }
                    catch
                    {
                        // ignore
                    }

                    TryPlay(SoundId.ClientDisconnected);
                    lock (_stateGate)
                    {
                        _pendingDisconnectedSound = 0;
                    }
                    Volatile.Write(ref _disconnectedSoundPlayedSequence, logoutSeq);
                }
                return;
            }

            // Login succeeded: refresh remote sounds quickly so the "connected" sound can use the admin override.
            if (playConnected && loginSeq != Volatile.Read(ref _connectedSoundPlayedSequence))
            {
                // Keep the "one sound at a time" rule: stop the launch sound if it is still playing,
                // then play the connected sound immediately (reduces perceived latency).
                try { _sounds.Stop(SoundId.ClientOpened); } catch { /* ignore */ }

                try
                {
                    StopBackgroundLoops();
                    _appliedBackground = AppAudioBackground.None;
                }
                catch
                {
                    // ignore
                }

                // Make a best-effort attempt to refresh remote sounds before playing, so admin overrides
                // are used consistently for connection feedback.
                try
                {
                    using var refreshCts = new CancellationTokenSource(TimeSpan.FromSeconds(2));
                    await RefreshRemoteSoundsAsync(force: true, reapplyBackground: false, refreshCts.Token).ConfigureAwait(false);
                }
                catch
                {
                    // ignore
                }

                TryPlay(SoundId.ClientConnected);
                lock (_stateGate)
                {
                    _pendingConnectedSound = 0;
                }
                Volatile.Write(ref _connectedSoundPlayedSequence, loginSeq);

                // Refresh again after playing to keep cache warm, without blocking transitions.
                _ = Task.Run(async () =>
                {
                    try
                    {
                        using var refreshCts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
                        await RefreshRemoteSoundsAsync(force: false, reapplyBackground: false, refreshCts.Token).ConfigureAwait(false);
                    }
                    catch
                    {
                        // ignore
                    }
                });
            }

            // Background loops are exclusive and should start only after the connection sound (and the initial connect gate).
            if (desiredBackground == AppAudioBackground.None)
            {
                StopBackgroundLoops();
                _appliedBackground = AppAudioBackground.None;
                return;
            }

            await WaitForConnectStabilizationAsync(connectedAtTicks, token).ConfigureAwait(false);
            if (token.IsCancellationRequested || version != Volatile.Read(ref _transitionVersion))
            {
                return;
            }

            // Music/ambience should not wait several seconds for the connection one-shot to end.
            // Give it a tiny head start then start the background (slight overlap is acceptable vs silence/latency).
            await WaitForSoundOrCancelAsync(
                SoundId.ClientConnected,
                playConnected ? TimeSpan.FromMilliseconds(250) : TimeSpan.FromMilliseconds(100),
                token).ConfigureAwait(false);
            if (token.IsCancellationRequested || version != Volatile.Read(ref _transitionVersion))
            {
                return;
            }

            // Debounce rapid navigation changes to avoid starting/stopping loops during initialization.
            await WaitForBackgroundToStabilizeAsync(backgroundRequestedAtTicks, token).ConfigureAwait(false);
            if (token.IsCancellationRequested || version != Volatile.Read(ref _transitionVersion))
            {
                return;
            }

            if (_appliedBackground == desiredBackground && !reapplyBackground)
            {
                return;
            }

            StopBackgroundLoops();
            _appliedBackground = AppAudioBackground.None;
            if (reapplyBackground)
            {
                lock (_stateGate)
                {
                    _pendingReapplyBackground = 0;
                }
            }

            // One-shot on entering the tavern (played before the ambience loop).
            if (desiredBackground == AppAudioBackground.Tavern &&
                playTavernOpened &&
                tavernSeq != Volatile.Read(ref _tavernOpenedSoundPlayedSequence))
            {
                TryPlay(SoundId.TavernOpened);
                lock (_stateGate)
                {
                    _pendingTavernOpenedSound = 0;
                }
                Volatile.Write(ref _tavernOpenedSoundPlayedSequence, tavernSeq);

                // Give the one-shot a tiny head start to avoid being masked by the loop.
                try { await Task.Delay(200, token).ConfigureAwait(false); } catch { return; }
                if (token.IsCancellationRequested || version != Volatile.Read(ref _transitionVersion))
                {
                    return;
                }
            }

            switch (desiredBackground)
            {
                case AppAudioBackground.MainMenu:
                    _sounds.StartLoop(SoundId.MainMenuMusic);
                    _appliedBackground = desiredBackground;
                    break;
                case AppAudioBackground.Tavern:
                    _sounds.StartLoop(SoundId.TavernAmbience);
                    _appliedBackground = desiredBackground;
                    break;
            }
        }
        catch (OperationCanceledException)
        {
            // ignore
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Audio transition failed");
        }
        finally
        {
            try { _transitionLock.Release(); } catch { /* ignore */ }
        }
    }

    private async Task WaitForConnectStabilizationAsync(long connectedAtTicks, CancellationToken token)
    {
        if (connectedAtTicks <= 0)
        {
            return;
        }

        // Small debounce to avoid rapid connect/disconnect flapping starting/stopping loops.
        // Keep this short to avoid perceivable audio latency on transitions.
        var minTicks = Stopwatch.Frequency / 10; // ~100ms
        while (!token.IsCancellationRequested && Stopwatch.GetTimestamp() - connectedAtTicks < minTicks)
        {
            try
            {
                await Task.Delay(75, token).ConfigureAwait(false);
            }
            catch
            {
                return;
            }
        }
    }

    private async Task WaitForBackgroundToStabilizeAsync(long requestedAtTicks, CancellationToken token)
    {
        if (requestedAtTicks <= 0)
        {
            return;
        }

        // Coalesce bursts of SetBackground() during startup/navigation.
        var minTicks = Stopwatch.Frequency / 4; // ~250ms
        while (!token.IsCancellationRequested && Stopwatch.GetTimestamp() - requestedAtTicks < minTicks)
        {
            try
            {
                await Task.Delay(50, token).ConfigureAwait(false);
            }
            catch
            {
                return;
            }
        }
    }

    private void StopBackgroundLoops()
    {
        _sounds.StopLoop(SoundId.MainMenuMusic);
        _sounds.StopLoop(SoundId.TavernAmbience);
    }

    private void TryPreload(SoundId sound, bool warmUp = false)
    {
        try { _sounds.Preload(sound, warmUp: warmUp); } catch { /* ignore */ }
    }

    private void TryPlay(SoundId sound)
    {
        try { _sounds.Play(sound); } catch { /* ignore */ }
    }

    private async Task WaitForSoundOrCancelAsync(SoundId sound, TimeSpan timeout, CancellationToken token)
    {
        try
        {
            var waitTask = _sounds.WaitForSoundToEndAsync(sound, timeout);
            var cancelTask = WaitForCancelAsync(token);
            await Task.WhenAny(waitTask, cancelTask).ConfigureAwait(false);
        }
        catch
        {
            // ignore
        }
    }

    private static Task WaitForCancelAsync(CancellationToken token)
    {
        if (token.IsCancellationRequested)
        {
            return Task.CompletedTask;
        }

        var tcs = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        token.Register(() => tcs.TrySetResult(true));
        return tcs.Task;
    }
}
