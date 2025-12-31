using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core;
using client_win.Modules.Audio.Models;
using client_win.Modules.Audio.Services;
using client_win.Modules.Game.RoomDirectory.Services;
using client_win.Modules.Messaging.Services;
using client_win.Modules.Presence.Models;
using client_win.Modules.Presence.Services;
using client_win.Modules.Shell.Services;
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
    private readonly ITextPromptService _prompts;
    private readonly ISessionService _session;
    private readonly IDialogService _dialogs;
    private readonly ISoundService _sounds;
    private readonly Action _close;
    private readonly Func<int, Task> _joinRoom;

    private PresencePage _page = PresencePage.Players;
    private string _title = "Présence";
    private string _status = "Flèches : naviguer. Entrée : sélectionner. Échap : fermer.";
    private string _details = string.Empty;
    private PresenceMenuItem? _selectedItem;
    private PresencePlayer? _selectedPlayer;
    private bool _isBusy;

    private const string TagInvite = "invite";
    private const string TagJoin = "join";
    private const string TagMessage = "message";

    public PresenceViewModel(
        IPresenceMonitor presence,
        IRoomDirectoryClient rooms,
        IMessagingService messaging,
        ITextPromptService prompts,
        ISessionService session,
        IDialogService dialogs,
        ISoundService sounds,
        Func<int, Task> joinRoom,
        Action onClose)
    {
        _presence = presence ?? throw new ArgumentNullException(nameof(presence));
        _rooms = rooms ?? throw new ArgumentNullException(nameof(rooms));
        _messaging = messaging ?? throw new ArgumentNullException(nameof(messaging));
        _prompts = prompts ?? throw new ArgumentNullException(nameof(prompts));
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _dialogs = dialogs ?? throw new ArgumentNullException(nameof(dialogs));
        _sounds = sounds ?? throw new ArgumentNullException(nameof(sounds));
        _joinRoom = joinRoom ?? throw new ArgumentNullException(nameof(joinRoom));
        _close = onClose ?? (() => { });

        Items = new ObservableCollection<PresenceMenuItem>();
        ActivateCommand = new AsyncRelayCommand(ActivateAsync, () => !IsBusy);

        _presence.PlayersChanged += OnPlayersChanged;
        RebuildPlayers();
    }

    public ObservableCollection<PresenceMenuItem> Items { get; }

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

    public void HandleEscape()
    {
        if (_page == PresencePage.PlayerActions)
        {
            _page = PresencePage.Players;
            _selectedPlayer = null;
            Title = BuildTitle();
            Status = "Flèches : naviguer. Entrée : sélectionner. Échap : fermer.";
            RebuildPlayers();
            return;
        }
        _close();
    }

    private void OnPlayersChanged()
    {
        if (_page != PresencePage.Players)
        {
            Title = BuildTitle();
            return;
        }
        RebuildPlayers();
    }

    private string BuildTitle()
    {
        var count = _presence.Players.Count;
        return count <= 1 ? "Présence (1 connecté)" : $"Présence ({count} connectés)";
    }

    private void RebuildPlayers()
    {
        var previous = SelectedItem?.Tag as int?;
        Items.Clear();

        Title = BuildTitle();
        Details = _presence.Status;

        foreach (var p in _presence.Players)
        {
            var label = BuildPlayerLabel(p);
            Items.Add(new PresenceMenuItem(label, tag: p.Id));
        }

        if (previous.HasValue)
        {
            SelectedItem = Items.FirstOrDefault(i => i.Tag is int id && id == previous.Value);
        }
        SelectedItem ??= Items.FirstOrDefault();
    }

    private static string BuildPlayerLabel(PresencePlayer p)
    {
        var baseName = p.Username;
        if (p.CurrentRoomId.HasValue)
        {
            var roomLabel = string.IsNullOrWhiteSpace(p.CurrentRoomName) ? $"Table #{p.CurrentRoomId}" : p.CurrentRoomName!.Trim();
            return $"{baseName} — {roomLabel}";
        }
        var activity = (p.Activity ?? string.Empty).Trim().ToLowerInvariant();
        return activity switch
        {
            "chat" => $"{baseName} — tchat",
            _ => $"{baseName} — accueil"
        };
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
            Title = player.Username;
            Status = "Flèches : naviguer. Entrée : sélectionner. Échap : retour.";
            RebuildPlayerActions();
            return;
        }

        if (_page == PresencePage.PlayerActions)
        {
            await RunActionAsync().ConfigureAwait(true);
        }
    }

    private void RebuildPlayerActions()
    {
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
                var msg = await _messaging.SendAsync(player.Id, text.Trim(), subject: subject.Trim()).ConfigureAwait(false);
                Details = msg != null ? "Message envoyé." : "Envoi impossible.";
                if (msg != null)
                {
                    _sounds.Play(SoundId.PrivateMessageSent);
                }
            }
            finally
            {
                IsBusy = false;
            }
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
