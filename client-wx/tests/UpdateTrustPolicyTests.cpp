#include <iostream>
#include <stdexcept>
#include <string>

#include "modules/update/domain/UpdateTrustPolicy.h"

namespace
{
void Expect(bool condition, const char* message)
{
    if (!condition) throw std::runtime_error(message);
}

void TestAuthenticodeSignerPinPolicy()
{
    using namespace lila::modules::update;
    const std::string fingerprint(64, 'a');
    std::string formattedFingerprint;
    for (std::size_t index = 0; index < fingerprint.size(); ++index) {
        if (index > 0 && index % 2 == 0) formattedFingerprint.push_back(':');
        formattedFingerprint.push_back('A');
    }

    Expect(IsAuthenticodeTrustAccepted(true, false, fingerprint, ""),
        "Une signature approuvee doit rester acceptee sans epinglage configure");
    Expect(!IsAuthenticodeTrustAccepted(false, true, fingerprint, ""),
        "Une racine non approuvee ne doit jamais etre acceptee sans epinglage");
    Expect(IsAuthenticodeTrustAccepted(false, true, fingerprint, formattedFingerprint),
        "Le certificat auto-signe epingle doit etre accepte");
    Expect(!IsAuthenticodeTrustAccepted(true, false, std::string(64, 'b'), fingerprint),
        "Une chaine approuvee ne doit pas contourner un epinglage different");
    Expect(!IsAuthenticodeTrustAccepted(false, true, std::string(64, 'b'), fingerprint),
        "Un autre certificat auto-signe doit etre rejete");
    Expect(!IsAuthenticodeTrustAccepted(false, false, fingerprint, fingerprint),
        "Une signature alteree doit etre rejetee meme si le certificat correspond");
    Expect(!IsAuthenticodeTrustAccepted(
            true, false, fingerprint, "empreinte-invalide"),
        "Un epinglage configure mais invalide doit echouer de facon fermee");
}
}

int main()
{
    try {
        TestAuthenticodeSignerPinPolicy();
        std::cout << "Update trust policy tests passed.\n";
        return 0;
    } catch (const std::exception& error) {
        std::cerr << "Update trust policy test failed: " << error.what() << '\n';
        return 1;
    }
}
