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
using client_win.Modules.Admin.Dtos;
using client_win.Modules.Audio.Models;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private SoundId? _soundDetailsId;
    private AdminPage _soundDetailsReturnPage = AdminPage.Sounds;
    private bool _tableAmbiencesRefreshInProgress;

    public void StopSoundPreview() => _sounds.StopPreview();

    private void BuildSounds()
	    {
	        _page = AdminPage.Sounds;
	        Title = "Administration - Sons";
	        Details = "Gestion des sons de l'application.";
        PreferDetailsFocus = false;
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
	        Items.Clear();
	        Items.Add(new AdminMenuItem("Connexion", tag: "sounds.connection"));
	        Items.Add(new AdminMenuItem("Ambiance", tag: "sounds.ambience"));
	        Items.Add(new AdminMenuItem("Table", tag: "sounds.table"));
	        Items.Add(new AdminMenuItem("Jeux", tag: "sounds.games"));
	        Items.Add(new AdminMenuItem("Amis", tag: "sounds.invitations"));
	        Items.Add(new AdminMenuItem("Tchat", tag: "sounds.chat"));
	        Items.Add(new AdminMenuItem("Messages privés", tag: "sounds.private"));
	        Items.Add(new AdminMenuItem("Contact admin", tag: "sounds.adminContact"));
	        Items.Add(new AdminMenuItem("Nettoyer les sons inutilisés", tag: "sounds.cleanup"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : sélectionner. Échap : retour.";
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }

    private async Task CleanupUnusedSoundsAsync()
    {
        var jwt = _session.CurrentUser?.Token;
        if (string.IsNullOrWhiteSpace(jwt))
        {
            await _dialogs.ShowError("Sons", "Connexion requise.").ConfigureAwait(true);
            return;
        }

        var confirm = await _dialogs.Confirm(
                "Sons",
                "Supprimer les sons (fichiers) qui ne sont plus utilisés ?",
                okText: "Nettoyer",
                cancelText: "Annuler")
            .ConfigureAwait(true);
        if (confirm != true)
        {
            return;
        }

        var endpoint = new Uri(_config.HttpBase, "admin/sounds/cleanup");

        HttpResponseMessage resp;
        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, endpoint);
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", jwt);
            req.Content = new StringContent("{}", System.Text.Encoding.UTF8, "application/json");
            resp = await HttpClientProvider.Shared.SendAsync(req).ConfigureAwait(true);
        }
        catch (Exception ex)
        {
            await _dialogs.ShowError("Sons", $"Nettoyage impossible : {ex.Message}").ConfigureAwait(true);
            return;
        }

        if (!resp.IsSuccessStatusCode)
        {
            var body = await resp.Content.ReadAsStringAsync().ConfigureAwait(true);
            var message = ApiErrorParser.TryExtractMessage(body) ?? body;
            await _dialogs.ShowError("Sons", $"Nettoyage échoué ({(int)resp.StatusCode}) : {message}").ConfigureAwait(true);
            return;
        }

        string info;
        try
        {
            var json = await resp.Content.ReadAsStringAsync().ConfigureAwait(true);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            var deletedFiles = root.TryGetProperty("deletedFiles", out var df) && df.ValueKind == JsonValueKind.Number
                ? df.GetInt32()
                : 0;
            var deletedDirs = root.TryGetProperty("deletedDirs", out var dd) && dd.ValueKind == JsonValueKind.Number
                ? dd.GetInt32()
                : 0;
            info = $"Nettoyage terminé. Fichiers supprimés : {deletedFiles}. Dossiers supprimés : {deletedDirs}.";
        }
        catch
        {
            info = "Nettoyage terminé.";
        }

        await _dialogs.ShowInfo("Sons", info).ConfigureAwait(true);
        await _remoteSounds.RefreshAsync(force: true).ConfigureAwait(true);
    }

    private void BuildSoundsAmbience()
    {
        _page = AdminPage.SoundsAmbience;
        Title = "Administration - Sons - Ambiance";
        Details = "Choisir un son d'ambiance (boucles) et un son à l'ouverture de la taverne.";
        PreferDetailsFocus = false;
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Musique du menu principal", tag: "sounds.ambience.menu"));
        Items.Add(new AdminMenuItem("Ouverture de la taverne", tag: "sounds.ambience.tavern.opened"));
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
        PreferDetailsFocus = false;
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Ouverture du client", tag: "sounds.client.opened"));
        Items.Add(new AdminMenuItem("Fermeture du client", tag: "sounds.client.closing"));
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
        PreferDetailsFocus = false;
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
	        Details = "Choisir un son lié aux tables (entrée/sortie, invitations, fin de partie).";
            PreferDetailsFocus = false;
	        IsTextInputVisible = false;
	        IsSecondaryInputVisible = false;
	        IsAdditionalPermissionsVisible = false;
	        Items.Clear();
	        Items.Add(new AdminMenuItem("Victoire (fin de partie)", tag: "sounds.game.victory"));
	        Items.Add(new AdminMenuItem("Défaite (fin de partie)", tag: "sounds.game.defeat"));
	        Items.Add(new AdminMenuItem("Ambiances de table", tag: "sounds.table.ambience"));
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

        private void BuildSoundsTableAmbience()
        {
            _page = AdminPage.SoundsTableAmbience;
            Title = "Administration - Table - Ambiances";
            Details = "Créer, renommer, supprimer des ambiances de table, et associer un son (.mp3).";
            PreferDetailsFocus = false;
            IsTextInputVisible = false;
            IsSecondaryInputVisible = false;
            IsAdditionalPermissionsVisible = false;
            Items.Clear();
            Items.Add(new AdminMenuItem("Ajouter une ambiance de table", tag: "tableAmbience.create"));

            var list = _tableAmbiences ?? Array.Empty<AdminTableAmbienceDto>();
            foreach (var a in list.OrderBy(a => a.Name, StringComparer.OrdinalIgnoreCase))
            {
                var configured = false;
                if (Enum.TryParse<SoundId>(a.SoundId ?? string.Empty, ignoreCase: true, out var sid))
                {
                    configured = _remoteSounds.TryGetPath(sid) != null;
                }

                var status = configured ? " (configurée)" : " (sans son)";
                Items.Add(new AdminMenuItem($"{a.Name}{status}", tag: a));
            }

            SelectedItem = Items.FirstOrDefault(i => i.Tag is AdminTableAmbienceDto) ?? Items.FirstOrDefault();
            Status = "Entrée : sélectionner. Échap : retour.";
            UpdateFilterVisibility();
            RestoreFocusIfAny();

            // Rafraîchit en arrière-plan (best effort) pour afficher les dernières ambiances.
            _ = RefreshTableAmbiencesAsync();
        }

        private void BuildSoundsTableAmbienceActions(AdminTableAmbienceDto ambience)
        {
            _page = AdminPage.SoundsTableAmbienceActions;
            _selectedTableAmbience = ambience;
            Title = $"Administration - Table - Ambiance : {ambience?.Name}";
            Details = ambience?.SoundId ?? string.Empty;
            PreferDetailsFocus = false;
            IsTextInputVisible = false;
            IsSecondaryInputVisible = false;
            IsAdditionalPermissionsVisible = false;
            Items.Clear();
            Items.Add(new AdminMenuItem("Renommer", tag: "tableAmbience.rename"));
            Items.Add(new AdminMenuItem("Changer le son (.mp3)", tag: "tableAmbience.sound"));
            Items.Add(new AdminMenuItem("Supprimer", tag: "tableAmbience.delete"));
            SelectedItem = Items.FirstOrDefault();
            Status = "Entrée : action. Échap : retour.";
            UpdateFilterVisibility();
            RestoreFocusIfAny();
        }

        private sealed class TableAmbiencesFileDto
        {
            public string? UpdatedAt { get; set; }
            public AdminTableAmbienceDto[]? Items { get; set; }
        }

        private async Task RefreshTableAmbiencesAsync(bool force = false)
        {
            if (_tableAmbiencesRefreshInProgress && !force)
            {
                return;
            }

            if (IsBusy && !force)
            {
                return;
            }

            var jwt = _session.CurrentUser?.Token;
            if (string.IsNullOrWhiteSpace(jwt))
            {
                return;
            }

            try
            {
                _tableAmbiencesRefreshInProgress = true;
                IsBusy = true;

                try { await _remoteSounds.RefreshAsync(force: false).ConfigureAwait(true); } catch { }

                var endpoint = new Uri(_config.HttpBase, "admin/sounds/table-ambiences");
                using var req = new HttpRequestMessage(HttpMethod.Get, endpoint);
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", jwt);
                using var resp = await HttpClientProvider.Shared.SendAsync(req).ConfigureAwait(true);
                var body = await resp.Content.ReadAsStringAsync().ConfigureAwait(true);
                if (!resp.IsSuccessStatusCode)
                {
                    return;
                }

                var dto = JsonSerializer.Deserialize<TableAmbiencesFileDto>(body, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
                _tableAmbiences = dto?.Items ?? Array.Empty<AdminTableAmbienceDto>();

                if (_page == AdminPage.SoundsTableAmbience)
                {
                    // Re-render with fresh data.
                    BuildSoundsTableAmbience();
                    NavigationChanged?.Invoke();
                }
            }
            catch
            {
                // ignore
            }
            finally
            {
                IsBusy = false;
                _tableAmbiencesRefreshInProgress = false;
            }
        }

        private void BuildTableAmbienceNameForm(string mode, string title, string initialValue)
        {
            _page = AdminPage.EditText;
            _currentEditMode = mode;
            Title = title;
            Items.Clear();
            Items.Add(new AdminMenuItem("Valider", tag: "tableAmbience.submit"));
            SelectedItem = Items.FirstOrDefault();
            PrimaryInputAcceptsReturn = true;
            TextInputLabel = "Nom";
            TextInput = initialValue ?? string.Empty;
            SecondaryInputLabel = string.Empty;
            SecondaryInput = string.Empty;
            IsTextInputVisible = true;
            IsSecondaryInputVisible = false;
            IsAdditionalPermissionsVisible = false;
            Details = string.Equals(mode, "tableAmbience.create", StringComparison.OrdinalIgnoreCase)
                ? "Donnez un nom Ã  l'ambiance. Le fichier .mp3 se choisit ensuite via \"Changer le son (.mp3)\"."
                : string.Empty;
            Status = "Saisissez puis Entrée pour valider. Échap : retour.";
            UpdateFilterVisibility();
            RestoreFocusIfAny();
        }

        private async Task SubmitTableAmbienceAsync()
        {
            var jwt = _session.CurrentUser?.Token;
            if (string.IsNullOrWhiteSpace(jwt))
            {
                await _dialogs.ShowError("Ambiances", "Connexion requise.").ConfigureAwait(true);
                return;
            }

            var name = (TextInput ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(name))
            {
                await _dialogs.ShowError("Ambiances", "Nom requis.").ConfigureAwait(true);
                return;
            }

            var mode = _currentEditMode ?? string.Empty;

            IsBusy = true;
            try
            {
                if (string.Equals(mode, "tableAmbience.create", StringComparison.OrdinalIgnoreCase))
                {
                    var endpoint = new Uri(_config.HttpBase, "admin/sounds/table-ambiences");
                    using var req = new HttpRequestMessage(HttpMethod.Post, endpoint);
                    req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", jwt);
                    req.Content = new StringContent(JsonSerializer.Serialize(new { name }), System.Text.Encoding.UTF8, "application/json");
                    using var resp = await HttpClientProvider.Shared.SendAsync(req).ConfigureAwait(true);
                    var body = await resp.Content.ReadAsStringAsync().ConfigureAwait(true);
                    if (!resp.IsSuccessStatusCode)
                    {
                        var message = ApiErrorParser.TryExtractMessage(body) ?? body;
                        if (message.Contains("Nombre maximum atteint", StringComparison.OrdinalIgnoreCase))
                        {
                            message += " (Supprimez une ambiance existante pour libÃ©rer un slot.)";
                        }
                        await _dialogs.ShowError("Ambiances", $"Création échouée ({(int)resp.StatusCode}) : {message}").ConfigureAwait(true);
                        return;
                    }

                    string? createdSoundId = null;
                    try
                    {
                        using var doc = JsonDocument.Parse(body);
                        if (doc.RootElement.ValueKind == JsonValueKind.Object &&
                            doc.RootElement.TryGetProperty("soundId", out var sid) &&
                            sid.ValueKind == JsonValueKind.String)
                        {
                            createdSoundId = (sid.GetString() ?? string.Empty).Trim();
                        }
                    }
                    catch
                    {
                        // ignore
                    }

                    await RefreshTableAmbiencesAsync(force: true).ConfigureAwait(true);
                    var created = !string.IsNullOrWhiteSpace(createdSoundId)
                        ? (_tableAmbiences ?? Array.Empty<AdminTableAmbienceDto>()).FirstOrDefault(a =>
                            string.Equals((a.SoundId ?? string.Empty).Trim(), createdSoundId, StringComparison.OrdinalIgnoreCase))
                        : null;
                    if (created != null)
                    {
                        BuildSoundsTableAmbienceActions(created);
                    }
                    else
                    {
                        BuildSoundsTableAmbience();
                    }
                    NavigationChanged?.Invoke();
                    await _dialogs.ShowInfo("Ambiances", "Ambiance créée.").ConfigureAwait(true);
                    return;
                }

                if (string.Equals(mode, "tableAmbience.rename", StringComparison.OrdinalIgnoreCase))
                {
                    var selected = _selectedTableAmbience;
                    if (selected == null || string.IsNullOrWhiteSpace(selected.SoundId))
                    {
                        await _dialogs.ShowError("Ambiances", "Ambiance introuvable.").ConfigureAwait(true);
                        return;
                    }

                    var endpoint = new Uri(_config.HttpBase, $"admin/sounds/table-ambiences/{Uri.EscapeDataString(selected.SoundId)}");
                    using var req = new HttpRequestMessage(HttpMethod.Put, endpoint);
                    req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", jwt);
                    req.Content = new StringContent(JsonSerializer.Serialize(new { name }), System.Text.Encoding.UTF8, "application/json");
                    using var resp = await HttpClientProvider.Shared.SendAsync(req).ConfigureAwait(true);
                    var body = await resp.Content.ReadAsStringAsync().ConfigureAwait(true);
                    if (!resp.IsSuccessStatusCode)
                    {
                        var message = ApiErrorParser.TryExtractMessage(body) ?? body;
                        await _dialogs.ShowError("Ambiances", $"Renommage échoué ({(int)resp.StatusCode}) : {message}").ConfigureAwait(true);
                        return;
                    }

                    selected.Name = name;
                    await RefreshTableAmbiencesAsync(force: true).ConfigureAwait(true);
                    BuildSoundsTableAmbienceActions(selected);
                    NavigationChanged?.Invoke();
                    await _dialogs.ShowInfo("Ambiances", "Ambiance renommée.").ConfigureAwait(true);
                    return;
                }
            }
            finally
            {
                IsBusy = false;
            }
        }

        private async Task DeleteTableAmbienceAsync(AdminTableAmbienceDto ambience)
        {
            var jwt = _session.CurrentUser?.Token;
            if (string.IsNullOrWhiteSpace(jwt))
            {
                await _dialogs.ShowError("Ambiances", "Connexion requise.").ConfigureAwait(true);
                return;
            }

            if (ambience == null || string.IsNullOrWhiteSpace(ambience.SoundId))
            {
                await _dialogs.ShowError("Ambiances", "Ambiance introuvable.").ConfigureAwait(true);
                return;
            }

            var confirm = await _dialogs.Confirm(
                    "Ambiances",
                    $"Supprimer l'ambiance \"{ambience.Name}\" ? (Le son associé sera aussi supprimé.)",
                    okText: "Supprimer",
                    cancelText: "Annuler")
                .ConfigureAwait(true);

            if (confirm != true)
            {
                return;
            }

            IsBusy = true;
            try
            {
                var endpoint = new Uri(_config.HttpBase, $"admin/sounds/table-ambiences/{Uri.EscapeDataString(ambience.SoundId)}");
                using var req = new HttpRequestMessage(HttpMethod.Delete, endpoint);
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", jwt);
                using var resp = await HttpClientProvider.Shared.SendAsync(req).ConfigureAwait(true);
                var body = await resp.Content.ReadAsStringAsync().ConfigureAwait(true);
                if (!resp.IsSuccessStatusCode)
                {
                    var message = ApiErrorParser.TryExtractMessage(body) ?? body;
                    await _dialogs.ShowError("Ambiances", $"Suppression échouée ({(int)resp.StatusCode}) : {message}").ConfigureAwait(true);
                    return;
                }

                _selectedTableAmbience = null;
                await RefreshTableAmbiencesAsync(force: true).ConfigureAwait(true);
                BuildSoundsTableAmbience();
                NavigationChanged?.Invoke();
                await _dialogs.ShowInfo("Ambiances", "Ambiance supprimée.").ConfigureAwait(true);
            }
            finally
            {
                IsBusy = false;
            }
        }

	    private void BuildSoundsGames()
	    {
	        _page = AdminPage.SoundsGames;
	        Title = "Administration - Sons - Jeux";
	        Details = "Choisir un son lié aux actions en jeu (pion, mur, dé, quiz).";
            PreferDetailsFocus = false;
	        IsTextInputVisible = false;
	        IsSecondaryInputVisible = false;
	        IsAdditionalPermissionsVisible = false;
	        Items.Clear();
	        Items.Add(new AdminMenuItem("Dé : lancer", tag: "sounds.games.dice.rolled"));
            Items.Add(new AdminMenuItem("Quiz : bonne réponse", tag: "sounds.games.quiz.correct"));
            Items.Add(new AdminMenuItem("Quiz : mauvaise réponse", tag: "sounds.games.quiz.wrong"));
            Items.Add(new AdminMenuItem("Fin de manche", tag: "sounds.games.round.ended"));
	        Items.Add(new AdminMenuItem("Pion : prendre (vous)", tag: "sounds.games.pawn.picked"));
	        Items.Add(new AdminMenuItem("Pion : poser (vous)", tag: "sounds.games.pawn.placed.self"));
	        Items.Add(new AdminMenuItem("Pion : poser (adversaire)", tag: "sounds.games.pawn.placed.opponent"));
	        Items.Add(new AdminMenuItem("Mur : poser (vous)", tag: "sounds.games.wall.placed.self"));
	        Items.Add(new AdminMenuItem("Mur : poser (adversaire)", tag: "sounds.games.wall.placed.opponent"));
	        SelectedItem = Items.FirstOrDefault();
	        Status = "Entrée : sélectionner. Échap : retour.";
	        UpdateFilterVisibility();
	        RestoreFocusIfAny();
	    }

	    private void BuildSoundsChat()
	    {
	        _page = AdminPage.SoundsChat;
	        Title = "Administration - Sons - Tchat";
	        Details = "Choisir les sons du tchat.";
            PreferDetailsFocus = false;
	        IsTextInputVisible = false;
	        IsSecondaryInputVisible = false;
	        IsAdditionalPermissionsVisible = false;
	        Items.Clear();
	        Items.Add(new AdminMenuItem("Tchat général", tag: "sounds.chat.general"));
	        Items.Add(new AdminMenuItem("Tchat de table", tag: "sounds.chat.table"));
	        SelectedItem = Items.FirstOrDefault();
	        Status = "Entrée : sélectionner. Échap : retour.";
	        UpdateFilterVisibility();
	        RestoreFocusIfAny();
	    }
	
	    private void BuildSoundsChatGeneral()
	    {
	        _page = AdminPage.SoundsChatGeneral;
	        Title = "Administration - Sons - Tchat - Général";
	        Details = "Choisir un son lié au tchat général.";
            PreferDetailsFocus = false;
	        IsTextInputVisible = false;
	        IsSecondaryInputVisible = false;
	        IsAdditionalPermissionsVisible = false;
	        Items.Clear();
	        Items.Add(new AdminMenuItem("Envoi d'un message", tag: "sounds.chat.general.sent"));
	        Items.Add(new AdminMenuItem("Réception d'un message", tag: "sounds.chat.general.received"));
	        SelectedItem = Items.FirstOrDefault();
	        Status = "Entrée : sélectionner. Échap : retour.";
	        UpdateFilterVisibility();
	        RestoreFocusIfAny();
	    }
	
	    private void BuildSoundsChatTable()
	    {
	        _page = AdminPage.SoundsChatTable;
	        Title = "Administration - Sons - Tchat - Table";
	        Details = "Choisir un son lié au tchat de table.";
            PreferDetailsFocus = false;
	        IsTextInputVisible = false;
	        IsSecondaryInputVisible = false;
	        IsAdditionalPermissionsVisible = false;
	        Items.Clear();
	        Items.Add(new AdminMenuItem("Envoi d'un message", tag: "sounds.chat.table.sent"));
	        Items.Add(new AdminMenuItem("Réception d'un message", tag: "sounds.chat.table.received"));
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
        PreferDetailsFocus = false;
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
        PreferDetailsFocus = false;
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
        // Assure qu'on ne superpose pas plusieurs sons d'aperçu quand on passe d'un son à un autre.
        _sounds.StopPreview();

        _page = AdminPage.SoundDetails;
        _soundDetailsId = sound;
	        _soundDetailsReturnPage = returnPageOverride ?? sound switch
	        {
	            SoundId.ClientOpened or SoundId.ClientConnected or SoundId.ClientDisconnected => AdminPage.SoundsConnection,
	            SoundId.MainMenuMusic or SoundId.TavernOpened or SoundId.TavernAmbience => AdminPage.SoundsAmbience,
	            SoundId.GameVictory or SoundId.GameDefeat or SoundId.RoomOpened or SoundId.RoomJoined or SoundId.RoomExit => AdminPage.SoundsTable,
	            SoundId.TableAmbience1 or SoundId.TableAmbience2 or SoundId.TableAmbience3 or SoundId.TableAmbience4 or SoundId.TableAmbience5 or SoundId.TableAmbience6 or SoundId.TableAmbience7 or SoundId.TableAmbience8 or SoundId.TableAmbience9 or SoundId.TableAmbience10 or SoundId.TableAmbience11 or SoundId.TableAmbience12 or SoundId.TableAmbience13 or SoundId.TableAmbience14 or SoundId.TableAmbience15 or SoundId.TableAmbience16 or SoundId.TableAmbience17 or SoundId.TableAmbience18 or SoundId.TableAmbience19 or SoundId.TableAmbience20 => AdminPage.SoundsTableAmbience,
	            SoundId.DiceRolled or SoundId.QuizCorrect or SoundId.QuizWrong or SoundId.RoundEnded or SoundId.PawnPicked or SoundId.PawnPlacedSelf or SoundId.PawnPlacedOpponent or SoundId.WallPlacedSelf or SoundId.WallPlacedOpponent => AdminPage.SoundsGames,
	            SoundId.InvitationSent or SoundId.InvitationReceived => AdminPage.SoundsTable,
	            SoundId.ChatMessageSent or SoundId.ChatMessageReceived => AdminPage.SoundsChatGeneral,
	            SoundId.TableChatMessageSent or SoundId.TableChatMessageReceived => AdminPage.SoundsChatTable,
	            SoundId.PrivateMessageSent or SoundId.PrivateMessageReceived => AdminPage.SoundsPrivateMessages,
	            SoundId.AdminContactSent or SoundId.AdminContactReceived => AdminPage.SoundsAdminContact,
	            SoundId.FriendConnected or SoundId.FriendDisconnected or SoundId.FriendInvitationSent or SoundId.FriendInvitationReceived => AdminPage.SoundsInvitations,
	            _ => AdminPage.Sounds
	        };

	        var (group, title, current) = sound switch
	        {
            SoundId.ClientOpened => ("Connexion", "Ouverture du client", _options.Current.SoundClientOpenedPath),
            SoundId.ClientClosing => ("Connexion", "Fermeture du client", null),
            SoundId.ClientConnected => ("Connexion", "Connexion au serveur", _options.Current.SoundClientConnectedPath),
            SoundId.ClientDisconnected => ("Connexion", "Déconnexion du serveur", _options.Current.SoundClientDisconnectedPath),
            SoundId.MainMenuMusic => ("Ambiance", "Musique du menu principal", null),
            SoundId.TavernOpened => ("Ambiance", "Ouverture de la taverne", null),
            SoundId.TavernAmbience => ("Ambiance", "Ambiance de la taverne", null),
            SoundId.GameVictory => ("Table", "Victoire (fin de partie)", _options.Current.SoundGameVictoryPath),
            SoundId.GameDefeat => ("Table", "Défaite (fin de partie)", _options.Current.SoundGameDefeatPath),
            SoundId.TableAmbience1 => ("Table", "Ambiance de table 1", null),
            SoundId.TableAmbience2 => ("Table", "Ambiance de table 2", null),
            SoundId.TableAmbience3 => ("Table", "Ambiance de table 3", null),
            SoundId.TableAmbience4 => ("Table", "Ambiance de table 4", null),
            SoundId.TableAmbience5 => ("Table", "Ambiance de table 5", null),
            SoundId.TableAmbience6 => ("Table", "Ambiance de table 6", null),
            SoundId.TableAmbience7 => ("Table", "Ambiance de table 7", null),
            SoundId.TableAmbience8 => ("Table", "Ambiance de table 8", null),
            SoundId.TableAmbience9 => ("Table", "Ambiance de table 9", null),
            SoundId.TableAmbience10 => ("Table", "Ambiance de table 10", null),
            SoundId.TableAmbience11 => ("Table", "Ambiance de table 11", null),
            SoundId.TableAmbience12 => ("Table", "Ambiance de table 12", null),
            SoundId.TableAmbience13 => ("Table", "Ambiance de table 13", null),
            SoundId.TableAmbience14 => ("Table", "Ambiance de table 14", null),
            SoundId.TableAmbience15 => ("Table", "Ambiance de table 15", null),
            SoundId.TableAmbience16 => ("Table", "Ambiance de table 16", null),
            SoundId.TableAmbience17 => ("Table", "Ambiance de table 17", null),
            SoundId.TableAmbience18 => ("Table", "Ambiance de table 18", null),
            SoundId.TableAmbience19 => ("Table", "Ambiance de table 19", null),
            SoundId.TableAmbience20 => ("Table", "Ambiance de table 20", null),
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
	            SoundId.TableChatMessageSent => ("Tchat", "Tchat de table - Envoi d'un message", _options.Current.SoundTableChatMessageSentPath ?? _options.Current.SoundChatMessageSentPath),
	            SoundId.TableChatMessageReceived => ("Tchat", "Tchat de table - Réception d'un message", _options.Current.SoundTableChatMessageReceivedPath ?? _options.Current.SoundChatMessageReceivedPath),
	            SoundId.PrivateMessageSent => ("Messages privés", "Envoi d'un message privé", _options.Current.SoundPrivateMessageSentPath),
	            SoundId.PrivateMessageReceived => ("Messages privés", "Réception d'un message privé", _options.Current.SoundPrivateMessageReceivedPath),
            SoundId.AdminContactSent => ("Contact admin", "Envoi d'un contact admin", null),
	            SoundId.DiceRolled => ("Jeux", "Dé - Lancer", null),
                SoundId.QuizCorrect => ("Jeux", "Quiz - Bonne réponse", null),
                SoundId.QuizWrong => ("Jeux", "Quiz - Mauvaise réponse", null),
                SoundId.RoundEnded => ("Jeux", "Fin de manche", null),
	            SoundId.PawnPicked => ("Jeux", "Pion - Prendre (vous)", _options.Current.SoundPawnPickedPath),
	            SoundId.PawnPlacedSelf => ("Jeux", "Pion - Poser (vous)", _options.Current.SoundPawnPlacedSelfPath),
	            SoundId.PawnPlacedOpponent => ("Jeux", "Pion - Poser (adversaire)", _options.Current.SoundPawnPlacedOpponentPath),
	            SoundId.WallPlacedSelf => ("Jeux", "Mur - Poser (vous)", _options.Current.SoundWallPlacedSelfPath),
	            SoundId.WallPlacedOpponent => ("Jeux", "Mur - Poser (adversaire)", _options.Current.SoundWallPlacedOpponentPath),
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
        PreferDetailsFocus = false;
        var remote = _remoteSounds.TryGetPath(sound);
        Details = !string.IsNullOrWhiteSpace(remote)
            ? $"Son global (serveur) : {Path.GetFileName(remote)}"
            : string.IsNullOrWhiteSpace(current)
                ? "Son par défaut (Assets)."
                : $"Son local (options) : {current}";

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
        _sounds.PlayPreview(sound);
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
        await _remoteSounds.RefreshAsync(force: true).ConfigureAwait(true);

        // Purge tout lecteur/loop en mémoire pour éviter de réentendre un ancien fichier.
        try { _sounds.Stop(sound); } catch { /* ignore */ }
        try { _sounds.StopLoop(sound); } catch { /* ignore */ }

        var remote = _remoteSounds.TryGetPath(sound);
        Details = !string.IsNullOrWhiteSpace(remote)
            ? $"Son global (serveur) : {Path.GetFileName(remote)}"
            : "Son global (serveur).";
        _sounds.PlayPreview(sound);
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
