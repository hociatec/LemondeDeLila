using System;
using System.Collections.Generic;
using System.Linq;
using System.Windows;

namespace client_win.Modules.TextPrompts.Views;

public partial class ConfigPromptWindow : Window
{
    public Dictionary<string, string>? Result { get; private set; }

    public ConfigPromptWindow()
    {
        InitializeComponent();
    }

    private void OnOkClick(object sender, RoutedEventArgs e)
    {
        try
        {
            if (DataContext is not ConfigPromptWindowModel vm)
            {
                DialogResult = false;
                return;
            }

            var dict = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var field in vm.Fields)
            {
                var key = (field.Key ?? string.Empty).Trim();
                if (string.IsNullOrWhiteSpace(key))
                {
                    continue;
                }

                dict[key] = (field.Text ?? string.Empty).Trim();
            }

            // Require all fields to be filled (simple generic rule).
            var missing = vm.Fields
                .Where(f => !string.IsNullOrWhiteSpace(f.Key))
                .Any(f => string.IsNullOrWhiteSpace(dict.GetValueOrDefault(f.Key, string.Empty)));
            if (missing)
            {
                MessageBox.Show(this, "Veuillez remplir tous les champs.", "Configuration",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            Result = dict;
            DialogResult = true;
        }
        catch
        {
            DialogResult = false;
        }
    }
}

