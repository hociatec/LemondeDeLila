using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using client_win.Core;
using client_win.Modules.Messaging.Models;
using client_win.Modules.Messaging.Services;

namespace client_win.Modules.Messaging.ViewModels;

public sealed class MessagingViewModel : ObservableObject
{
    private readonly IMessagingService _service;
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

    public MessagingViewModel(IMessagingService service, Action onClose)
    {
        _service = service ?? throw new ArgumentNullException(nameof(service));
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
        set => SetProperty(ref _selectedMessage, value);
    }

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

    public async Task InitializeAsync()
    {
        await LoadBoxAsync(SelectedBox).ConfigureAwait(true);
    }

    public Task ReloadSelectedBoxAsync()
    {
        return LoadBoxAsync(SelectedBox);
    }

    private async Task LoadBoxAsync(MessagingBox box)
    {
        if (IsBusy)
        {
            return;
        }
        IsBusy = true;
        try
        {
            BoxMessages.Clear();
            var items = await _service.GetBoxAsync(box).ConfigureAwait(true);
            foreach (var item in items.OrderByDescending(m => m.CreatedAt))
            {
                BoxMessages.Add(item);
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
            MessageBox.Show(
                $"Erreur lors du chargement de la messagerie :\n\n{ex.Message}",
                "Erreur de chargement",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
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
                MessageBox.Show(
                    $"Votre message a été envoyé avec succès à {ConversationUser.Username}.",
                    "Message envoyé",
                    MessageBoxButton.OK,
                    MessageBoxImage.Information);
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
                MessageBox.Show(
                    $"Votre message a été envoyé avec succès à {recipient.Username}.",
                    "Message envoyé",
                    MessageBoxButton.OK,
                    MessageBoxImage.Information);
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

        var confirm = MessageBox.Show(
            "Voulez-vous vraiment supprimer ce message ?",
            "Confirmer la suppression",
            MessageBoxButton.OKCancel,
            MessageBoxImage.Warning);
        if (confirm != MessageBoxResult.OK)
        {
            return;
        }

        var reload = false;
        IsBusy = true;
        try
        {
            var deleted = await _service.DeleteAsync(message.Id).ConfigureAwait(true);
            if (deleted != null)
            {
                ReplaceMessage(deleted);
                Status = "Message supprimé.";
                reload = true;
            }
            else
            {
                Status = "Échec de la suppression.";
            }
        }
        catch (Exception ex)
        {
            Status = $"Erreur lors de la suppression : {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }

        if (reload)
        {
            await LoadBoxAsync(SelectedBox).ConfigureAwait(true);
        }
    }

    private async Task RestoreAsync()
    {
        var message = SelectedMessage;
        if (message == null || IsBusy)
        {
            return;
        }

        var confirm = MessageBox.Show(
            "Voulez-vous vraiment restaurer ce message ?",
            "Confirmer la restauration",
            MessageBoxButton.OKCancel,
            MessageBoxImage.Question);
        if (confirm != MessageBoxResult.OK)
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
            await LoadBoxAsync(SelectedBox).ConfigureAwait(true);
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

    private void ReplaceMessage(MessagingMessage updated)
    {
        ReplaceInCollection(BoxMessages, updated);
        ReplaceInCollection(ConversationMessages, updated);
        SelectedMessage = updated;
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
}
