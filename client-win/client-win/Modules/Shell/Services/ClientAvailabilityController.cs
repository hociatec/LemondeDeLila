using System;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Error;
using client_win.Modules.Network;
using client_win.Modules.Network.Services;
using client_win.Modules.Updates;

namespace client_win.Modules.Shell.Services;

public sealed class ClientAvailabilityController : IDisposable
{
    private readonly PersistentWsClient _ws;
    private readonly IApiCapabilitiesService _capabilities;
    private readonly ErrorBus _errors;
    private readonly ClientAvailabilityOverlayState _overlay;
    private readonly IDisposable _errorsSub;

    private int _lastReconnectAttempt;
    private string _lastDisconnectReason = "disconnected";

    public ClientAvailabilityController(
        PersistentWsClient ws,
        IApiCapabilitiesService capabilities,
        ErrorBus errors,
        ClientAvailabilityOverlayState overlay)
    {
        _ws = ws ?? throw new ArgumentNullException(nameof(ws));
        _capabilities = capabilities ?? throw new ArgumentNullException(nameof(capabilities));
        _errors = errors ?? throw new ArgumentNullException(nameof(errors));
        _overlay = overlay ?? throw new ArgumentNullException(nameof(overlay));

        _ws.Connected += OnConnected;
        _ws.Disconnected += OnDisconnected;
        _ws.Reconnecting += OnReconnecting;

        _overlay.RequestRetry += OnRetryRequested;

        _errorsSub = _errors.Subscribe(OnError);
        ClientUpdateCoordinator.FlowChanged += OnUpdateFlow;
    }

    private void OnConnected()
    {
        _lastReconnectAttempt = 0;
        if (_overlay.Kind == ClientAvailabilityOverlayKind.Reconnecting ||
            _overlay.Kind == ClientAvailabilityOverlayKind.Maintenance)
        {
            _overlay.Hide();
        }
    }

    private void OnDisconnected(string reason)
    {
        _lastDisconnectReason = string.IsNullOrWhiteSpace(reason) ? "disconnected" : reason.Trim();
        _lastReconnectAttempt = 0;
        _overlay.ShowReconnecting(_lastDisconnectReason);
    }

    private void OnReconnecting(int attempt, TimeSpan nextDelay)
    {
        _lastReconnectAttempt = attempt;
        _overlay.UpdateReconnectingAttempt(_lastDisconnectReason, attempt, nextDelay);
    }

    private void OnRetryRequested()
    {
        _ = Task.Run(async () =>
        {
            try
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(6));
                _ = await _capabilities.GetAsync(cts.Token).ConfigureAwait(false);
            }
            catch
            {
                // ignore
            }
        });
    }

    private void OnError(AppError err)
    {
        // Crash/restart/non-announced downtime is covered by WS disconnected/reconnect.
        // Here we only intercept special cases that should show a stable UI instead of a dialog spam.
        if (err == null)
        {
            return;
        }

        if (string.Equals(err.Context, "client.update.required", StringComparison.OrdinalIgnoreCase))
        {
            _overlay.ShowUpdateInProgress(required: true, message: "Une mise à jour est requise pour continuer.\n\nTéléchargement / installation en cours…");
        }
    }

    private void OnUpdateFlow(ClientUpdateFlowState state)
    {
        if (state.Kind is ClientUpdateFlowKind.Enforcing or ClientUpdateFlowKind.InstallStarted)
        {
            _overlay.ShowUpdateInProgress(state.Required, state.Message);
            return;
        }

        if (state.Kind == ClientUpdateFlowKind.InstallFailed)
        {
            _overlay.ShowUpdateFailed(state.Required, state.Message);
        }
    }

    public void Dispose()
    {
        _ws.Connected -= OnConnected;
        _ws.Disconnected -= OnDisconnected;
        _ws.Reconnecting -= OnReconnecting;
        _overlay.RequestRetry -= OnRetryRequested;
        ClientUpdateCoordinator.FlowChanged -= OnUpdateFlow;
        _errorsSub.Dispose();
    }
}

