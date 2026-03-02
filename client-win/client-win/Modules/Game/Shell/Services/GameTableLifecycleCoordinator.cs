using System;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Threading;

namespace client_win.Modules.Game.Shell.Services;

internal sealed class GameTableLifecycleCoordinator
{
    private enum StartFlowState
    {
        Idle,
        StartRequested,
        RoomStarted,
        GameStarted
    }

    private readonly Dispatcher _dispatcher;
    private readonly Action<GameFocusReason> _requestFocus;
    private readonly Func<bool> _isGameplayStartReady;
    private readonly Func<Task> _requestTurnAnnouncementAsync;
    private readonly Action<string, string, int>? _log;

    private StartFlowState _state = StartFlowState.Idle;
    private int _startFlowVersion;
    private int _awaitingStartReadyVersion;
    private bool _awaitingStartReadyAnnouncement;
    private int _startFocusRecoveryRequestId;

    public GameTableLifecycleCoordinator(
        Dispatcher dispatcher,
        Action<GameFocusReason> requestFocus,
        Func<bool> isGameplayStartReady,
        Func<Task> requestTurnAnnouncementAsync,
        Action<string, string, int>? log = null)
    {
        _dispatcher = dispatcher ?? throw new ArgumentNullException(nameof(dispatcher));
        _requestFocus = requestFocus ?? throw new ArgumentNullException(nameof(requestFocus));
        _isGameplayStartReady = isGameplayStartReady ?? throw new ArgumentNullException(nameof(isGameplayStartReady));
        _requestTurnAnnouncementAsync = requestTurnAnnouncementAsync ?? throw new ArgumentNullException(nameof(requestTurnAnnouncementAsync));
        _log = log;
    }

    public void InitializeState(bool roomStarted)
    {
        _state = roomStarted ? StartFlowState.RoomStarted : StartFlowState.Idle;
        _startFlowVersion = Math.Max(0, _startFlowVersion);
    }

    public StartFlowTransitionResult NotifyStarted(string source, bool fromGameStatus)
    {
        var previous = _state;
        if (fromGameStatus)
        {
            _state = StartFlowState.GameStarted;
        }
        else if (_state is StartFlowState.Idle or StartFlowState.StartRequested)
        {
            _state = StartFlowState.RoomStarted;
        }

        var firstStartTransition = previous is StartFlowState.Idle or StartFlowState.StartRequested;
        var reachedGameplayReady = fromGameStatus && previous != StartFlowState.GameStarted;

        if (firstStartTransition || reachedGameplayReady)
        {
            if (_startFlowVersion <= 0)
            {
                _startFlowVersion = 1;
            }
            _awaitingStartReadyVersion = _startFlowVersion;
            _awaitingStartReadyAnnouncement = true;
            ScheduleStartFocusRecovery(GameFocusReason.TableStarted);
            _ = TryRequestTurnAnnouncementIfReadyAsync(_awaitingStartReadyVersion);
            if (fromGameStatus)
            {
                _awaitingStartReadyAnnouncement = false;
                _ = _dispatcher.BeginInvoke(
                    DispatcherPriority.Background,
                    new Func<Task>(_requestTurnAnnouncementAsync));
            }
        }

        _log?.Invoke(_state.ToString(), source, _startFlowVersion);
        return new StartFlowTransitionResult(firstStartTransition);
    }

    public void Reset(string source)
    {
        _state = StartFlowState.Idle;
        _awaitingStartReadyAnnouncement = false;
        Interlocked.Increment(ref _startFlowVersion);
        _awaitingStartReadyVersion = _startFlowVersion;
        Interlocked.Increment(ref _startFocusRecoveryRequestId);
        _log?.Invoke(_state.ToString(), source, _startFlowVersion);
    }

    public void NotifyStartConfigRequested()
    {
        var version = Interlocked.Increment(ref _startFlowVersion);
        if (_state == StartFlowState.Idle)
        {
            _state = StartFlowState.StartRequested;
            _log?.Invoke(_state.ToString(), "start-config.requested", version);
        }

        _awaitingStartReadyVersion = version;
        _awaitingStartReadyAnnouncement = true;
        ScheduleStartFocusRecovery(GameFocusReason.TableStarted);
        _ = TryRequestTurnAnnouncementIfReadyAsync(version);
    }

    public void NotifyStartReady()
    {
        var version = _awaitingStartReadyVersion;
        _ = TryRequestTurnAnnouncementIfReadyAsync(version);
    }

    private void ScheduleStartFocusRecovery(GameFocusReason reason)
    {
        Interlocked.Increment(ref _startFocusRecoveryRequestId);
        _requestFocus(reason);
    }

    private async Task TryRequestTurnAnnouncementIfReadyAsync(int version)
    {
        try
        {
            if (version != _awaitingStartReadyVersion)
            {
                return;
            }

            if (!_awaitingStartReadyAnnouncement)
            {
                return;
            }

            if (!_dispatcher.CheckAccess())
            {
                await _dispatcher.InvokeAsync(
                    async () => await TryRequestTurnAnnouncementIfReadyAsync(version).ConfigureAwait(true),
                    DispatcherPriority.Background);
                return;
            }

            if (!_isGameplayStartReady())
            {
                return;
            }

            if (version != _awaitingStartReadyVersion)
            {
                return;
            }

            _awaitingStartReadyAnnouncement = false;
            await _requestTurnAnnouncementAsync().ConfigureAwait(true);
        }
        catch
        {
            // best effort
        }
    }

    public readonly struct StartFlowTransitionResult
    {
        public StartFlowTransitionResult(bool isFirstStartTransition)
        {
            IsFirstStartTransition = isFirstStartTransition;
        }

        public bool IsFirstStartTransition { get; }
    }
}
