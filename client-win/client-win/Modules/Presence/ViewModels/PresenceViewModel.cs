using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Threading;
using client_win.Core;
using client_win.Modules.Game.RoomDirectory.Services;
using client_win.Modules.Messaging.Services;
using client_win.Modules.Presence.Models;
using client_win.Modules.Presence.Services;
using client_win.Modules.Shell.Services;
using client_win.Modules.Social.Services;
using client_win.Modules.TextPrompts.Services;
using client_win.Modules.User.Services;

namespace client_win.Modules.Presence.ViewModels;

internal enum PresencePage
{
    Players,
    PlayerActions
}

public sealed class PresenceViewModel : ObservableObject
{
    private readonly IPresenceMonitor _presence;
    private readonly IRoomDirectoryClient _rooms;
    private readonly IMessagingService _messaging;
    private readonly ISocialService _social;
    private readonly ITextPromptService _prompts;
    private readonly ISessionService _session;
    private readonly IDialogService _dialogs;
    private readonly Action _close;
    private readonly Func<int, Task> _joinRoom;
    private readonly Func<int, string, Task>? _openStoryBook;
    private readonly Dispatcher _dispatcher;

    private PresencePage _page = PresencePage.Players;
    private string _title = "Présence";
    private string _status = "Flèches : naviguer. Entrée : sélectionner. Échap : fermer.";
    private string _details = string.Empty;
    private PresenceMenuItem? _selectedItem;
    private PresencePlayer? _selectedPlayer;
    private bool _isBusy;
    private bool? _isFriend;
    private bool? _isBlocked;
    private CancellationTokenSource? _socialCts;
    private bool? _isFriendRequestPending;
    private bool? _hasIncomingFriendRequest;

    private const string TagInvite = "invite";
    private const string TagJoin = "join";
    private const string TagMessage = "message";
    private const string TagFriendAdd = "friend.add";
    private const string TagFriendRemove = "friend.remove";
    private const string TagFriendCancel = "friend.cancel";
    private const string TagFriendAccept = "friend.accept";
    private const string TagFriendReject = "friend.reject";
    private const string TagBlock = "block";
    private const string TagUnblock = "unblock";
    private const string TagStoryBook = "storybook";
    private const string TagBio = "bio";

    public PresenceViewModel(
        IPresenceMonitor presence,
        IRoomDirectoryClient rooms,
        IMessagingService messaging,
        ISocialService social,
        ITextPromptService prompts,
        ISessionService session,
        IDialogService dialogs,
        Func<int, Task> joinRoom,
        Func<int, string, Task>? openStoryBook,
        Action onClose)
    {
        _presence = presence ?? throw new ArgumentNullException(nameof(presence));
        _rooms = rooms ?? throw new ArgumentNullException(nameof(rooms));
        _messaging = messaging ?? throw new ArgumentNullException(nameof(messaging));
        _social = social ?? throw new ArgumentNullException(nameof(social));
        _prompts = prompts ?? throw new ArgumentNullException(nameof(prompts));
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _dialogs = dialogs ?? throw new ArgumentNullException(nameof(dialogs));
        _joinRoom = joinRoom ?? throw new ArgumentNullException(nameof(joinRoom));
        _openStoryBook = openStoryBook;
        _close = onClose ?? (() => { });
        _dispatcher = Application.Current?.Dispatcher ?? Dispatcher.CurrentDispatcher;

        Items = new ObservableCollection<PresenceMenuItem>();
        ActivateCommand = new AsyncRelayCommand(ActivateAsync, () => !IsBusy);

        _presence.PlayersChanged += OnPlayersChanged;
        RebuildPlayers();
    }

    public ObservableCollection<PresenceMenuItem> Items { get; }

    public event Action? FocusFirstItemRequested;
    public event Action? FocusSelectedItemRequested;

    public PresenceMenuItem? SelectedItem
    {
        get => _selectedItem;
        set => SetProperty(ref _selectedItem, value);
    }

    public string Title
    {
        get => _title;
        private set => SetProperty(ref _title, value);
    }

    public string Status
    {
        get => _status;
        private set => SetProperty(ref _status, value);
    }

    public string Details
    {
        get => _details;
        private set => SetProperty(ref _details, value);
    }

    public bool ShowItemsList => true;

    public bool IsBusy
    {
        get => _isBusy;
        private set
        {
            if (SetProperty(ref _isBusy, value))
            {
                ActivateCommand.RaiseCanExecuteChanged();
            }
        }
    }

