# Validation du contenu audio — complément au point 342

L'upload transmet le MIME déclaré au validateur. Les aliases WAV/MP3 usuels
sont acceptés ; un MIME absent ou `application/octet-stream` reste soumis à
l'analyse du contenu. Un MIME explicitement incompatible avec l'extension est
refusé. L'analyse FFprobe exige le conteneur annoncé, un flux audio et une durée
finie positive. Le nom original est transmis explicitement au contrôle, même si
le fichier temporaire porte un autre nom.

Les trois traitements audio limitent leurs entrées aux conteneurs WAV/MP3 et au
protocole fichier. Les playlists et autres conteneurs ne sont donc pas acceptés
simplement parce que leur nom se termine en `.wav`. Le transcodage produit
toujours un WAV vérifié ; la voie de secours WAV utilise le parseur de contenu
existant. Les options d'entrée sont décrites dans la
[documentation officielle FFmpeg](https://ffmpeg.org/ffmpeg-formats.html#Format-Options).

Trois suites / 20 tests passent, dont une vérification avec les binaires réels :
WAV synthétique, encodage MP3, refus des formats renommés, refus d'une playlist,
transcodage de sortie et analyse du volume. Les tests couvrent aussi les types
MIME incompatibles et les sorties de probe incomplètes ou invalides. Journaux
`logs/corrections-sound-media-tests.log`, `logs/corrections-sound-media-typecheck.log`
et `logs/corrections-sound-media-lint.log`.

Le point 342 reste ouvert : les archives WX disposent d'un contrôle de signature,
d'empreinte et d'en-tête, mais leur validation structurelle complète reste à
renforcer. Le point 356 reste également ouvert pour la maîtrise globale des
ressources sous charge, au-delà des délais et limites de sortie déjà appliqués
aux processus audio.
