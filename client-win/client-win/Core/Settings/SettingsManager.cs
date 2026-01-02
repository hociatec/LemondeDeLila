using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using Serilog;

namespace client_win.Core.Settings;

/// <summary>
/// Gestionnaire de persistance des paramètres utilisateur au format JSON.
/// </summary>
/// <typeparam name="T">Type de settings à persister.</typeparam>
public sealed class SettingsManager<T> where T : class, new()
{
    private readonly string _filePath;
    private readonly object _lock = new();
    private T _currentSettings;
    private DateTime _lastSaveRequest = DateTime.MinValue;
    private Task? _debouncedSaveTask;

    /// <summary>
    /// Délai de debounce pour les sauvegardes automatiques (en millisecondes).
    /// </summary>
    public int DebounceDelayMs { get; set; } = 2000;

    /// <summary>
    /// Settings actuels (lecture/écriture).
    /// </summary>
    public T Current
    {
        get
        {
            lock (_lock)
            {
                return _currentSettings;
            }
        }
        set
        {
            lock (_lock)
            {
                _currentSettings = value ?? throw new ArgumentNullException(nameof(value));
            }
        }
    }

    public SettingsManager(string appDataPath, string fileName = "settings.json")
    {
        var settingsDirectory = Path.Combine(appDataPath, "settings");
        Directory.CreateDirectory(settingsDirectory);

        _filePath = Path.Combine(settingsDirectory, fileName);
        _currentSettings = Load();

        Log.Information("SettingsManager initialisé: {FilePath}", _filePath);
    }

    /// <summary>
    /// Charge les settings depuis le fichier JSON. Retourne des settings par défaut si le fichier n'existe pas.
    /// </summary>
    public T Load()
    {
        try
        {
            if (!File.Exists(_filePath))
            {
                Log.Information("Fichier settings introuvable, utilisation des valeurs par défaut: {FilePath}", _filePath);
                return new T();
            }

            var json = File.ReadAllText(_filePath);
            var options = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                PropertyNameCaseInsensitive = true,
            };
            var settings = JsonSerializer.Deserialize<T>(json, options);

            if (settings == null)
            {
                Log.Warning("Désérialisation settings a retourné null, utilisation des valeurs par défaut");
                return new T();
            }

            Log.Information("Settings chargés depuis {FilePath}", _filePath);
            return settings;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Échec du chargement des settings depuis {FilePath}, utilisation des valeurs par défaut", _filePath);
            return new T();
        }
    }

    /// <summary>
    /// Sauvegarde les settings actuels dans le fichier JSON.
    /// </summary>
    public void Save()
    {
        try
        {
            lock (_lock)
            {
                var options = new JsonSerializerOptions
                {
                    WriteIndented = true,
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                };

                var json = JsonSerializer.Serialize(_currentSettings, options);
                File.WriteAllText(_filePath, json);

                Log.Debug("Settings sauvegardés dans {FilePath}", _filePath);
            }
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Échec de la sauvegarde des settings dans {FilePath}", _filePath);
        }
    }

    /// <summary>
    /// Sauvegarde asynchrone avec debounce. Les appels répétés sont regroupés.
    /// </summary>
    public void SaveDebounced()
    {
        _lastSaveRequest = DateTime.UtcNow;

        if (_debouncedSaveTask == null || _debouncedSaveTask.IsCompleted)
        {
            _debouncedSaveTask = Task.Run(async () =>
            {
                while (true)
                {
                    var elapsed = DateTime.UtcNow - _lastSaveRequest;
                    if (elapsed.TotalMilliseconds >= DebounceDelayMs)
                    {
                        Save();
                        break;
                    }

                    await Task.Delay(DebounceDelayMs / 2);
                }
            });
        }
    }

    /// <summary>
    /// Met à jour les settings et déclenche une sauvegarde avec debounce.
    /// </summary>
    /// <param name="settings">Nouveaux settings.</param>
    public void UpdateAndSave(T settings)
    {
        Current = settings;
        SaveDebounced();
    }

    /// <summary>
    /// Force la sauvegarde immédiate (bloque jusqu'à completion de la sauvegarde debouncée en cours).
    /// </summary>
    public async Task FlushAsync()
    {
        if (_debouncedSaveTask != null && !_debouncedSaveTask.IsCompleted)
        {
            await _debouncedSaveTask;
        }
        Save();
    }
}