    public AsyncRelayCommand ActivateCommand { get; }

    public void ResetForOpen()
    {
        _page = PresencePage.Players;
        _selectedPlayer = null;
        _isFriend = null;
        _isBlocked = null;
        _isFriendRequestPending = null;
        SelectedItem = null;
        Title = BuildTitle();
        Status = "Flèches : naviguer. Entrée : sélectionner. Échap : fermer.";
        RebuildPlayers();
    }

    public void HandleEscape()
    {
        if (_page == PresencePage.PlayerActions)
        {
            var previousPlayerId = _selectedPlayer?.Id;
            _socialCts?.Cancel();
            _page = PresencePage.Players;
            _selectedPlayer = null;
            _isFriend = null;
            _isBlocked = null;
            _isFriendRequestPending = null;
            Title = BuildTitle();
            Status = "Flèches : naviguer. Entrée : sélectionner. Échap : fermer.";
            RebuildPlayers(preferSelectedPlayerId: previousPlayerId);
            return;
        }
        _close();
    }

    private void OnPlayersChanged()
    {
        try
        {
            if (_page == PresencePage.PlayerActions)
            {
                var selectedId = _selectedPlayer?.Id;
                if (selectedId.HasValue && selectedId.Value > 0)
                {
                    var latest = _presence.Players.FirstOrDefault(p => p.Id == selectedId.Value);
                    if (latest != null)
                    {
                        _selectedPlayer = latest;
                        Title = BuildPlayerLabel(latest);
                        RebuildPlayerActions();
                    }
                    else
                    {
                        // L'utilisateur n'est plus dans la liste (déconnexion / présence indisponible).
                        Details = "Utilisateur déconnecté.";
                    }
                }
                return;
            }

            if (_page != PresencePage.Players)
            {
                Title = BuildTitle();
                return;
            }

            RebuildPlayers();
        }
        catch
        {
            // Best-effort: ne pas bloquer l'UI sur une erreur de refresh.
        }
    }

    private string BuildTitle()
    {
        var count = _presence.Players.Count;
        return count <= 1 ? "Présence (1 connecté)" : $"Présence ({count} connectés)";
    }

    private void RebuildPlayers(int? preferSelectedPlayerId = null)
    {
        var previousId =
            preferSelectedPlayerId ??
            (SelectedItem?.Tag is int pid ? pid : (int?)null);

        Title = BuildTitle();
        Details = _presence.Status;

        var desired = _presence.Players
            .Select(p => new PresenceMenuItem(BuildPlayerLabel(p), tag: p.Id))
            .ToList();

        // Éviter Clear/Add complet : ça peut provoquer des rafales de layout/focus sous WPF.
        SelectedItem = null;

        for (var i = 0; i < desired.Count; i++)
        {
            var want = desired[i];
            if (i >= Items.Count)
            {
                Items.Add(want);
                continue;
            }

            var have = Items[i];
            if (have.Tag is int haveId && want.Tag is int wantId)
            {
                if (haveId == wantId)
                {
                    if (!string.Equals(have.Label, want.Label, StringComparison.Ordinal))
                    {
                        Items[i] = want;
                    }
                    continue;
                }

                // Chercher l'item existant plus loin (reorder minimal), sinon insérer.
                var foundIndex = -1;
                for (var j = i + 1; j < Items.Count; j++)
                {
                    if (Items[j].Tag is int id && id == wantId)
                    {
                        foundIndex = j;
                        break;
                    }
                }

                if (foundIndex >= 0)
                {
                    Items.RemoveAt(foundIndex);
                    Items.Insert(i, want);
                }
                else
                {
                    Items.Insert(i, want);
                }
                continue;
            }

            Items[i] = want;
        }

        while (Items.Count > desired.Count)
        {
            Items.RemoveAt(Items.Count - 1);
        }

        if (previousId.HasValue)
        {
            SelectedItem = Items.FirstOrDefault(i => i.Tag is int id && id == previousId.Value);
        }
        SelectedItem ??= Items.FirstOrDefault();
    }

