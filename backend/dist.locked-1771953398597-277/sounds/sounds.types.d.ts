export declare const SOUND_KEYS: readonly ["ClientOpened", "ClientConnected", "ClientDisconnected", "ClientClosing", "ClientUpdateWarning", "MainMenuMusic", "TavernAmbience", "TavernOpened", "DiceRolled", "DrawCard", "ChatMessageSent", "ChatMessageReceived", "TableChatMessageSent", "TableChatMessageReceived", "PrivateMessageSent", "PrivateMessageReceived", "AdminContactSent", "AdminContactReceived", "BugReportCommentReceived", "FriendConnected", "FriendDisconnected", "FriendInvitationSent", "FriendInvitationReceived", "GameVictory", "GameDefeat", "QuizCorrect", "QuizWrong", "RoundEnded", "InvitationSent", "InvitationReceived", "RoomOpened", "RoomJoined", "RoomExit", "TableStarted", "PawnPicked", "PawnPlacedSelf", "PawnPlacedOpponent", "WallPlacedSelf", "WallPlacedOpponent", "TableAmbience1", "TableAmbience2", "TableAmbience3", "TableAmbience4", "TableAmbience5", "TableAmbience6", "TableAmbience7", "TableAmbience8", "TableAmbience9", "TableAmbience10", "TableAmbience11", "TableAmbience12", "TableAmbience13", "TableAmbience14", "TableAmbience15", "TableAmbience16", "TableAmbience17", "TableAmbience18", "TableAmbience19", "TableAmbience20"];
export type SoundKey = (typeof SOUND_KEYS)[number];
export type SoundManifestEntry = {
    soundId: SoundKey;
    sha256: string;
    bytes: number;
    uploadedAt: string;
    url: string;
};
export type SoundManifest = {
    updatedAt: string;
    sounds: Partial<Record<SoundKey, SoundManifestEntry>>;
};
export type TableAmbienceSoundKey = Extract<SoundKey, `TableAmbience${number}`>;
export type TableAmbienceDefinition = {
    soundId: TableAmbienceSoundKey;
    name: string;
};
export type TableAmbienceDefinitionsFile = {
    updatedAt: string;
    items: TableAmbienceDefinition[];
};
