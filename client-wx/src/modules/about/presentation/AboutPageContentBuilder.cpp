#include "modules/about/presentation/AboutPageContentBuilder.h"

#include <wx/datetime.h>
#include <wx/filename.h>
#include <wx/stdpaths.h>

namespace lila::modules::about::presentation
{
namespace
{
wxString BuildShortcutsText()
{
    wxString text;
    text << L"Général\n";
    text << L"- Flèches : naviguer\n";
    text << L"- Entrée : valider / sélectionner\n";
    text << L"- Échap : retour / fermer\n";
    text << L"- Ctrl+U : présence (joueurs connectés)\n";
    text << L"- F3 : contacter un administrateur\n\n";
    text << L"Table (salle)\n";
    text << L"- F2 : menu de la table (actions)\n";
    text << L"- Tab : basculer Zone de jeu vers Historique\n";
    text << L"- Maj+Tab : basculer Historique vers Zone de jeu\n";
    text << L"- i : informations table\n";
    text << L"- w : lister les joueurs\n";
    text << L"- q : quitter la table\n";
    text << L"- b : ajouter un bot (hors partie)\n";
    text << L"- Maj+B : retirer un bot (hors partie)\n";
    text << L"- Ctrl+I : inviter un joueur\n";
    text << L"- Ctrl+K : exclure un joueur ou bot\n";
    text << L"- Ctrl+B : bannir un joueur\n";
    text << L"- Ctrl+P : changer le propriétaire\n";
    text << L"- Ctrl+M : mode joueur/spectateur\n";
    text << L"- Ctrl+H : visibilité de la table\n\n";
    text << L"Objets / interface (en partie, selon le jeu)\n";
    text << L"- Espace : piocher\n";
    text << L"- Retour arrière : défausser (choisir une carte)\n";
    text << L"- s : score (Panier Express)\n";
    text << L"- l : shopping list (Panier Express)\n";
    text << L"- b : annoncer panier\n";
    text << L"- i : annoncer l'inventaire\n";
    text << L"- c : annoncer main\n";
    text << L"- f : annoncer les familles complètes\n";
    text << L"- p : position plateau\n\n";
    text << L"Tchat\n";
    text << L"- Entrée : envoyer le message\n";
    text << L"- Échap : fermer le tchat\n";
    return text;
}
}

AboutPageContent AboutPageContentBuilder::BuildRoot()
{
    return {wxString(L"À propos"), wxString(L"Entrée : ouvrir. Échap : retour."), wxString(L"À propos"), wxEmptyString};
}

AboutPageContent AboutPageContentBuilder::BuildShortcuts()
{
    return {wxString(L"Raccourcis"), wxString(L"Échap : retour."), wxString(L"Raccourcis"), BuildShortcutsText()};
}

AboutPageContent AboutPageContentBuilder::BuildInfo(
    lila::modules::session::application::SessionStore& sessionStore)
{
    (void)sessionStore;
    return {
        wxString(L"Informations sur l'application"),
        wxString(L"Flèches : lire. Échap : retour."),
        wxString(L"Informations sur l'application"),
        wxEmptyString};
}

AboutPageContent AboutPageContentBuilder::BuildContactAdmin()
{
    return {
        wxString(L"Contacter un administrateur"),
        wxString(L"Tab : naviguer. Échap : retour."),
        wxString(L"Contacter un administrateur"),
        wxEmptyString};
}

wxString AboutPageContentBuilder::ResolveLocalUpdatedAt()
{
    wxFileName executablePath(wxStandardPaths::Get().GetExecutablePath());
    if (!executablePath.FileExists())
    {
        return L"Inconnue";
    }

    const wxDateTime modifiedAt = executablePath.GetModificationTime();
    if (!modifiedAt.IsValid())
    {
        return L"Inconnue";
    }

    return modifiedAt.Format(L"%d/%m/%Y %H:%M");
}
}