    private static string BuildPlayerLabel(PresencePlayer p)
    {
        var baseName = p.Username;

        var availability = (p.Availability ?? string.Empty).Trim().ToLowerInvariant();
        var status = availability switch
        {
            "available" => "disponible",
            "occupied" => "occupé",
            "absent" => "absent",
            _ => string.Empty
        };

        var location = (p.Location ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(location))
        {
            if (p.CurrentRoomId.HasValue)
            {
                location = string.IsNullOrWhiteSpace(p.CurrentRoomName)
                    ? $"Table #{p.CurrentRoomId}"
                    : p.CurrentRoomName!.Trim();
            }
            else
            {
                var activity = (p.Activity ?? string.Empty).Trim().ToLowerInvariant();
                location = activity switch
                {
                    "chat" => "tchat",
                    "tavern" => "taverne",
                    "stats" => "livre des contes",
                    "messaging" => "messagerie",
                    _ => "accueil"
                };
            }
        }

        if (string.IsNullOrWhiteSpace(status))
        {
            return $"{baseName}, {location}";
        }

        return $"{baseName} ({status}), {location}";
    }

    private async Task ActivateAsync()
    {
        if (IsBusy)
        {
            return;
        }

        if (_page == PresencePage.Players)
        {
            var selected = SelectedItem;
            if (selected?.Tag is not int id)
            {
                return;
            }
            var player = _presence.Players.FirstOrDefault(p => p.Id == id);
            if (player == null)
            {
                return;
            }
            if (_session.CurrentUser != null &&
                string.Equals(StripSelfSuffix(player.Username), _session.CurrentUser.Username, StringComparison.OrdinalIgnoreCase))
            {
                // Ne pas ouvrir de boîte de dialogue : garder la navigation fluide pour lecteur d'écran.
                Details = "Ceci est votre propre profil de présence.";
                return;
            }

            _selectedPlayer = player;
            _page = PresencePage.PlayerActions;
            Title = BuildPlayerLabel(player);
            Status = "Flèches : naviguer. Entrée : sélectionner. Échap : retour.";
            _isFriend = null;
            _isBlocked = null;
            _isFriendRequestPending = null;
            _hasIncomingFriendRequest = null;
            RebuildPlayerActions();
            _ = RefreshSocialStateAsync(player.Id);
            _ = _dispatcher.BeginInvoke(
                DispatcherPriority.ApplicationIdle,
                new Action(() => FocusFirstItemRequested?.Invoke()));
            return;
        }

        if (_page == PresencePage.PlayerActions)
        {
            await RunActionAsync().ConfigureAwait(true);
        }
    }

    private void RebuildPlayerActions()
    {
        var previousSelection = SelectedItem?.Tag;
        Items.Clear();
        var player = _selectedPlayer;
        if (player == null)
        {
            _page = PresencePage.Players;
            RebuildPlayers();
            return;
        }

        var myRoomId = _presence.CurrentRoomId;
        var canInvite = myRoomId.HasValue && myRoomId.Value > 0 && player.CurrentRoomId != myRoomId;
        var canJoin = (!myRoomId.HasValue || myRoomId.Value <= 0) && player.CurrentRoomId.HasValue && player.CurrentRoomId.Value > 0;

        if (_isBlocked == true)
        {
            Items.Add(new PresenceMenuItem("Débloquer", tag: TagUnblock));
        }
        else if (_isBlocked == false)
        {
            Items.Add(new PresenceMenuItem("Bloquer", tag: TagBlock));
        }
        else
        {
            Items.Add(new PresenceMenuItem("Bloquer / débloquer (chargement...)", tag: TagBlock));
        }

        if (_isFriend == true)
        {
            Items.Add(new PresenceMenuItem("Retirer de mes amis", tag: TagFriendRemove));
        }
        else if (_hasIncomingFriendRequest == true)
        {
            Items.Add(new PresenceMenuItem("Accepter la demande d'ami", tag: TagFriendAccept));
            Items.Add(new PresenceMenuItem("Refuser la demande d'ami", tag: TagFriendReject));
        }
        else if (_isFriendRequestPending == true)
        {
            Items.Add(new PresenceMenuItem("Annuler ma demande d'ami", tag: TagFriendCancel));
        }
        else if (_isFriend == false && _isFriendRequestPending == false)
        {
            Items.Add(new PresenceMenuItem("Ajouter en ami", tag: TagFriendAdd));
        }
        else
        {
            Items.Add(new PresenceMenuItem("Ajouter / retirer ami (chargement...)", tag: TagFriendAdd));
        }

        Items.Add(new PresenceMenuItem("Voir sa bio", tag: TagBio));
        Items.Add(new PresenceMenuItem("Voir son livre des contes", tag: TagStoryBook));

        if (canInvite)
        {
            Items.Add(new PresenceMenuItem("Inviter à ma table", tag: TagInvite));
        }
        if (canJoin)
        {
            Items.Add(new PresenceMenuItem("Rejoindre sa table", tag: TagJoin));
        }
        Items.Add(new PresenceMenuItem("Envoyer un message privé", tag: TagMessage));

        Details = canJoin
            ? "Entrée : action. Échap : retour."
            : canInvite
                ? "Entrée : action. Échap : retour."
                : "Aucune action de table disponible. Échap : retour.";

        SelectedItem = Items.FirstOrDefault();
        if (previousSelection != null)
        {
            SelectedItem = Items.FirstOrDefault(i => Equals(i.Tag, previousSelection)) ?? SelectedItem;
        }

        _dispatcher.BeginInvoke(
            DispatcherPriority.ApplicationIdle,
            new Action(() => FocusSelectedItemRequested?.Invoke()));
    }

