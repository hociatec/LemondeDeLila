namespace client_win.Core.Constants;

/// <summary>
/// Constantes globales de l'application.
/// </summary>
public static class AppConstants
{
    /// <summary>
    /// Délai anti-flood pour les dialogues d'erreur (en secondes).
    /// Empêche l'affichage de multiples dialogues d'erreur identiques dans cette fenêtre temporelle.
    /// </summary>
    public const int ErrorDialogAntiFloodSeconds = 5;

    /// <summary>
    /// Tolérance d'horloge pour la validation JWT (en minutes).
    /// Permet de compenser les différences d'horloge entre client et serveur.
    /// </summary>
    public const int JwtClockSkewMinutes = 1;

    /// <summary>
    /// Timeout de nettoyage du socket WebSocket (en millisecondes).
    /// Temps maximum d'attente pour la fermeture propre du socket lors du reset.
    /// </summary>
    public const int SocketCleanupTimeoutMs = 5000;

    /// <summary>
    /// Nom de l'application.
    /// </summary>
    public const string AppName = "Le Monde de Lila";

    /// <summary>
    /// Nom du dossier AppData pour l'application.
    /// </summary>
    public const string AppDataFolderName = "LeMondeDeLila";
}
