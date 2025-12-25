namespace client_win.Core.Network;

/// <summary>
/// Configuration centralisée des paramètres réseau (timeouts, retry, buffers).
/// Chargé depuis variables d'environnement ou valeurs par défaut.
/// </summary>
public sealed class NetworkConfiguration
{
    /// <summary>
    /// Timeout d'envoi WebSocket en secondes.
    /// Variable: WS_SEND_TIMEOUT (défaut: 10)
    /// </summary>
    public int SendTimeoutSeconds { get; init; }

    /// <summary>
    /// Timeout de réception WebSocket en secondes.
    /// Variable: WS_RECEIVE_TIMEOUT (défaut: 45)
    /// </summary>
    public int ReceiveTimeoutSeconds { get; init; }

    /// <summary>
    /// Nombre maximum de tentatives de reconnexion.
    /// Variable: WS_MAX_RECONNECT_ATTEMPTS (défaut: 5)
    /// </summary>
    public int MaxReconnectAttempts { get; init; }

    /// <summary>
    /// Délai initial de reconnexion en millisecondes.
    /// Variable: WS_INITIAL_RECONNECT_DELAY_MS (défaut: 1000)
    /// </summary>
    public int InitialReconnectDelayMs { get; init; }

    /// <summary>
    /// Délai maximum de reconnexion en millisecondes.
    /// Variable: WS_MAX_RECONNECT_DELAY_MS (défaut: 30000)
    /// </summary>
    public int MaxReconnectDelayMs { get; init; }

    /// <summary>
    /// Intervalle de keep-alive WebSocket en secondes.
    /// Variable: WS_KEEPALIVE_INTERVAL_SECONDS (défaut: 30)
    /// </summary>
    public int KeepAliveIntervalSeconds { get; init; }

    /// <summary>
    /// Taille du buffer de réception WebSocket en octets.
    /// Variable: WS_RECEIVE_BUFFER_SIZE (défaut: 8192)
    /// </summary>
    public int ReceiveBufferSize { get; init; }

    /// <summary>
    /// Timeout de nettoyage du socket en millisecondes.
    /// Variable: WS_CLEANUP_TIMEOUT_MS (défaut: 5000)
    /// </summary>
    public int CleanupTimeoutMs { get; init; }

    /// <summary>
    /// Seuil du circuit breaker (nombre d'échecs consécutifs avant fail définitif).
    /// Variable: WS_CIRCUIT_BREAKER_THRESHOLD (défaut: 10)
    /// </summary>
    public int CircuitBreakerThreshold { get; init; }

    /// <summary>
    /// Fenêtre temporelle du circuit breaker en minutes.
    /// Variable: WS_CIRCUIT_BREAKER_WINDOW_MINUTES (défaut: 5)
    /// </summary>
    public int CircuitBreakerWindowMinutes { get; init; }

    /// <summary>
    /// Charge la configuration depuis les variables d'environnement ou utilise les valeurs par défaut.
    /// </summary>
    public static NetworkConfiguration Load()
    {
        return new NetworkConfiguration
        {
            SendTimeoutSeconds = GetEnvInt("WS_SEND_TIMEOUT", 10),
            ReceiveTimeoutSeconds = GetEnvInt("WS_RECEIVE_TIMEOUT", 45),
            MaxReconnectAttempts = GetEnvInt("WS_MAX_RECONNECT_ATTEMPTS", 5),
            InitialReconnectDelayMs = GetEnvInt("WS_INITIAL_RECONNECT_DELAY_MS", 1000),
            MaxReconnectDelayMs = GetEnvInt("WS_MAX_RECONNECT_DELAY_MS", 30000),
            KeepAliveIntervalSeconds = GetEnvInt("WS_KEEPALIVE_INTERVAL_SECONDS", 30),
            ReceiveBufferSize = GetEnvInt("WS_RECEIVE_BUFFER_SIZE", 8192),
            CleanupTimeoutMs = GetEnvInt("WS_CLEANUP_TIMEOUT_MS", 5000),
            CircuitBreakerThreshold = GetEnvInt("WS_CIRCUIT_BREAKER_THRESHOLD", 10),
            CircuitBreakerWindowMinutes = GetEnvInt("WS_CIRCUIT_BREAKER_WINDOW_MINUTES", 5)
        };
    }

    private static int GetEnvInt(string key, int defaultValue)
    {
        var value = Environment.GetEnvironmentVariable(key);
        if (string.IsNullOrWhiteSpace(value))
            return defaultValue;

        if (int.TryParse(value, out var result))
            return result;

        return defaultValue;
    }

    /// <summary>
    /// Retourne un résumé de la configuration pour logging.
    /// </summary>
    public override string ToString()
    {
        return $"NetworkConfig[Send={SendTimeoutSeconds}s, Recv={ReceiveTimeoutSeconds}s, " +
               $"MaxRetries={MaxReconnectAttempts}, KeepAlive={KeepAliveIntervalSeconds}s, " +
               $"Buffer={ReceiveBufferSize} bytes]";
    }
}
