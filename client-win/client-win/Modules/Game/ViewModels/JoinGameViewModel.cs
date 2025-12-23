using System;
using System.Windows.Input;
using client_win.Core;

namespace client_win.Modules.Game.ViewModels;

/// <summary>
/// ViewModel pour la sélection et l'accès aux parties de jeu.
/// TODO: Implémenter la logique de récupération et d'affichage des parties disponibles.
/// </summary>
public sealed class JoinGameViewModel : ObservableObject
{
    private readonly Action? _onClose;
    private string _status = "Chargement des parties disponibles...";

    public JoinGameViewModel(Action? onClose = null)
    {
        _onClose = onClose;
        CloseCommand = new RelayCommand(HandleClose);

        // TODO: Charger la liste des parties depuis le serveur
        Status = "Fonctionnalité en cours de développement.\nLes parties de jeu seront affichées ici.";
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
