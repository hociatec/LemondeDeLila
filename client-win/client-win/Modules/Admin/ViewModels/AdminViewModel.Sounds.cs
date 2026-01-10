using System;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows;
using Microsoft.Win32;
using client_win.Core.Constants;
using client_win.Core.Network;
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
        Items.Add(new AdminMenuItem("Ambiance", tag: "sounds.ambience"));
        Items.Add(new AdminMenuItem("Table", tag: "sounds.table"));
        Items.Add(new AdminMenuItem("Amis", tag: "sounds.invitations"));
        Items.Add(new AdminMenuItem("Tchat", tag: "sounds.chat"));
        Items.Add(new AdminMenuItem("Messages privés", tag: "sounds.private"));
        Items.Add(new AdminMenuItem("Contact admin", tag: "sounds.adminContact"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : sélectionner. Échap : retour.";
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }

    private void BuildSoundsAmbience()
    {
        _page = AdminPage.SoundsAmbience;
        Title = "Administration - Sons - Ambiance";
        Details = "Choisir un son d'ambiance en boucle (menu principal / taverne).";
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Musique du menu principal", tag: "sounds.ambience.menu"));
        Items.Add(new AdminMenuItem("Ambiance de la taverne", tag: "sounds.ambience.tavern"));
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
        Details = "Choisir un son lié aux amis (présence, demandes).";
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Ami connecté", tag: "sounds.friend.connected"));
        Items.Add(new AdminMenuItem("Ami déconnecté", tag: "sounds.friend.disconnected"));
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
        Details = "Choisir un son lié aux tables et à la partie (entrée/sortie, invit, victoire/défaite).";
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Victoire (fin de partie)", tag: "sounds.game.victory"));
        Items.Add(new AdminMenuItem("Défaite (fin de partie)", tag: "sounds.game.defeat"));
        Items.Add(new AdminMenuItem("Entrer dans une table", tag: "sounds.table.enter"));
        Items.Add(new AdminMenuItem("Rejoindre une table", tag: "sounds.table.join"));
        Items.Add(new AdminMenuItem("Quitter une table", tag: "sounds.table.exit"));
        Items.Add(new AdminMenuItem("Pion : prendre (vous)", tag: "sounds.table.pawn.picked"));
        Items.Add(new AdminMenuItem("Pion : poser (vous)", tag: "sounds.table.pawn.placed.self"));
        Items.Add(new AdminMenuItem("Pion : poser (adversaire)", tag: "sounds.table.pawn.placed.opponent"));
        Items.Add(new AdminMenuItem("Invitation à une table envoyée", tag: "sounds.table.invite.sent"));
        Items.Add(new AdminMenuItem("Invitation à une table reçue", tag: "sounds.table.invite.received"));
        Items.Add(new AdminMenuItem("Tchat de table : message envoyé", tag: "sounds.table.chat.sent"));
        Items.Add(new AdminMenuItem("Tchat de table : message reçu", tag: "sounds.table.chat.received"));
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

    private void BuildSoundsAdminContact()
    {
        _page = AdminPage.SoundsAdminContact;
        Title = "Administration - Sons - Contact admin";
        Details = "Choisir un son lié aux messages de contact admin.";
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Envoi d'un contact admin", tag: "sounds.adminContact.sent"));
        Items.Add(new AdminMenuItem("Réception d'un contact admin", tag: "sounds.adminContact.received"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : sélectionner. Échap : retour.";
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }

    private void BuildSoundDetails(
        SoundId sound,
        AdminPage? returnPageOverride = null,
        string? groupOverride = null,
        string? titleOverride = null)
    {
        _page = AdminPage.SoundDetails;
        _soundDetailsId = sound;
        _soundDetailsReturnPage = returnPageOverride ?? sound switch
        {
            SoundId.ClientOpened or SoundId.ClientConnected or SoundId.ClientDisconnected => AdminPage.SoundsConnection,
            SoundId.MainMenuMusic or SoundId.TavernAmbience => AdminPage.SoundsAmbience,
            SoundId.GameVictory or SoundId.GameDefeat or SoundId.RoomOpened or SoundId.RoomJoined or SoundId.RoomExit or SoundId.PawnPicked or SoundId.PawnPlacedSelf or SoundId.PawnPlacedOpponent => AdminPage.SoundsTable,
            SoundId.InvitationSent or SoundId.InvitationReceived => AdminPage.SoundsTable,
            SoundId.ChatMessageSent or SoundId.ChatMessageReceived => AdminPage.SoundsChat,
            SoundId.PrivateMessageSent or SoundId.PrivateMessageReceived => AdminPage.SoundsPrivateMessages,
            SoundId.AdminContactSent or SoundId.AdminContactReceived => AdminPage.SoundsAdminContact,
            SoundId.FriendConnected or SoundId.FriendDisconnected or SoundId.FriendInvitationSent or SoundId.FriendInvitationReceived => AdminPage.SoundsInvitations,
            _ => AdminPage.Sounds
        };

        var (group, title, current) = sound switch
        {
            SoundId.ClientOpened => ("Connexion", "Ouverture du client", _options.Current.SoundClientOpenedPath),
            SoundId.ClientConnected => ("Connexion", "Connexion au serveur", _options.Current.SoundClientConnectedPath),
            SoundId.ClientDisconnected => ("Connexion", "Déconnexion du serveur", _options.Current.SoundClientDisconnectedPath),
            SoundId.MainMenuMusic => ("Ambiance", "Musique du menu principal", null),
            SoundId.TavernAmbience => ("Ambiance", "Ambiance de la taverne", null),
            SoundId.GameVictory => ("Table", "Victoire (fin de partie)", _options.Current.SoundGameVictoryPath),
            SoundId.GameDefeat => ("Table", "Défaite (fin de partie)", _options.Current.SoundGameDefeatPath),
            SoundId.RoomOpened => ("Table", "Entrer dans une table", _options.Current.SoundRoomOpenedPath),
            SoundId.RoomJoined => ("Table", "Rejoindre une table", _options.Current.SoundRoomJoinedPath),
            SoundId.RoomExit => ("Table", "Quitter une table", _options.Current.SoundRoomExitPath),
            SoundId.InvitationSent => ("Table", "Invitation à une table envoyée", _options.Current.SoundInvitationSentPath),
            SoundId.InvitationReceived => ("Table", "Invitation à une table reçue", _options.Current.SoundInvitationReceivedPath),
            SoundId.FriendConnected => ("Amis", "Ami connecté", _options.Current.SoundFriendConnectedPath),
            SoundId.FriendDisconnected => ("Amis", "Ami déconnecté", _options.Current.SoundFriendDisconnectedPath),
            SoundId.FriendInvitationSent => ("Amis", "Demande d'ami envoyée", _options.Current.SoundFriendInvitationSentPath),
            SoundId.FriendInvitationReceived => ("Amis", "Demande d'ami reçue", _options.Current.SoundFriendInvitationReceivedPath),
            SoundId.ChatMessageSent => ("Tchat", "Envoi d'un message", _options.Current.SoundChatMessageSentPath),
            SoundId.ChatMessageReceived => ("Tchat", "Réception d'un message", _options.Current.SoundChatMessageReceivedPath),
            SoundId.PrivateMessageSent => ("Messages privés", "Envoi d'un message privé", _options.Current.SoundPrivateMessageSentPath),
            SoundId.PrivateMessageReceived => ("Messages privés", "Réception d'un message privé", _options.Current.SoundPrivateMessageReceivedPath),
            SoundId.AdminContactSent => ("Contact admin", "Envoi d'un contact admin", null),
            SoundId.PawnPicked => ("Table", "Pion - Prendre (vous)", _options.Current.SoundPawnPickedPath),
            SoundId.PawnPlacedSelf => ("Table", "Pion - Poser (vous)", _options.Current.SoundPawnPlacedSelfPath),
            SoundId.PawnPlacedOpponent => ("Table", "Pion - Poser (adversaire)", _options.Current.SoundPawnPlacedOpponentPath),
            SoundId.AdminContactReceived => ("Contact admin", "Réception d'un contact admin", null),
            _ => ("Sons", sound.ToString(), null)
        };

        if (!string.IsNullOrWhiteSpace(groupOverride))
        {
            group = groupOverride;
        }

        if (!string.IsNullOrWhiteSpace(titleOverride))
        {
            title = titleOverride;
        }

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

        using var form = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(bytes);
        var ext = Path.GetExtension(filePath ?? string.Empty).ToLowerInvariant();
        var mime = ext == ".wav"
            ? "audio/wav"
            : ext == ".mp3"
                ? "audio/mpeg"
                : "application/octet-stream";
        fileContent.Headers.ContentType = new MediaTypeHeaderValue(mime);
        form.Add(fileContent, "file", Path.GetFileName(filePath) ?? "sound.mp3");

        HttpResponseMessage resp;
        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, endpoint);
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", jwt);
            req.Content = form;
            resp = await HttpClientProvider.Shared.SendAsync(req).ConfigureAwait(true);
        }
        catch (Exception ex)
        {
            await _dialogs.ShowError("Sons", $"Upload impossible : {ex.Message}").ConfigureAwait(true);
            return;
        }

        if (!resp.IsSuccessStatusCode)
        {
            var body = await resp.Content.ReadAsStringAsync().ConfigureAwait(true);
            var message = ApiErrorParser.TryExtractMessage(body) ?? body;
            await _dialogs.ShowError("Sons", $"Upload échoué ({(int)resp.StatusCode}) : {message}").ConfigureAwait(true);
            return;
        }

        await _dialogs.ShowInfo("Sons", "Son global mis à jour (serveur).").ConfigureAwait(true);
    }

}
