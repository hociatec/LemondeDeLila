using System;
using System.Linq;
using System.Threading.Tasks;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private AdminProfileSettingsDto? _profileSettings;

    private void BuildUsersProfileMenu()
    {
        _page = AdminPage.UsersProfile;
        Title = "Gestion profil";
        Details = "Réglages globaux du profil.";
        Items.Clear();
        Items.Add(new AdminMenuItem("Bio (min/max)", tag: "users.profile.bio"));
        SelectedItem = Items.FirstOrDefault();
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Status = "Entrée : sélectionner. Échap : retour.";
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }

    private async Task OpenProfileBioSettingsAsync()
    {
        try
        {
            IsBusy = true;
            _profileSettings = await _admin.GetProfileSettingsAsync().ConfigureAwait(true);
            BuildProfileBioSettingsForm(_profileSettings);
        }
        catch (Exception ex)
        {
            await _dialogs.ShowError("Profil", ex.Message).ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void BuildProfileBioSettingsForm(AdminProfileSettingsDto? settings)
    {
        _page = AdminPage.UsersProfileBioSettings;
        Title = "Gestion profil - Bio";
        Details = settings == null ? string.Empty : $"Bio: {settings.BioMinLength}-{settings.BioMaxLength} caractères.";
        Items.Clear();
        Items.Add(new AdminMenuItem("Valider", tag: "users.profile.submit"));
        SelectedItem = Items.FirstOrDefault();

        TextInputLabel = "Caractères minimum";
        TextInput = (settings?.BioMinLength ?? 0).ToString();
        SecondaryInputLabel = "Caractères maximum";
        SecondaryInput = (settings?.BioMaxLength ?? 500).ToString();
        SecondaryInputAcceptsReturn = false;
        IsTextInputVisible = true;
        IsSecondaryInputVisible = true;
        IsAdditionalPermissionsVisible = false;
        Status = "Saisissez min/max. Entrée : valider. Échap : retour.";
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }

    private async Task SubmitProfileSettingsAsync()
    {
        if (!int.TryParse((TextInput ?? string.Empty).Trim(), out var min) || min < 0)
        {
            await _dialogs.ShowError("Profil", "Minimum invalide.").ConfigureAwait(true);
            return;
        }
        if (!int.TryParse((SecondaryInput ?? string.Empty).Trim(), out var max) || max < 0)
        {
            await _dialogs.ShowError("Profil", "Maximum invalide.").ConfigureAwait(true);
            return;
        }
        if (min > max)
        {
            await _dialogs.ShowError("Profil", "Le minimum ne peut pas dépasser le maximum.").ConfigureAwait(true);
            return;
        }

        try
        {
            IsBusy = true;
            _profileSettings = await _admin.UpdateProfileSettingsAsync(min, max).ConfigureAwait(true);
            BuildProfileBioSettingsForm(_profileSettings);
            await _dialogs.ShowInfo("Profil", $"Paramètres mis à jour: {_profileSettings}").ConfigureAwait(true);
        }
        catch (Exception ex)
        {
            await _dialogs.ShowError("Profil", ex.Message).ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }
}
