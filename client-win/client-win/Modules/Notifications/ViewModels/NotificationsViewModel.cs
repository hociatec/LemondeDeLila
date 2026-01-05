using System;
using System.Collections.ObjectModel;
using System.Globalization;
using System.Collections.Specialized;
using System.Threading.Tasks;
using System.Windows.Input;
using client_win.Core;
using client_win.Modules.Network.Services;
using client_win.Modules.Notifications.Models;
using client_win.Modules.Notifications.Services;
using client_win.Modules.MainMenu.Services;
using client_win.Modules.User.Services;

namespace client_win.Modules.Notifications.ViewModels;

public sealed class NotificationsViewModel : ObservableObject
{
    private readonly INotificationInbox _inbox;
    private readonly INotifyGatewayClient _notify;
    private readonly ISessionService _session;
    private readonly IMenuBadges _badges;
    private readonly Action _onClose;

    private NotificationItem? _selected;
    private string _status = "Chargement...";
    private bool _isReplyMode;
    private string _replyText = string.Empty;

    public event EventHandler? FocusFirstItemRequested;

    public NotificationsViewModel(
        INotificationInbox inbox,
        INotifyGatewayClient notify,
        ISessionService session,
        IMenuBadges badges,
        Action onClose)
    {
        _inbox = inbox ?? throw new ArgumentNullException(nameof(inbox));
        _notify = notify ?? throw new ArgumentNullException(nameof(notify));
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _badges = badges ?? throw new ArgumentNullException(nameof(badges));
        _onClose = onClose ?? throw new ArgumentNullException(nameof(onClose));

        if (_inbox.Items is INotifyCollectionChanged notifyColl)
        {
            notifyColl.CollectionChanged += (_, __) =>
            {
                Status = Items.Count == 0 ? "Aucune notification." : $"Notifications : {Items.Count}.";
                if (SelectedItem == null && Items.Count > 0)
                {
                    SelectedItem = Items[0];
                }
            };
        }

        RefreshCommand = new AsyncRelayCommand(RefreshAsync);
        ReplyCommand = new RelayCommand(OpenReply);
        SendReplyCommand = new AsyncRelayCommand(SendReplyAsync);
        CancelReplyCommand = new RelayCommand(CancelReply);
        DeleteCommand = new AsyncRelayCommand(DeleteSelectedAsync);
        CloseCommand = new RelayCommand(_onClose);
    }

    public ObservableCollection<NotificationItem> Items => _inbox.Items;

    public NotificationItem? SelectedItem
    {
        get => _selected;
        set
        {
            if (SetProperty(ref _selected, value))
            {
                OnPropertyChanged(nameof(SelectedDetailText));
                OnPropertyChanged(nameof(CanReply));
                if (value != null && !string.IsNullOrWhiteSpace(value.Id))
                {
                    _badges.MarkNotificationRead(value.Id);
                }
            }
        }
    }

    public string Status
    {
        get => _status;
        private set => SetProperty(ref _status, value);
    }

    public bool IsReplyMode
    {
        get => _isReplyMode;
        private set => SetProperty(ref _isReplyMode, value);
    }

    public string ReplyText
    {
        get => _replyText;
        set => SetProperty(ref _replyText, value);
    }

    public bool CanReply => SelectedItem != null && string.Equals(SelectedItem.Kind, "admin_contact", StringComparison.OrdinalIgnoreCase);

    public string SelectedDetailText => FormatDetail(SelectedItem);

    public ICommand RefreshCommand { get; }
    public ICommand ReplyCommand { get; }
    public ICommand SendReplyCommand { get; }
    public ICommand CancelReplyCommand { get; }
    public ICommand DeleteCommand { get; }
    public ICommand CloseCommand { get; }

    public async Task InitializeAsync()
    {
        await RefreshAsync().ConfigureAwait(true);
        Status = Items.Count == 0 ? "Aucune notification." : $"Notifications : {Items.Count}.";
        SelectedItem = Items.Count > 0 ? Items[0] : null;
        FocusFirstItemRequested?.Invoke(this, EventArgs.Empty);
    }

    public bool HandleEscape()
    {
        if (IsReplyMode)
        {
            CancelReply();
            return true;
        }
        _onClose();
        return true;
    }

    private async Task RefreshAsync()
    {
        await _notify.RequestInboxSnapshotAsync().ConfigureAwait(true);
        Status = Items.Count == 0 ? "Aucune notification." : $"Notifications : {Items.Count}.";
    }

    private void OpenReply()
    {
        if (!CanReply)
        {
            return;
        }
        IsReplyMode = true;
        ReplyText = string.Empty;
    }

    private void CancelReply()
    {
        IsReplyMode = false;
        ReplyText = string.Empty;
    }

    private async Task SendReplyAsync()
    {
        var it = SelectedItem;
        if (it == null || !CanReply)
        {
            return;
        }

        var message = (ReplyText ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(message))
        {
            Status = "Réponse vide.";
            return;
        }

        var meId = _session.CurrentUser?.UserId ?? 0;
        var toUserId = 0;
        if (it.FromUserId > 0 && it.FromUserId != meId)
        {
            toUserId = it.FromUserId;
        }
        else if (it.ToUserId.HasValue && it.ToUserId.Value > 0)
        {
            toUserId = it.ToUserId.Value;
        }

        await _notify.SendAsync(
                "notify.admin_contact.reply",
                new
                {
                    contactId = it.ContactId,
                    toUserId = toUserId > 0 ? (int?)toUserId : null,
                    message,
                })
            .ConfigureAwait(true);

        Status = "Réponse envoyée.";
        CancelReply();
    }

    public async Task DeleteSelectedAsync()
    {
        var it = SelectedItem;
        if (it == null || string.IsNullOrWhiteSpace(it.Id))
        {
            return;
        }

        _badges.MarkNotificationRead(it.Id);
        await _notify.SendAsync("notify.inbox.delete", new { id = it.Id }).ConfigureAwait(true);
        Status = "Notification supprimée.";
    }

    private static string FormatDetail(NotificationItem? item)
    {
        if (item == null)
        {
            return "Aucune notification sélectionnée.";
        }

        var ts = item.CreatedAt.ToLocalTime().ToString("g", CultureInfo.CurrentCulture);

        if (string.Equals(item.Kind, "admin_contact", StringComparison.OrdinalIgnoreCase))
        {
            return $"{ts}\nDe: {item.FromUsername}\n\n{item.Message}";
        }

        return $"{ts}\nType: {item.Kind}";
    }
}
