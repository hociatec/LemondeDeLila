using System.Net.NetworkInformation;
using Serilog;

namespace client_win.Core.Network;

/// <summary>
/// Moniteur de l'état du réseau. Détecte les changements de disponibilité réseau.
/// </summary>
public sealed class NetworkStateMonitor : IDisposable
{
    private bool _disposed;

    /// <summary>
    /// Déclenché lorsque le réseau devient disponible.
    /// </summary>
    public event Action? NetworkAvailable;

    /// <summary>
    /// Déclenché lorsque le réseau devient indisponible.
    /// </summary>
    public event Action? NetworkUnavailable;

    /// <summary>
    /// Indique si le réseau est actuellement disponible.
    /// </summary>
    public bool IsNetworkAvailable { get; private set; }

    public NetworkStateMonitor()
    {
        IsNetworkAvailable = NetworkInterface.GetIsNetworkAvailable();
        NetworkChange.NetworkAvailabilityChanged += OnNetworkAvailabilityChanged;

        Log.Information("NetworkStateMonitor initialisé. État réseau: {IsAvailable}",
            IsNetworkAvailable ? "Disponible" : "Indisponible");
    }

    private void OnNetworkAvailabilityChanged(object? sender, NetworkAvailabilityEventArgs e)
    {
        var wasAvailable = IsNetworkAvailable;
        IsNetworkAvailable = e.IsAvailable;

        if (e.IsAvailable && !wasAvailable)
        {
            Log.Information("✓ Réseau devenu DISPONIBLE");
            NetworkAvailable?.Invoke();
        }
        else if (!e.IsAvailable && wasAvailable)
        {
            Log.Warning("✗ Réseau devenu INDISPONIBLE");
            NetworkUnavailable?.Invoke();
        }
    }

    public void Dispose()
    {
        if (_disposed)
            return;

        NetworkChange.NetworkAvailabilityChanged -= OnNetworkAvailabilityChanged;
        _disposed = true;

        Log.Debug("NetworkStateMonitor disposed");
    }
}
