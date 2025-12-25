namespace client_win.Core.Network;

/// <summary>
/// Stratégie de retry avec exponential backoff et jitter.
/// </summary>
public static class RetryStrategy
{
    /// <summary>
    /// Calcule le délai avant la prochaine tentative avec exponential backoff et jitter.
    /// </summary>
    /// <param name="attempt">Numéro de la tentative (1-indexed).</param>
    /// <param name="baseDelayMs">Délai de base en millisecondes.</param>
    /// <param name="maxDelayMs">Délai maximum en millisecondes.</param>
    /// <returns>Délai calculé avec jitter.</returns>
    public static TimeSpan CalculateDelay(int attempt, int baseDelayMs, int maxDelayMs)
    {
        if (attempt <= 0)
            throw new ArgumentOutOfRangeException(nameof(attempt), "Attempt must be >= 1");

        // Exponential backoff: baseDelay * 2^(attempt-1)
        var exponentialDelay = baseDelayMs * Math.Pow(2, attempt - 1);
        exponentialDelay = Math.Min(exponentialDelay, maxDelayMs);

        // Jitter: ±25% aléatoire pour éviter synchronisation des clients
        var minJitter = (int)(exponentialDelay * 0.75);
        var maxJitter = (int)(exponentialDelay * 1.25);
        var jitterDelay = Random.Shared.Next(minJitter, maxJitter + 1);

        return TimeSpan.FromMilliseconds(jitterDelay);
    }

    /// <summary>
    /// Calcule le délai en utilisant la NetworkConfiguration fournie.
    /// </summary>
    /// <param name="attempt">Numéro de la tentative (1-indexed).</param>
    /// <param name="config">Configuration réseau.</param>
    /// <returns>Délai calculé avec jitter.</returns>
    public static TimeSpan CalculateDelay(int attempt, NetworkConfiguration config)
    {
        return CalculateDelay(attempt, config.InitialReconnectDelayMs, config.MaxReconnectDelayMs);
    }
}
