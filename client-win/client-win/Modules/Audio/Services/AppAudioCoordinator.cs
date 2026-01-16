using System;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Audio.Models;
using Microsoft.Extensions.Logging;

namespace client_win.Modules.Audio.Services;

public sealed class AppAudioCoordinator : IAppAudioCoordinator
{
    private readonly ISoundService _sounds;
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

    public AppAudioCoordinator(
        ISoundService sounds,
        IRemoteSoundCache remote,
        ILogger<AppAudioCoordinator> logger)
    {
        _sounds = sounds ?? throw new ArgumentNullException(nameof(sounds));
        _remote = remote ?? throw new ArgumentNullException(nameof(remote));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
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

            _appOpenedSequence = 1;
            _pendingOpenedSound = 1;
            shouldTransition = true;
        }

        if (shouldTransition)
        {
            RequestTransition();
        }
    }

    public void NotifyLoginSucceeded()
    {
        var shouldTransition = false;
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
            shouldTransition = true;
        }

        if (shouldTransition)
        {
            RequestTransition();
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
            _sounds.PreloadAll();
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

        try
        {
            _sounds.Preload(SoundId.ClientDisconnected);
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
                TryPreload(SoundId.ClientOpened, warmUp: false);
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
                await WaitForSoundOrCancelAsync(SoundId.ClientOpened, TimeSpan.FromSeconds(2), token).ConfigureAwait(false);
                if (token.IsCancellationRequested || version != Volatile.Read(ref _transitionVersion))
                {
                    return;
                }

                try
                {
                    using var refreshCts = CancellationTokenSource.CreateLinkedTokenSource(token);
                    refreshCts.CancelAfter(TimeSpan.FromSeconds(1));
                    await RefreshRemoteSoundsAsync(force: true, reapplyBackground: false, refreshCts.Token).ConfigureAwait(false);
                }
                catch
                {
                    // ignore
                }

                if (token.IsCancellationRequested || version != Volatile.Read(ref _transitionVersion))
                {
                    return;
                }

                try
                {
                    StopBackgroundLoops();
                    _appliedBackground = AppAudioBackground.None;
                }
                catch
                {
                    // ignore
                }

                TryPreload(SoundId.ClientConnected, warmUp: true);
                TryPlay(SoundId.ClientConnected);
                lock (_stateGate)
                {
                _pendingConnectedSound = 0;
                }
                Volatile.Write(ref _connectedSoundPlayedSequence, loginSeq);
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
                TryPreload(SoundId.TavernOpened);
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
