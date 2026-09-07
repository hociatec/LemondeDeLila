#include <iostream>
#include <stdexcept>
#include <string>

#include "modules/rooms/infrastructure/RoomCommandProtocol.h"
#include "modules/rooms/infrastructure/RoomInvitationPayloadCodec.h"
#include "modules/rooms/infrastructure/TableAmbiencePayloadCodec.h"
#include "modules/rooms/presentation/shortcuts/RoomShortcutPolicy.h"

namespace
{
void Expect(bool condition, const char* message)
{
    if (!condition) throw std::runtime_error(message);
}
}

int main()
{
    using namespace lila::modules::rooms;
    domain::RoomState room;
    room.allowedActions = {
        "room.toggle-privacy", "room.set-role", "room.snapshot.save",
        "room.set-ambience", "room.invite",
        "room.kick", "room.ban", "room.set-owner", "bot.add", "bot.remove",
        "room.reset", "room.leave"};
    Expect(presentation::RoomShortcutPolicy::Resolve('A', true, false, false, false, room) ==
        "room:ambience", "Ctrl+A doit dépendre de room.set-ambience.");
    Expect(presentation::RoomShortcutPolicy::Resolve('V', true, false, false, false, room) ==
        "room:ambience-volume", "Ctrl+V doit rester une action d'interface locale.");
    Expect(presentation::RoomShortcutPolicy::Resolve('I', true, false, false, false, room) ==
        "room:invite", "Ctrl+I doit dépendre de room.invite.");
    Expect(presentation::RoomShortcutPolicy::Resolve('K', true, false, false, false, room) ==
        "room:kick", "Ctrl+K doit dépendre de room.kick.");
    Expect(presentation::RoomShortcutPolicy::Resolve('B', true, false, false, false, room) ==
        "room:ban", "Ctrl+B doit dépendre de room.ban.");
    Expect(presentation::RoomShortcutPolicy::Resolve('P', true, false, false, false, room) ==
        "room:set-owner", "Ctrl+P doit dépendre de room.set-owner.");
    Expect(presentation::RoomShortcutPolicy::Resolve('H', true, false, false, false, room) ==
        "room:privacy", "Ctrl+H doit rester disponible.");
    Expect(presentation::RoomShortcutPolicy::Resolve('M', true, false, false, false, room) ==
        "room:role", "Ctrl+M doit rester disponible.");
    Expect(presentation::RoomShortcutPolicy::Resolve('S', true, false, false, false, room) ==
        "room:save", "Ctrl+S doit rester disponible.");
    Expect(presentation::RoomShortcutPolicy::Resolve('B', false, false, false, false, room) ==
        "room:add-bot", "B doit continuer à ajouter un bot.");
    Expect(presentation::RoomShortcutPolicy::Resolve('B', false, false, false, true, room) ==
        "room:remove-bot", "Maj+B doit continuer à retirer un bot.");
    Expect(presentation::RoomShortcutPolicy::Resolve('W', false, false, false, false, room) ==
        "room:players", "W doit continuer à lister les joueurs.");
    Expect(presentation::RoomShortcutPolicy::Resolve('I', false, false, false, false, room) ==
        "room:info", "I doit continuer à afficher les informations.");
    Expect(presentation::RoomShortcutPolicy::Resolve('R', false, false, false, false, room) ==
        "room:rules", "R doit continuer à afficher les règles.");
    Expect(presentation::RoomShortcutPolicy::Resolve('X', false, false, false, false, room).empty(),
        "X doit rester silencieux tant que la table n'est pas démarree.");
    room.status = "started";
    Expect(presentation::RoomShortcutPolicy::Resolve('X', false, false, false, false, room) ==
        "room:reset", "X doit réinitialiser une table démarree.");
    Expect(presentation::RoomShortcutPolicy::Resolve('Q', false, false, false, false, room) ==
        "room:leave", "Q doit continuer à quitter la table.");
    domain::RoomState forbiddenRoom;
    Expect(presentation::RoomShortcutPolicy::Resolve('V', true, false, false, false,
        forbiddenRoom) == "room:ambience-volume",
        "Le volume local ne doit pas dépendre des permissions serveur.");
    Expect(presentation::RoomShortcutPolicy::Resolve('W', false, false, false, false,
        forbiddenRoom) == "room:players" &&
        presentation::RoomShortcutPolicy::Resolve('I', false, false, false, false,
            forbiddenRoom) == "room:info" &&
        presentation::RoomShortcutPolicy::Resolve('R', false, false, false, false,
            forbiddenRoom) == "room:rules",
        "Les écrans locaux ne doivent pas dépendre des permissions serveur.");
    Expect(presentation::RoomShortcutPolicy::Resolve('K', true, false, false, false,
        forbiddenRoom).empty(), "Sans allowedActions, Ctrl+K doit être désactivé.");
    Expect(infrastructure::command_protocol::Type(domain::RoomCommand::SetAmbience) ==
        "room.set-ambience", "L'ambiance doit utiliser le nom backend exact.");
    Expect(infrastructure::command_protocol::Type(domain::RoomCommand::Kick) ==
        "room.kick", "L'exclusion doit utiliser le nom backend exact.");
    Expect(infrastructure::command_protocol::Type(domain::RoomCommand::Ban) ==
        "room.ban", "Le bannissement doit utiliser le nom backend exact.");
    Expect(infrastructure::command_protocol::Type(domain::RoomCommand::SetOwner) ==
        "room.set-owner", "Le transfert doit utiliser le nom backend exact.");
    const std::string raw = R"({"type":"room.lobby.invite.received","payload":{"invitationId":"inv-7","room":{"id":42,"name":"Table test"},"from":{"id":3,"username":"Lila"}}})";
    const auto invitation = infrastructure::ReadRoomInvitationMessage(raw);
    Expect(invitation && invitation->invitationId == "inv-7" && invitation->roomId == 42 &&
        invitation->fromUsername == "Lila", "L'invitation notify doit être décodée exactement.");
    Expect(!infrastructure::ReadRoomInvitationMessage("{broken"),
        "Une notification invalide doit être ignorée.");
    const auto ambiences = infrastructure::ReadTableAmbiencesResponse(
        R"({"items":[{"soundId":"TableAmbience2","name":"Pluie","enabled":true},{"soundId":"TableAmbience3","name":"Masquée","enabled":false}]})");
    Expect(ambiences.size() == 1 && ambiences.front().soundId == "TableAmbience2" &&
        ambiences.front().name == "Pluie",
        "Le sélecteur doit utiliser exactement la liste d'ambiances actives du backend.");
    std::cout << "Room contract tests passed.\n";
}
