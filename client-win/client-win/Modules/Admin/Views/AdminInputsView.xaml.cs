using System;
using System.Windows.Controls;
using System.Windows.Input;

namespace client_win.Modules.Admin.Views;

public partial class AdminInputsView : UserControl
{
    public AdminInputsView()
    {
        InitializeComponent();
    }

    private void OnInputPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Handled || e.IsRepeat)
        {
            return;
        }

        if (e.Key != Key.Enter && e.Key != Key.Return)
        {
            return;
        }

        if (sender is not TextBox input)
        {
            return;
        }

        // Multiligne: Entrée doit insérer une ligne, pas valider le formulaire.
        // Fallback ergonomique: Ctrl+Entrée valide quand même.
        var isCtrl = (Keyboard.Modifiers & ModifierKeys.Control) != ModifierKeys.None;
        if (input.AcceptsReturn && !isCtrl)
        {
            return;
        }

        try
        {
            var vm = input.DataContext;
            if (vm == null)
            {
                return;
            }

            var prop = vm.GetType().GetProperty("ActivateCommand");
            if (prop?.GetValue(vm) is not ICommand command)
            {
                return;
            }

            if (!command.CanExecute(null))
            {
                return;
            }

            e.Handled = true;
            command.Execute(null);
        }
        catch
        {
            // best-effort
        }
    }

    public TextBox? PrimaryInputBox => PrimaryInput;

    public TextBox? SecondaryInputTextBox => SecondaryInputBox;

    public TextBox? ThirdInputTextBox => ThirdInputBox;

    public TextBox? FourthInputTextBox => FourthInputBox;

    public TextBox? FifthInputTextBox => FifthInputBox;
}
