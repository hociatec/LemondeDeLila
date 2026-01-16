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
    private int _connectedSoundPlayedSequence;
    private int _disconnectedSoundPlayedSequence;

    private bool _isConnected;
    private long _connectedAtTicks;
    private AppAudioBackground _desiredBackground = AppAudioBackground.None;
    private AppAudioBackground _appliedBackground = AppAudioBackground.None;
    private int _pauseCount;
    private int _pendingConnectedSound;
    private int _pendingDisconnectedSound;

    public AppAudioCoordinator(
        ISoundService sounds,
        IRemoteSoundCache remote,
        ILogger<AppAudioCoordinator> logger)
    {
        _sounds = sounds ?? throw new ArgumentNullException(nameof(sounds));
        _remote = remote ?? throw new ArgumentNullException(nameof(remote));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
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

    public async Task RefreshRemoteSoundsAsync(bool force, CancellationToken cancellationToken = default)
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
            await RefreshRemoteSoundsAsync(force: false, cts.Token).ConfigureAwait(false);
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
            int loginSeq;
            int logoutSeq;

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
                try
                {
                    using var refreshCts = CancellationTokenSource.CreateLinkedTokenSource(token);
                    refreshCts.CancelAfter(TimeSpan.FromSeconds(1));
                    await RefreshRemoteSoundsAsync(force: true, refreshCts.Token).ConfigureAwait(false);
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
            await WaitForSoundOrCancelAsync(SoundId.ClientConnected, TimeSpan.FromSeconds(2), token).ConfigureAwait(false);
            if (token.IsCancellationRequested || version != Volatile.Read(ref _transitionVersion))
            {
                return;
            }

            if (_appliedBackground == desiredBackground)
            {
                return;
            }

            StopBackgroundLoops();
            _appliedBackground = AppAudioBackground.None;
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

        // Align with SoundService's internal "just connected" guard to avoid a silent no-op StartLoop().
        var minTicks = Stopwatch.Frequency * 2;
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
