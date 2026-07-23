using System;
using System.Collections.ObjectModel;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using client_win.Core;
using client_win.Modules.Messaging.Models;
using client_win.Modules.Messaging.Services;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Messaging.ViewModels;

public sealed class MessagingViewModel : ObservableObject, IShellNavigationAware
{
    private readonly IMessagingService _service;
    private readonly IDialogService _dialogs;
    private readonly Action _onClose;
    private MessagingBox _selectedBox = MessagingBox.Inbox;
    private MessagingMessage? _selectedMessage;
    private MessagingUser? _conversationUser;
    private string _inputText = string.Empty;
    private string _searchQuery = string.Empty;
    private string _composeRecipient = string.Empty;
    private string _composeSubject = string.Empty;
    private string _composeBody = string.Empty;
    private string _status = "Chargement...";
    private bool _isBusy;
    private bool _isComposeMode;

    public event EventHandler? FocusFirstMessageRequested;
    public event EventHandler? NavigateHomeRequested;

    public MessagingViewModel(IMessagingService service, IDialogService dialogs, Action onClose)
    {
        _service = service ?? throw new ArgumentNullException(nameof(service));
        _dialogs = dialogs ?? throw new ArgumentNullException(nameof(dialogs));
        _onClose = onClose ?? throw new ArgumentNullException(nameof(onClose));

        BoxMessages = new ObservableCollection<MessagingMessage>();
        ConversationMessages = new ObservableCollection<MessagingMessage>();

        OpenConversationCommand = new AsyncRelayCommand(OpenConversationAsync);
        SendCommand = new AsyncRelayCommand(SendAsync);
        SearchUserCommand = new AsyncRelayCommand(SearchUserAsync);
        SendComposeCommand = new AsyncRelayCommand(SendComposeAsync);
        DeleteCommand = new AsyncRelayCommand(DeleteAsync);
        RestoreCommand = new AsyncRelayCommand(RestoreAsync);
        ReplyCommand = new RelayCommand(Reply);
        CloseCommand = new RelayCommand(_onClose);
    }

    public ObservableCollection<MessagingMessage> BoxMessages { get; }
    public ObservableCollection<MessagingMessage> ConversationMessages { get; }

    public MessagingBox SelectedBox
    {
        get => _selectedBox;
        set
        {
            if (SetProperty(ref _selectedBox, value))
            {
                _ = LoadBoxAsync(value);
            }
        }
    }

    public MessagingMessage? SelectedMessage
    {
        get => _selectedMessage;
        set
        {
            if (SetProperty(ref _selectedMessage, value))
            {
                OnPropertyChanged(nameof(SelectedMessageDetailText));
            }
        }
    }

    public Task MarkSelectedMessageReadAsync()
    {
        var msg = SelectedMessage;
        if (msg == null || string.IsNullOrWhiteSpace(msg.Id) || msg.IsSent)
        {
            return Task.CompletedTask;
        }
        return _service.MarkReadAsync(msg.Id);
    }

    public string SelectedMessageDetailText => FormatMessageDetail(_selectedMessage);

    public MessagingUser? ConversationUser
    {
        get => _conversationUser;
        private set => SetProperty(ref _conversationUser, value);
    }

    public string InputText
    {
        get => _inputText;
        set => SetProperty(ref _inputText, value);
    }

    public string SearchQuery
    {
        get => _searchQuery;
        set => SetProperty(ref _searchQuery, value);
    }

    public string ComposeRecipient
    {
        get => _composeRecipient;
        set => SetProperty(ref _composeRecipient, value);
    }

    public string ComposeSubject
    {
        get => _composeSubject;
        set => SetProperty(ref _composeSubject, value);
    }

    public string ComposeBody
    {
        get => _composeBody;
        set => SetProperty(ref _composeBody, value);
    }

    public string Status
    {
        get => _status;
        private set => SetProperty(ref _status, value);
    }

    public bool IsBusy
    {
        get => _isBusy;
        private set => SetProperty(ref _isBusy, value);
    }

    public bool IsComposeMode
    {
        get => _isComposeMode;
        set => SetProperty(ref _isComposeMode, value);
    }

    public ICommand OpenConversationCommand { get; }
    public ICommand SendCommand { get; }
    public ICommand SearchUserCommand { get; }
    public ICommand SendComposeCommand { get; }
    public ICommand DeleteCommand { get; }
    public ICommand RestoreCommand { get; }
    public ICommand ReplyCommand { get; }
    public ICommand CloseCommand { get; }

