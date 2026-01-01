using System;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading.Tasks;
using System.Windows;
using Microsoft.Win32;
using client_win.Core.Constants;
using client_win.Modules.Audio.Models;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private SoundId? _soundDetailsId;
    private AdminPage _soundDetailsReturnPage = AdminPage.Sounds;

    private void BuildSounds()
    {
        _page = AdminPage.Sounds;
        Title = "Administration - Sons";
        Details = "Gestion des sons de l'application.";
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Connexion", tag: "sounds.connection"));
        Items.Add(new AdminMenuItem("Table", tag: "sounds.table"));
        Items.Add(new AdminMenuItem("Amis", tag: "sounds.invitations"));
        Items.Add(new AdminMenuItem("Tchat", tag: "sounds.chat"));
        Items.Add(new AdminMenuItem("Messages privés", tag: "sounds.private"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : sélectionner. Échap : retour.";
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }

    private void BuildSoundsConnection()
    {
        _page = AdminPage.SoundsConnection;
        Title = "Administration - Sons - Connexion";
        Details = "Choisir un son lié au démarrage et à la connexion au serveur.";
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Ouverture du client", tag: "sounds.client.opened"));
        Items.Add(new AdminMenuItem("Connexion au serveur", tag: "sounds.client.connected"));
        Items.Add(new AdminMenuItem("Déconnexion du serveur", tag: "sounds.client.disconnected"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : sélectionner. Échap : retour.";
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }

    private void BuildSoundsInvitations()
    {
        _page = AdminPage.SoundsInvitations;
        Title = "Administration - Sons - Amis";
        Details = "Choisir un son lié aux demandes d'amis.";
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Demande d'ami envoyée", tag: "sounds.friend.invite.sent"));
        Items.Add(new AdminMenuItem("Demande d'ami reçue", tag: "sounds.friend.invite.received"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : sélectionner. Échap : retour.";
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }

    private void BuildSoundsTable()
    {
        _page = AdminPage.SoundsTable;
        Title = "Administration - Sons - Table";
        Details = "Choisir un son lié aux tables (entrée/sortie/invitations).";
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Entrer dans une table", tag: "sounds.table.enter"));
        Items.Add(new AdminMenuItem("Rejoindre une table", tag: "sounds.table.join"));
        Items.Add(new AdminMenuItem("Quitter une table", tag: "sounds.table.exit"));
        Items.Add(new AdminMenuItem("Invitation à une table envoyée", tag: "sounds.table.invite.sent"));
        Items.Add(new AdminMenuItem("Invitation à une table reçue", tag: "sounds.table.invite.received"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : sélectionner. Échap : retour.";
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }

    private void BuildSoundsChat()
    {
        _page = AdminPage.SoundsChat;
        Title = "Administration - Sons - Tchat";
        Details = "Choisir un son lié au tchat.";
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Envoi d'un message", tag: "sounds.chat.sent"));
        Items.Add(new AdminMenuItem("Réception d'un message", tag: "sounds.chat.received"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : sélectionner. Échap : retour.";
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }

    private void BuildSoundsPrivateMessages()
    {
        _page = AdminPage.SoundsPrivateMessages;
        Title = "Administration - Sons - Messages privés";
        Details = "Choisir un son lié aux messages privés.";
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Envoi d'un message privé", tag: "sounds.private.sent"));
        Items.Add(new AdminMenuItem("Réception d'un message privé", tag: "sounds.private.received"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : sélectionner. Échap : retour.";
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }

    private void BuildSoundDetails(SoundId sound)
    {
        _page = AdminPage.SoundDetails;
        _soundDetailsId = sound;
        _soundDetailsReturnPage = sound switch
        {
            SoundId.ClientOpened or SoundId.ClientConnected or SoundId.ClientDisconnected => AdminPage.SoundsConnection,
            SoundId.RoomOpened or SoundId.RoomJoined or SoundId.RoomExit => AdminPage.SoundsTable,
            SoundId.InvitationSent or SoundId.InvitationReceived => AdminPage.SoundsTable,
            SoundId.ChatMessageSent or SoundId.ChatMessageReceived => AdminPage.SoundsChat,
            SoundId.PrivateMessageSent or SoundId.PrivateMessageReceived => AdminPage.SoundsPrivateMessages,
            SoundId.FriendInvitationSent or SoundId.FriendInvitationReceived => AdminPage.SoundsInvitations,
            _ => AdminPage.Sounds
        };

        var (group, title, current) = sound switch
        {
            SoundId.ClientOpened => ("Connexion", "Ouverture du client", _options.Current.SoundClientOpenedPath),
            SoundId.ClientConnected => ("Connexion", "Connexion au serveur", _options.Current.SoundClientConnectedPath),
            SoundId.ClientDisconnected => ("Connexion", "Déconnexion du serveur", _options.Current.SoundClientDisconnectedPath),
            SoundId.RoomOpened => ("Table", "Entrer dans une table", _options.Current.SoundRoomOpenedPath),
            SoundId.RoomJoined => ("Table", "Rejoindre une table", _options.Current.SoundRoomJoinedPath),
            SoundId.RoomExit => ("Table", "Quitter une table", _options.Current.SoundRoomExitPath),
            SoundId.InvitationSent => ("Table", "Invitation à une table envoyée", _options.Current.SoundInvitationSentPath),
            SoundId.InvitationReceived => ("Table", "Invitation à une table reçue", _options.Current.SoundInvitationReceivedPath),
            SoundId.FriendInvitationSent => ("Amis", "Demande d'ami envoyée", _options.Current.SoundFriendInvitationSentPath),
            SoundId.FriendInvitationReceived => ("Amis", "Demande d'ami reçue", _options.Current.SoundFriendInvitationReceivedPath),
            SoundId.ChatMessageSent => ("Tchat", "Envoi d'un message", _options.Current.SoundChatMessageSentPath),
            SoundId.ChatMessageReceived => ("Tchat", "Réception d'un message", _options.Current.SoundChatMessageReceivedPath),
            SoundId.PrivateMessageSent => ("Messages privés", "Envoi d'un message privé", _options.Current.SoundPrivateMessageSentPath),
            SoundId.PrivateMessageReceived => ("Messages privés", "Réception d'un message privé", _options.Current.SoundPrivateMessageReceivedPath),
            _ => ("Sons", sound.ToString(), null)
        };

        Title = $"Administration - Sons - {group} - {title}";
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
        await UploadSoundToServerAsync(sound, src).ConfigureAwait(true);
        await _remoteSounds.RefreshAsync().ConfigureAwait(true);

        Details = "Son global (serveur).";
        _sounds.Play(sound);
    }

    private async Task UploadSoundToServerAsync(SoundId sound, string filePath)
    {
        var jwt = _session.CurrentUser?.Token;
        if (string.IsNullOrWhiteSpace(jwt))
        {
            await _dialogs.ShowError("Sons", "Connexion requise.").ConfigureAwait(true);
            return;
        }

        var endpoint = new Uri(_config.HttpBase, $"admin/sounds/{Uri.EscapeDataString(sound.ToString())}");

        byte[] bytes;
        try
        {
            bytes = await File.ReadAllBytesAsync(filePath).ConfigureAwait(true);
        }
        catch (Exception ex)
        {
            await _dialogs.ShowError("Sons", $"Impossible de lire le fichier : {ex.Message}").ConfigureAwait(true);
            return;
        }

        using var http = new HttpClient();
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", jwt);

        using var form = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(bytes);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("audio/mpeg");
        form.Add(fileContent, "file", Path.GetFileName(filePath));

        HttpResponseMessage resp;
        try
        {
            resp = await http.PostAsync(endpoint, form).ConfigureAwait(true);
        }
        catch (Exception ex)
        {
            await _dialogs.ShowError("Sons", $"Upload impossible : {ex.Message}").ConfigureAwait(true);
            return;
        }

        if (!resp.IsSuccessStatusCode)
        {
            var body = await resp.Content.ReadAsStringAsync().ConfigureAwait(true);
            await _dialogs.ShowError("Sons", $"Upload échoué ({(int)resp.StatusCode}) : {body}").ConfigureAwait(true);
            return;
        }

        await _dialogs.ShowInfo("Sons", "Son global mis à jour (serveur).").ConfigureAwait(true);
    }
}