    private async Task RefreshSocialStateAsync(int userId)
    {
        _socialCts?.Cancel();
        _socialCts?.Dispose();
        _socialCts = new CancellationTokenSource();
        var token = _socialCts.Token;

        try
        {
            var friendsTask = _social.GetFriendsAsync(token);
            var blockedTask = _social.GetBlockedAsync(token);
            var outgoingTask = _social.GetRequestsAsync("outgoing", token);
            var incomingTask = _social.GetRequestsAsync("incoming", token);
            await Task.WhenAll(friendsTask, blockedTask, outgoingTask, incomingTask).ConfigureAwait(true);

            var friends = friendsTask.Result;
            var blocked = blockedTask.Result;
            var outgoing = outgoingTask.Result;
            var incoming = incomingTask.Result;

            // UX: un utilisateur peut être bloqué tout en restant "ami" (ne pas perdre l'état ami).
            // Si le backend retire l'ami de friends.list lors du blocage, on le récupère via la liste des bloqués
            // quand l'info "Since" (amitié) est disponible.
            _isFriend = friends.Any(u => u.Id == userId) ||
                        blocked.Any(u => u.Id == userId && u.Since.HasValue);
            _isBlocked = blocked.Any(u => u.Id == userId);
            _isFriendRequestPending = _isFriend == false && outgoing.Any(r => r.Addressee.Id == userId);
            _hasIncomingFriendRequest = _isFriend == false && incoming.Any(r => r.Requester.Id == userId);

            if (_page == PresencePage.PlayerActions && _selectedPlayer?.Id == userId)
            {
                RebuildPlayerActions();
            }
        }
        catch
        {
            _isFriend = null;
            _isBlocked = null;
            _isFriendRequestPending = null;
            _hasIncomingFriendRequest = null;
        }
    }