    public async Task<bool> DeleteMessagesAsync(IReadOnlyList<MessagingMessage> messages)
    {
        if (IsBusy)
        {
            return false;
        }

        var ids = (messages ?? Array.Empty<MessagingMessage>())
            .Select(m => m?.Id)
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (ids.Length == 0)
        {
            return false;
        }

        if (SelectedBox == MessagingBox.Deleted)
        {
            var confirm = await _dialogs
                .Confirm(
                    "Suppression définitive",
                    ids.Length == 1
                        ? "Cette action supprime définitivement le message. Continuer ?"
                        : $"Cette action supprime définitivement {ids.Length} messages. Continuer ?",
                    okText: "Supprimer",
                    cancelText: "Annuler")
                .ConfigureAwait(true);
            if (confirm != true)
            {
                return true;
            }

            IsBusy = true;
            try
            {
                var removed = 0;
                foreach (var id in ids)
                {
                    var purged = await _service.PurgeAsync(id!).ConfigureAwait(true);
                    if (purged != null)
                    {
                        removed++;
                        RemoveMessage(purged.Id);
                    }
                }

                Status = removed > 0
                    ? (removed == 1 ? "Message supprimé définitivement." : $"{removed} messages supprimés définitivement.")
                    : "Aucune suppression effectuée.";
            }
            catch (Exception ex)
            {
                Status = $"Erreur lors de la suppression définitive : {ex.Message}";
            }
            finally
            {
                IsBusy = false;
            }

            await LoadBoxAsync(SelectedBox, selectFirst: true).ConfigureAwait(true);
            FocusFirstMessageRequested?.Invoke(this, EventArgs.Empty);
            return true;
        }

        var confirmDelete = await _dialogs
            .Confirm(
                "Confirmer la suppression",
                ids.Length == 1
                    ? "Voulez-vous vraiment supprimer ce message ?"
                    : $"Voulez-vous vraiment supprimer {ids.Length} messages ?",
                okText: "Supprimer",
                cancelText: "Annuler")
            .ConfigureAwait(true);
        if (confirmDelete != true)
        {
            return true;
        }

        IsBusy = true;
        var moved = 0;
        try
        {
            foreach (var id in ids)
            {
                var deleted = await _service.DeleteAsync(id!).ConfigureAwait(true);
                if (deleted != null)
                {
                    moved++;
                    ReplaceMessage(deleted);
                }
            }

            Status = moved > 0
                ? (moved == 1 ? "Message supprimé." : $"{moved} messages supprimés.")
                : "Aucune suppression effectuée.";
        }
        catch (Exception ex)
        {
            Status = $"Erreur lors de la suppression : {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }

        if (moved > 0)
        {
            await LoadBoxAsync(SelectedBox, selectFirst: true).ConfigureAwait(true);
            await _dialogs
                .ShowInfo(
                    "Message supprimé",
                    moved == 1
                        ? "Le message a été déplacé dans la corbeille."
                        : $"{moved} messages ont été déplacés dans la corbeille.")
                .ConfigureAwait(true);
            FocusFirstMessageRequested?.Invoke(this, EventArgs.Empty);
        }

        return true;
    }

    public async Task InitializeAsync()
    {
        await LoadBoxAsync(SelectedBox).ConfigureAwait(true);
    }

    public async Task OnNavigatedToAsync(ShellNavigationContext context, CancellationToken cancellationToken)
    {
        if (cancellationToken.IsCancellationRequested)
        {
            return;
        }

        await InitializeAsync().ConfigureAwait(true);
    }

    public Task OnNavigatedFromAsync(ShellNavigationContext context, CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }

    public Task ReloadSelectedBoxAsync()
    {
        return LoadBoxAsync(SelectedBox);
    }

    private async Task LoadBoxAsync(MessagingBox box, bool selectFirst = false)
    {
        if (IsBusy)
        {
            return;
        }
        IsBusy = true;
        try
        {
            var previousId = selectFirst ? null : SelectedMessage?.Id;
            BoxMessages.Clear();
            var items = await _service.GetBoxAsync(box).ConfigureAwait(true);
            foreach (var item in items.OrderByDescending(m => m.CreatedAt))
            {
                BoxMessages.Add(item);
            }

            if (!string.IsNullOrWhiteSpace(previousId))
            {
                SelectedMessage = BoxMessages.FirstOrDefault(m => string.Equals(m.Id, previousId, StringComparison.OrdinalIgnoreCase))
                                 ?? BoxMessages.FirstOrDefault();
            }
            else
            {
                SelectedMessage = BoxMessages.FirstOrDefault();
            }

            var boxName = box switch
            {
                MessagingBox.Inbox => "inbox",
                MessagingBox.Outbox => "outbox",
                MessagingBox.Deleted => "deleted",
                _ => "unknown"
            };
            Status = $"Boîte {boxName} : {BoxMessages.Count} messages.";
        }
        catch (Exception ex)
        {
            Status = $"Erreur lors du chargement : {ex.Message}";
            await _dialogs.ShowError("Messagerie", $"Erreur lors du chargement : {ex.Message}").ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task OpenConversationAsync()
    {
        if (SelectedMessage == null)
        {
            return;
        }

        var otherUser = SelectedMessage.IsSent ? SelectedMessage.Recipient : SelectedMessage.Sender;
        ConversationUser = otherUser;
        await LoadConversationAsync(otherUser.Id).ConfigureAwait(true);
    }

    private async Task LoadConversationAsync(int userId)
    {
        if (userId <= 0 || IsBusy)
        {
            return;
        }
        IsBusy = true;
        try
        {
            ConversationMessages.Clear();
            var items = await _service.GetConversationAsync(userId).ConfigureAwait(true);
            foreach (var item in items.OrderBy(m => m.CreatedAt))
            {
                ConversationMessages.Add(item);
            }
            Status = $"Conversation avec {ConversationUser?.Username ?? "utilisateur"} : {ConversationMessages.Count} messages.";
        }
        catch (Exception ex)
        {
            Status = $"Erreur lors du chargement de la conversation : {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task SendAsync()
    {
        if (ConversationUser == null || string.IsNullOrWhiteSpace(InputText) || IsBusy)
        {
            if (ConversationUser == null)
            {
                MessageBox.Show(
                    "Aucun destinataire sélectionné. Veuillez d'abord ouvrir une conversation.",
                    "Erreur d'envoi",
                    MessageBoxButton.OK,
                    MessageBoxImage.Warning);
            }
            else if (string.IsNullOrWhiteSpace(InputText))
            {
                MessageBox.Show(
                    "Le message ne peut pas être vide. Veuillez saisir du texte avant d'envoyer.",
                    "Erreur d'envoi",
                    MessageBoxButton.OK,
                    MessageBoxImage.Warning);
            }
            return;
        }

        IsBusy = true;
        try
        {
            var message = await _service.SendAsync(ConversationUser.Id, InputText.Trim()).ConfigureAwait(true);
            if (message != null)
            {
                ConversationMessages.Add(message);
                BoxMessages.Insert(0, message);
                SelectedMessage = message;
                InputText = string.Empty;
                Status = "Message envoyé avec succès.";
                await _dialogs
                    .ShowInfo("Message envoyé", $"Votre message a été envoyé à {ConversationUser.Username}.")
                    .ConfigureAwait(true);
                NavigateHomeRequested?.Invoke(this, EventArgs.Empty);
            }
            else
            {
                Status = "Échec de l'envoi du message.";
                MessageBox.Show(
                    "L'envoi du message a échoué. Le serveur n'a pas pu traiter votre demande. Veuillez réessayer.",
                    "Erreur d'envoi",
                    MessageBoxButton.OK,
                    MessageBoxImage.Error);
            }
        }
        catch (Exception ex)
        {
            Status = $"Erreur lors de l'envoi : {ex.Message}";
            MessageBox.Show(
                $"Une erreur est survenue lors de l'envoi du message :\n\n{ex.Message}\n\nVeuillez vérifier votre connexion et réessayer.",
                "Erreur d'envoi",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task SendComposeAsync()
    {
        if (IsBusy || string.IsNullOrWhiteSpace(ComposeRecipient) || string.IsNullOrWhiteSpace(ComposeBody))
        {
            if (string.IsNullOrWhiteSpace(ComposeRecipient))
            {
                MessageBox.Show(
                    "Le champ destinataire est vide. Veuillez saisir le nom d'utilisateur du destinataire.",
                    "Erreur d'envoi",
                    MessageBoxButton.OK,
                    MessageBoxImage.Warning);
            }
            else if (string.IsNullOrWhiteSpace(ComposeBody))
            {
                MessageBox.Show(
                    "Le message ne peut pas être vide. Veuillez saisir le contenu de votre message.",
                    "Erreur d'envoi",
                    MessageBoxButton.OK,
                    MessageBoxImage.Warning);
            }
            return;
        }

        IsBusy = true;
        try
        {
            var recipient = await _service.SearchUserAsync(ComposeRecipient.Trim()).ConfigureAwait(true);
            if (recipient == null)
            {
                Status = "Utilisateur introuvable.";
                MessageBox.Show(
                    $"L'utilisateur '{ComposeRecipient}' est introuvable. Veuillez vérifier le nom d'utilisateur et réessayer.",
                    "Destinataire introuvable",
                    MessageBoxButton.OK,
                    MessageBoxImage.Warning);
                IsBusy = false;
                return;
            }

            var messageText = ComposeBody.Trim();
            var subject = string.IsNullOrWhiteSpace(ComposeSubject) ? null : ComposeSubject.Trim();

            var message = await _service.SendAsync(recipient.Id, messageText, subject).ConfigureAwait(true);
            if (message != null)
            {
                ConversationUser = recipient;
                ConversationMessages.Clear();
                ConversationMessages.Add(message);
                BoxMessages.Insert(0, message);
                SelectedMessage = message;
                ComposeRecipient = string.Empty;
                ComposeSubject = string.Empty;
                ComposeBody = string.Empty;
                IsComposeMode = false;
                Status = "Message envoyé avec succès.";
                var subjectLabel = string.IsNullOrWhiteSpace(subject) ? "Sans sujet" : subject;
                await _dialogs
                    .ShowInfo("Message envoyé", $"Envoyé à {recipient.Username}.\nSujet : {subjectLabel}")
                    .ConfigureAwait(true);
                NavigateHomeRequested?.Invoke(this, EventArgs.Empty);
            }
            else
            {
                Status = "Échec de l'envoi du message.";
                MessageBox.Show(
                    "L'envoi du message a échoué. Le serveur n'a pas pu traiter votre demande. Veuillez réessayer.",
                    "Erreur d'envoi",
                    MessageBoxButton.OK,
                    MessageBoxImage.Error);
            }
        }
        catch (Exception ex)
        {
            Status = $"Erreur lors de l'envoi : {ex.Message}";
            MessageBox.Show(
                $"Une erreur est survenue lors de l'envoi du message :\n\n{ex.Message}\n\nVeuillez vérifier votre connexion et réessayer.",
                "Erreur d'envoi",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task SearchUserAsync()
    {
        if (IsBusy || string.IsNullOrWhiteSpace(SearchQuery))
        {
            return;
        }

        IsBusy = true;
        try
        {
            var result = await _service.SearchUserAsync(SearchQuery.Trim()).ConfigureAwait(true);
            if (result != null)
            {
                ConversationUser = result;
                await LoadConversationAsync(result.Id).ConfigureAwait(true);
                Status = $"Conversation ouverte avec {result.Username}.";
            }
            else
            {
                Status = "Utilisateur introuvable.";
            }
        }
        catch (Exception ex)
        {
            Status = $"Erreur lors de la recherche : {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task DeleteAsync()
    {
        var message = SelectedMessage;
        if (message == null || IsBusy)
        {
            return;
        }

        await DeleteMessagesAsync(new[] { message }).ConfigureAwait(true);
    }

    private async Task PurgeAsync(MessagingMessage message)
    {
        var confirm = await _dialogs
            .Confirm(
                "Suppression définitive",
                "Cette action supprime définitivement le message. Continuer ?",
                okText: "Supprimer",
                cancelText: "Annuler")
            .ConfigureAwait(true);
        if (confirm != true)
        {
            return;
        }

        var reload = false;
        IsBusy = true;
        try
        {
            var purged = await _service.PurgeAsync(message.Id).ConfigureAwait(true);
            if (purged != null)
            {
                RemoveMessage(purged.Id);
                Status = "Message supprimé définitivement.";
                reload = true;
            }
            else
            {
                Status = "Échec de la suppression définitive.";
            }
        }
        catch (Exception ex)
        {
            Status = $"Erreur lors de la suppression définitive : {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }

        if (reload)
        {
            await LoadBoxAsync(SelectedBox, selectFirst: true).ConfigureAwait(true);
            await _dialogs
                .ShowInfo("Message supprimé", "Le message a été supprimé définitivement.")
                .ConfigureAwait(true);
            FocusFirstMessageRequested?.Invoke(this, EventArgs.Empty);
        }
    }

    private async Task RestoreAsync()
    {
        var message = SelectedMessage;
        if (message == null || IsBusy)
        {
            return;
        }

        var confirm = await _dialogs
            .Confirm(
                "Confirmer la restauration",
                "Voulez-vous vraiment restaurer ce message ?",
                okText: "Restaurer",
                cancelText: "Annuler")
            .ConfigureAwait(true);
        if (confirm != true)
        {
            return;
        }

        var reload = false;
        IsBusy = true;
        try
        {
            var restored = await _service.RestoreAsync(message.Id).ConfigureAwait(true);
            if (restored != null)
            {
                ReplaceMessage(restored);
                Status = "Message restauré.";
                reload = true;
            }
            else
            {
                Status = "Échec de la restauration.";
            }
        }
        catch (Exception ex)
        {
            Status = $"Erreur lors de la restauration : {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }

        if (reload)
        {
            await LoadBoxAsync(SelectedBox, selectFirst: true).ConfigureAwait(true);
            await _dialogs
                .ShowInfo("Message restauré", "Le message a été restauré.")
                .ConfigureAwait(true);
            FocusFirstMessageRequested?.Invoke(this, EventArgs.Empty);
        }
    }

    private void Reply()
    {
        if (SelectedMessage == null)
        {
            return;
        }

        // Déterminer l'expéditeur du message original (pour pré-remplir le destinataire)
        var replyTo = SelectedMessage.IsSent ? SelectedMessage.Recipient : SelectedMessage.Sender;

        // Pré-remplir les champs de composition
        ComposeRecipient = replyTo.Username;
        ComposeSubject = SelectedMessage.Subject.StartsWith("Re: ")
            ? SelectedMessage.Subject
            : $"Re: {SelectedMessage.Subject}";
        ComposeBody = string.Empty;

        // Passer en mode composition
        IsComposeMode = true;
    }

    private static string FormatMessageDetail(MessagingMessage? message)
    {
        if (message == null)
        {
            return string.Empty;
        }

        var subject = string.IsNullOrWhiteSpace(message.Subject) ? "Sans sujet" : message.Subject.Trim();
        var sender = message.Sender?.Username ?? "inconnu";
        var recipient = message.Recipient?.Username ?? "inconnu";
        var body = NormalizeBody(message.Text);

        return
            $"Sujet: {subject}\n" +
            $"De: {sender}\n" +
            $"À: {recipient}\n" +
            "Contenu:\n" +
            body;
    }

    private static string NormalizeBody(string? rawText)
    {
        var body = rawText ?? string.Empty;
        if (string.IsNullOrWhiteSpace(body))
        {
            return string.Empty;
        }

        // Certains messages historiques ont été stockés avec des en-têtes ("De:", "Contenu:") déjà présents
        // dans le corps, ce qui provoque des doublons dans l'affichage du détail.
        // On ne "nettoie" que si le texte ressemble clairement à un détail pré-formaté.
        var sample = body.Length > 300 ? body[..300] : body;
        var looksFormatted =
            sample.Contains("Contenu:", StringComparison.OrdinalIgnoreCase) &&
            (sample.TrimStart().StartsWith("Sujet:", StringComparison.OrdinalIgnoreCase) ||
             sample.TrimStart().StartsWith("De:", StringComparison.OrdinalIgnoreCase));

        if (!looksFormatted)
        {
            return body;
        }

        var idx = body.IndexOf("Contenu:", StringComparison.OrdinalIgnoreCase);
        if (idx < 0)
        {
            return body;
        }

        var after = body[(idx + "Contenu:".Length)..];
        if (after.StartsWith("\r\n", StringComparison.Ordinal))
        {
            after = after[2..];
        }
        else if (after.StartsWith("\n", StringComparison.Ordinal))
        {
            after = after[1..];
        }

        return after.TrimStart('\r', '\n');
    }

    private void ReplaceMessage(MessagingMessage updated)
    {
        ReplaceInCollection(BoxMessages, updated);
        ReplaceInCollection(ConversationMessages, updated);
        SelectedMessage = updated;
    }

    private void RemoveMessage(string messageId)
    {
        RemoveInCollection(BoxMessages, messageId);
        RemoveInCollection(ConversationMessages, messageId);
        if (SelectedMessage != null && string.Equals(SelectedMessage.Id, messageId, StringComparison.OrdinalIgnoreCase))
        {
            SelectedMessage = null;
        }
    }

    private static void ReplaceInCollection(ObservableCollection<MessagingMessage> collection, MessagingMessage updated)
    {
        for (int i = 0; i < collection.Count; i++)
        {
            if (string.Equals(collection[i].Id, updated.Id, StringComparison.OrdinalIgnoreCase))
            {
                collection[i] = updated;
                return;
            }
        }
    }

    private static void RemoveInCollection(ObservableCollection<MessagingMessage> collection, string messageId)
    {
        for (int i = 0; i < collection.Count; i++)
        {
            if (string.Equals(collection[i].Id, messageId, StringComparison.OrdinalIgnoreCase))
            {
                collection.RemoveAt(i);
                return;
            }
        }
    }
}
