using System;
using System.Windows.Input;
using client_win.Core;

namespace client_win.Modules.Social.ViewModels;

/// <summary>
/// ViewModel pour les fonctionnalités sociales (amis, profils, classements).
/// TODO: Implémenter la logique de gestion des amis et du réseau social.
/// </summary>
public sealed class SocialViewModel : ObservableObject
{
    private readonly Action? _onClose;
    private string _status = "Chargement du réseau social...";

    public SocialViewModel(Action? onClose = null)
    {
        _onClose = onClose;
        CloseCommand = new RelayCommand(HandleClose);

        // TODO: Charger la liste d'amis et les profils depuis le serveur
        Status = "Fonctionnalité en cours de développement.\nLe réseau social sera disponible ici.";
    }

    public ICommand CloseCommand { get; }

    public string Status
    {
        get => _status;
        set => SetProperty(ref _status, value);
    }

    private void HandleClose()
    {
        _onClose?.Invoke();
    }
}