    private async Task RunActionAsync()
    {
        var player = _selectedPlayer;
        if (player == null)
        {
            return;
        }
        var tag = SelectedItem?.Tag as string;
        if (string.IsNullOrWhiteSpace(tag))
        {
            return;
        }

        if (string.Equals(tag, TagInvite, StringComparison.OrdinalIgnoreCase))
        {
            var roomId = _presence.CurrentRoomId;
            if (!roomId.HasValue || roomId.Value <= 0)
            {
                await _dialogs.ShowInfo("Invitation", "Vous n'êtes pas dans une table.").ConfigureAwait(true);
                return;
            }
            IsBusy = true;
            try
            {
                var res = await _rooms.InviteSendAsync(roomId.Value, player.Id, CancellationToken.None).ConfigureAwait(true);
                Details = res;
                // L'utilisateur veut revenir directement dans la table après l'envoi,
                // pour éviter une double activation accidentelle sur l'item "Inviter".
                _close();
            }
            finally
            {
                IsBusy = false;
            }
            return;
        }

        if (string.Equals(tag, TagJoin, StringComparison.OrdinalIgnoreCase))
        {
            var roomId = player.CurrentRoomId;
            if (!roomId.HasValue || roomId.Value <= 0)
            {
                await _dialogs.ShowInfo("Rejoindre", "Le joueur n'est pas dans une table.").ConfigureAwait(true);
                return;
            }
            // Fermer la présence avant d'ouvrir la table pour éviter les doubles activations accidentelles.
            _close();
            await _joinRoom(roomId.Value).ConfigureAwait(true);
            return;
        }

        if (string.Equals(tag, TagStoryBook, StringComparison.OrdinalIgnoreCase))
        {
            if (_openStoryBook == null)
            {
                Details = "Livre des contes indisponible.";
                return;
            }

            IsBusy = true;
            try
            {
                // Ne pas fermer la présence : Échap doit revenir à la présence (pas à l'accueil).
                await _openStoryBook(player.Id, StripSelfSuffix(player.Username)).ConfigureAwait(true);
            }
            finally
            {
                IsBusy = false;
            }
            return;
        }

        if (string.Equals(tag, TagBio, StringComparison.OrdinalIgnoreCase))
        {
            IsBusy = true;
            try
            {
                var profile = await _social.GetProfileAsync(player.Id, CancellationToken.None).ConfigureAwait(true);
                if (profile == null)
                {
                    await _dialogs.ShowInfo("Bio", "Profil indisponible.").ConfigureAwait(true);
                    return;
                }

                if (!profile.IsOwner && !profile.CanView)
                {
                    var vis = (profile.Visibility ?? string.Empty).Trim().ToLowerInvariant();
                    var reason = vis switch
                    {
                        "friends" => "Bio indisponible (réservée aux amis).",
                        "private" => "Bio indisponible (profil privé).",
                        "public" => "Bio indisponible.",
                        _ => "Bio indisponible."
                    };
                    await _dialogs.ShowInfo("Bio", reason).ConfigureAwait(true);
                    return;
                }

                var bio = (profile.Bio ?? string.Empty).Trim();
                if (string.IsNullOrWhiteSpace(bio))
                {
                    bio = "(vide)";
                }

                var visibilityLabel = (profile.Visibility ?? string.Empty).Trim().ToLowerInvariant() switch
                {
                    "public" => "Public",
                    "friends" => "Amis",
                    "private" => "Privé",
                    _ => string.IsNullOrWhiteSpace(profile.Visibility) ? "Inconnue" : profile.Visibility!.Trim()
                };

                await _dialogs
                    .ShowInfo($"Bio — {StripSelfSuffix(player.Username)}", $"Visibilité : {visibilityLabel}\n\n{bio}")
                    .ConfigureAwait(true);
            }
            catch (Exception ex)
            {
                await _dialogs.ShowError("Bio", $"Erreur lors du chargement de la bio : {ex.Message}").ConfigureAwait(true);
            }
            finally
            {
                IsBusy = false;
            }
            return;
        }

        if (string.Equals(tag, TagMessage, StringComparison.OrdinalIgnoreCase))
        {
            var draft = await _prompts.PromptPrivateMessageAsync(
                title: $"Message à {player.Username}",
                subjectLabel: "Sujet",
                messageLabel: "Message",
                initialSubject: string.Empty,
                initialMessage: string.Empty).ConfigureAwait(true);
            if (draft == null)
            {
                return;
            }

            var subject = draft.Value.Subject;
            var text = draft.Value.Message;

            IsBusy = true;
            try
            {
                var msg = await _messaging.SendAsync(player.Id, text.Trim(), subject: subject.Trim()).ConfigureAwait(true);
                Details = msg != null ? "Message envoyé." : "Envoi impossible.";
            }
            finally
            {
                IsBusy = false;
            }
            return;
        }

        if (string.Equals(tag, TagFriendAdd, StringComparison.OrdinalIgnoreCase))
        {
            if (_isFriendRequestPending == true)
            {
                Details = "Demande déjà envoyée (en attente).";
                return;
            }
            if (_hasIncomingFriendRequest == true)
            {
                Details = "Demande reçue : acceptez ou refusez.";
                return;
            }

            IsBusy = true;
            try
            {
                var ok = await _social.RequestFriendAsync(player.Id, CancellationToken.None).ConfigureAwait(true);
                Details = ok ? "Demande d'ami envoyée." : "Action impossible.";
                if (ok)
                {
                    _isFriend = false;
                    _isFriendRequestPending = true;
                    RebuildPlayerActions();
                }
            }
            finally
            {
                IsBusy = false;
            }

            _ = RefreshSocialStateAsync(player.Id);
            return;
        }

        if (string.Equals(tag, TagFriendAccept, StringComparison.OrdinalIgnoreCase))
        {
            if (_hasIncomingFriendRequest != true)
            {
                Details = "Aucune demande reçue.";
                return;
            }

            IsBusy = true;
            try
            {
                var ok = await _social.AcceptFriendAsync(player.Id, CancellationToken.None).ConfigureAwait(true);
                Details = ok ? "Demande acceptée." : "Action impossible.";
                if (ok)
                {
                    _isFriend = true;
                    _hasIncomingFriendRequest = false;
                    _isFriendRequestPending = false;
                    RebuildPlayerActions();
                }
            }
            finally
            {
                IsBusy = false;
            }

            _ = RefreshSocialStateAsync(player.Id);
            return;
        }

        if (string.Equals(tag, TagFriendReject, StringComparison.OrdinalIgnoreCase))
        {
            if (_hasIncomingFriendRequest != true)
            {
                Details = "Aucune demande reçue.";
                return;
            }

            IsBusy = true;
            try
            {
                var ok = await _social.RejectFriendAsync(player.Id, CancellationToken.None).ConfigureAwait(true);
                Details = ok ? "Demande refusée." : "Action impossible.";
                if (ok)
                {
                    _hasIncomingFriendRequest = false;
                    _isFriendRequestPending = false;
                    _isFriend = false;
                    RebuildPlayerActions();
                }
            }
            finally
            {
                IsBusy = false;
            }

            _ = RefreshSocialStateAsync(player.Id);
            return;
        }

        if (string.Equals(tag, TagFriendCancel, StringComparison.OrdinalIgnoreCase))
        {
            if (_isFriendRequestPending != true)
            {
                Details = "Aucune demande d'ami en attente.";
                return;
            }

            IsBusy = true;
            try
            {
                var ok = await _social.CancelRequestAsync(player.Id, CancellationToken.None).ConfigureAwait(true);
                Details = ok ? "Demande d'ami annulée." : "Action impossible.";
                if (ok)
                {
                    _isFriend = false;
                    _isFriendRequestPending = false;
                    RebuildPlayerActions();
                }
            }
            finally
            {
                IsBusy = false;
            }

            _ = RefreshSocialStateAsync(player.Id);
            return;
        }

        if (string.Equals(tag, TagFriendRemove, StringComparison.OrdinalIgnoreCase))
        {
            var confirm = await _dialogs.Confirm(
                "Amis",
                $"Retirer {StripSelfSuffix(player.Username)} de vos amis ?",
                okText: "Retirer",
                cancelText: "Annuler").ConfigureAwait(true);
            if (confirm != true)
            {
                return;
            }

            IsBusy = true;
            try
            {
                var ok = await _social.RemoveFriendAsync(player.Id, CancellationToken.None).ConfigureAwait(true);
                Details = ok ? "Ami retiré." : "Action impossible.";
            }
            finally
            {
                IsBusy = false;
            }

            _ = RefreshSocialStateAsync(player.Id);
            return;
        }

        if (string.Equals(tag, TagBlock, StringComparison.OrdinalIgnoreCase))
        {
            var confirm = await _dialogs.Confirm(
                "Blocage",
                $"Bloquer {StripSelfSuffix(player.Username)} ?\n\nVous ne verrez plus ses messages et interactions sociales.",
                okText: "Bloquer",
                cancelText: "Annuler").ConfigureAwait(true);
            if (confirm != true)
            {
                return;
            }

            IsBusy = true;
            try
            {
                var ok = await _social.BlockUserAsync(player.Id, CancellationToken.None).ConfigureAwait(true);
                Details = ok ? "Utilisateur bloqué." : "Action impossible.";
            }
            finally
            {
                IsBusy = false;
            }

            _ = RefreshSocialStateAsync(player.Id);
            return;
        }

        if (string.Equals(tag, TagUnblock, StringComparison.OrdinalIgnoreCase))
        {
            IsBusy = true;
            try
            {
                var ok = await _social.UnblockUserAsync(player.Id, CancellationToken.None).ConfigureAwait(true);
                Details = ok ? "Utilisateur débloqué." : "Action impossible.";
            }
            finally
            {
                IsBusy = false;
            }

            _ = RefreshSocialStateAsync(player.Id);
            return;
        }
    }

    private static string StripSelfSuffix(string username)
    {
        var u = (username ?? string.Empty).Trim();
        const string suffix = " (vous)";
        return u.EndsWith(suffix, StringComparison.OrdinalIgnoreCase)
            ? u.Substring(0, u.Length - suffix.Length).TrimEnd()
            : u;
    }
}
