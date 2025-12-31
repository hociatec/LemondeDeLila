using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using Microsoft.Win32;
using client_win.Core.Constants;
using client_win.Modules.Audio.Models;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private SoundId? _soundDetailsId;

    private void BuildSounds()
    {
        _page = AdminPage.Sounds;
        Title = "Administration - Sons";
        Details = "Gestion des sons de l'application.";
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Table", tag: "sounds.table"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : sélectionner. Échap : retour.";
        UpdateFilterVisibility();
    }

    private void BuildSoundsTable()
    {
        _page = AdminPage.SoundsTable;
        Title = "Administration - Sons - Table";
        Details = "Choisir un son lié aux tables.";
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Entrer dans une table", tag: "sounds.table.enter"));
        Items.Add(new AdminMenuItem("Quitter une table", tag: "sounds.table.exit"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : sélectionner. Échap : retour.";
        UpdateFilterVisibility();
    }

    private void BuildSoundDetails(SoundId sound)
    {
        _page = AdminPage.SoundDetails;
        _soundDetailsId = sound;

        var (title, current) = sound switch
        {
            SoundId.RoomOpened => ("Entrer dans une table", _options.Current.SoundRoomOpenedPath),
            SoundId.RoomExit => ("Quitter une table", _options.Current.SoundRoomExitPath),
            _ => (sound.ToString(), null)
        };

        Title = $"Administration - Sons - Table - {title}";
        Details = string.IsNullOrWhiteSpace(current)
            ? "Son par défaut (Assets)."
            : $"Son personnalisé : {current}";

        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Aperçu (Entrée pour écouter)", tag: "sound.preview"));
        Items.Add(new AdminMenuItem("Changer (Entrée pour choisir un fichier .mp3)", tag: "sound.change"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Tab/Entrée : action. Échap : retour.";
        UpdateFilterVisibility();

        // Aperçu immédiat quand on entre dans le son (comme demandé).
        _sounds.Play(sound);
    }

    private async Task ChangeSoundAsync(SoundId sound)
    {
        // On reste sur le thread UI (OpenFileDialog).
        if (Application.Current != null && !_dispatcher.CheckAccess())
        {
            await _dispatcher.InvokeAsync(() => ChangeSoundAsync(sound)).Task.ConfigureAwait(true);
            return;
        }

        var dialog = new OpenFileDialog
        {
            Title = "Choisir un son (.mp3)",
            Filter = "Fichiers audio (*.mp3)|*.mp3",
            Multiselect = false,
            CheckFileExists = true,
            CheckPathExists = true
        };

        var ok = dialog.ShowDialog(Application.Current?.MainWindow) == true;
        if (!ok)
        {
            return;
        }

        var src = dialog.FileName;
        if (string.IsNullOrWhiteSpace(src) || !File.Exists(src))
        {
            await _dialogs.ShowError("Sons", "Fichier introuvable.").ConfigureAwait(true);
            return;
        }

        string destName = sound switch
        {
            SoundId.RoomOpened => "roomopened.mp3",
            SoundId.RoomExit => "roomexit.mp3",
            _ => $"{sound.ToString().ToLowerInvariant()}.mp3"
        };

        var appData = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            AppConstants.AppDataFolderName);
        var soundsDir = Path.Combine(appData, "sounds");
        Directory.CreateDirectory(soundsDir);
        var dest = Path.Combine(soundsDir, destName);

        try
        {
            File.Copy(src, dest, overwrite: true);
        }
        catch (Exception ex)
        {
            await _dialogs.ShowError("Sons", $"Impossible de copier le fichier : {ex.Message}").ConfigureAwait(true);
            return;
        }

        // Persister dans les options (survit aux mises à jour ClickOnce).
        switch (sound)
        {
            case SoundId.RoomOpened:
                _options.Current.SoundRoomOpenedPath = dest;
                break;
            case SoundId.RoomExit:
                _options.Current.SoundRoomExitPath = dest;
                break;
        }
        _options.Update(_options.Current);

        Details = $"Son personnalisé : {dest}";

        // Recharge les players si besoin et donne un aperçu.
        _sounds.PreloadAll();
        _sounds.Play(sound);
    }
}

