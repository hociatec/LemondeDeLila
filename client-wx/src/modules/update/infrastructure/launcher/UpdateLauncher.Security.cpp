#define WIN32_LEAN_AND_MEAN
#define NOMINMAX 1
#include <windows.h>
#include <bcrypt.h>
#include <wincrypt.h>
#include <wintrust.h>
#include <softpub.h>

#include <algorithm>
#include <array>
#include <fstream>
#include <iomanip>
#include <sstream>
#include <stdexcept>
#include <thread>
#include <vector>

#include "UpdateBuildConfig.h"
#include "modules/update/domain/UpdateTrustPolicy.h"
#include "modules/update/infrastructure/launcher/UpdateLauncher.Internal.h"

namespace lila::modules::update::launcher
{
std::string Sha256(const fs::path& path)
{
    BCRYPT_ALG_HANDLE algorithm = nullptr;
    BCRYPT_HASH_HANDLE hash = nullptr;
    DWORD objectLength = 0;
    DWORD copied = 0;
    if (BCryptOpenAlgorithmProvider(&algorithm, BCRYPT_SHA256_ALGORITHM, nullptr, 0) != 0 ||
        BCryptGetProperty(algorithm, BCRYPT_OBJECT_LENGTH,
            reinterpret_cast<PUCHAR>(&objectLength), sizeof(objectLength), &copied, 0) != 0) {
        if (algorithm) BCryptCloseAlgorithmProvider(algorithm, 0);
        throw std::runtime_error("Unable to initialize SHA-256.");
    }
    std::vector<UCHAR> object(objectLength);
    std::array<UCHAR, 32> digest{};
    if (BCryptCreateHash(algorithm, &hash, object.data(), objectLength, nullptr, 0, 0) != 0) {
        BCryptCloseAlgorithmProvider(algorithm, 0);
        throw std::runtime_error("Unable to create SHA-256 hash.");
    }
    std::ifstream input(path, std::ios::binary);
    std::array<char, 64 * 1024> buffer{};
    while (input) {
        input.read(buffer.data(), buffer.size());
        const auto count = input.gcount();
        if (count > 0 && BCryptHashData(hash, reinterpret_cast<PUCHAR>(buffer.data()),
                static_cast<ULONG>(count), 0) != 0) {
            BCryptDestroyHash(hash); BCryptCloseAlgorithmProvider(algorithm, 0);
            throw std::runtime_error("Unable to hash update.");
        }
    }
    const auto status = BCryptFinishHash(
        hash,
        digest.data(),
        static_cast<ULONG>(digest.size()),
        0);
    BCryptDestroyHash(hash);
    BCryptCloseAlgorithmProvider(algorithm, 0);
    if (status != 0) throw std::runtime_error("Unable to finalize SHA-256.");
    static constexpr char Hex[] = "0123456789abcdef";
    std::string result;
    result.reserve(64);
    for (const auto byte : digest) { result.push_back(Hex[byte >> 4]); result.push_back(Hex[byte & 15]); }
    return result;
}

std::string CertificateSha256(PCCERT_CONTEXT certificate)
{
    if (!certificate) return {};
    std::array<BYTE, 32> digest{};
    DWORD size = static_cast<DWORD>(digest.size());
    if (!CryptHashCertificate2(BCRYPT_SHA256_ALGORITHM, 0, nullptr,
            certificate->pbCertEncoded, certificate->cbCertEncoded,
            digest.data(), &size) || size != digest.size()) return {};
    static constexpr char Hex[] = "0123456789abcdef";
    std::string result;
    result.reserve(digest.size() * 2);
    for (const auto byte : digest) {
        result.push_back(Hex[byte >> 4]);
        result.push_back(Hex[byte & 15]);
    }
    return result;
}

std::string FormatTrustFailure(
    LONG status,
    const std::string& actualFingerprint,
    const std::string& expectedFingerprint)
{
    std::ostringstream message;
    message << "trust status 0x" << std::hex << std::setfill('0') << std::setw(8)
        << static_cast<std::uint32_t>(status);
    if (actualFingerprint.empty()) {
        message << ", signer certificate unavailable";
    } else if (expectedFingerprint.empty()) {
        message << ", no pinned signer configured";
    } else if (lila::modules::update::NormalizeSignerSha256(expectedFingerprint).empty()) {
        message << ", configured signer pin is invalid";
    } else {
        message << ", signer pin "
            << (lila::modules::update::SignerSha256Matches(
                    actualFingerprint, expectedFingerprint) ? "matched" : "mismatched");
    }
    return message.str();
}

bool VerifyAuthenticode(const fs::path& executable, std::string* failureReason)
{
    WINTRUST_FILE_INFO file{};
    file.cbStruct = sizeof(file);
    file.pcwszFilePath = executable.c_str();
    WINTRUST_DATA trust{};
    trust.cbStruct = sizeof(trust);
    trust.dwUIChoice = WTD_UI_NONE;
    trust.fdwRevocationChecks = WTD_REVOKE_NONE;
    trust.dwUnionChoice = WTD_CHOICE_FILE;
    trust.pFile = &file;
    trust.dwStateAction = WTD_STATEACTION_VERIFY;
    trust.dwProvFlags = WTD_CACHE_ONLY_URL_RETRIEVAL;
    GUID policy = WINTRUST_ACTION_GENERIC_VERIFY_V2;
    const LONG status = WinVerifyTrust(nullptr, &policy, &trust);

    std::string actualFingerprint;
    if (trust.hWVTStateData) {
        const auto provider = WTHelperProvDataFromStateData(trust.hWVTStateData);
        const auto signer = provider
            ? WTHelperGetProvSignerFromChain(provider, 0, FALSE, 0)
            : nullptr;
        if (signer && signer->csCertChain > 0 && signer->pasCertChain) {
            actualFingerprint = CertificateSha256(signer->pasCertChain[0].pCert);
        }
    }
    trust.dwStateAction = WTD_STATEACTION_CLOSE;
    WinVerifyTrust(nullptr, &policy, &trust);

    const std::string expectedFingerprint =
        lila::modules::update::UpdateBuildConfig::AuthenticodeSignerSha256;
    const bool accepted = lila::modules::update::IsAuthenticodeTrustAccepted(
        status == ERROR_SUCCESS,
        status == CERT_E_UNTRUSTEDROOT || status == CERT_E_CHAINING,
        actualFingerprint, expectedFingerprint);
    if (!accepted && failureReason) {
        *failureReason = FormatTrustFailure(status, actualFingerprint, expectedFingerprint);
    }
    return accepted;
}

bool VerifyAuthenticodeWithRetry(const fs::path& executable, std::string* failureReason)
{
    // Antivirus/indexing can briefly lock a freshly extracted PE and make
    // WinVerifyTrust return CRYPT_E_FILE_ERROR (0x80092003). Verification is
    // never bypassed: a successful cryptographic check remains mandatory.
    for (int attempt = 0; attempt < 8; ++attempt) {
        if (failureReason) failureReason->clear();
        if (VerifyAuthenticode(executable, failureReason)) return true;
        if (attempt < 7) {
            std::this_thread::sleep_for(std::chrono::milliseconds(300 * (attempt + 1)));
        }
    }
    return false;
}

std::vector<BYTE> DecodeBase64(const std::string& value)
{
    DWORD length = 0;
    if (value.empty() || !CryptStringToBinaryA(value.c_str(), 0,
            CRYPT_STRING_BASE64_ANY, nullptr, &length, nullptr, nullptr)) return {};
    std::vector<BYTE> bytes(length);
    if (!CryptStringToBinaryA(value.c_str(), 0, CRYPT_STRING_BASE64_ANY,
            bytes.data(), &length, nullptr, nullptr)) return {};
    bytes.resize(length);
    return bytes;
}

bool VerifyManifestSignature(const Manifest& manifest)
{
    const std::string publicKey = lila::modules::update::UpdateBuildConfig::PublicKeyDerBase64;
    if (publicKey.empty() || manifest.signature.empty()) return AllowUnsignedUpdates();
    auto keyDer = DecodeBase64(publicKey);
    auto signature = DecodeBase64(manifest.signature);
    if (keyDer.empty() || signature.empty()) return false;

    CERT_PUBLIC_KEY_INFO* keyInfo = nullptr;
    DWORD keyInfoSize = 0;
    if (!CryptDecodeObjectEx(X509_ASN_ENCODING, X509_PUBLIC_KEY_INFO,
            keyDer.data(), static_cast<DWORD>(keyDer.size()),
            CRYPT_DECODE_ALLOC_FLAG, nullptr, &keyInfo, &keyInfoSize)) return false;

    HCRYPTPROV provider = 0;
    HCRYPTKEY key = 0;
    HCRYPTHASH hash = 0;
    bool valid = false;
    if (CryptAcquireContextW(&provider, nullptr, nullptr, PROV_RSA_AES,
            CRYPT_VERIFYCONTEXT) &&
        CryptImportPublicKeyInfo(provider, X509_ASN_ENCODING, keyInfo, &key) &&
        CryptCreateHash(provider, CALG_SHA_256, 0, 0, &hash)) {
        const std::string canonical = CanonicalUpdateSignature(manifest);
        if (CryptHashData(hash, reinterpret_cast<const BYTE*>(canonical.data()),
                static_cast<DWORD>(canonical.size()), 0)) {
            // CryptoAPI RSA signatures are little-endian, unlike OpenSSL output.
            std::reverse(signature.begin(), signature.end());
            valid = CryptVerifySignatureA(hash, signature.data(),
                static_cast<DWORD>(signature.size()), key, nullptr, 0) == TRUE;
        }
    }
    if (hash) CryptDestroyHash(hash);
    if (key) CryptDestroyKey(key);
    if (provider) CryptReleaseContext(provider, 0);
    LocalFree(keyInfo);
    return valid;
}

Manifest ParseManifest(const std::string& raw)
{
    Manifest result = ParseUpdateManifest(raw);
    if (!result.mandatoryAt.empty()) static_cast<void>(DeadlineReached(result.mandatoryAt));
    if (!VerifyManifestSignature(result)) {
        throw std::runtime_error("Update manifest signature is invalid.");
    }
    return result;
}

std::string ManifestUrl(const std::string& currentVersion)
{
    std::string url = Environment(L"LILA_UPDATE_MANIFEST_URL");
    if (url.empty()) url = lila::modules::update::UpdateBuildConfig::DefaultManifestUrl;
    if (url.empty()) throw std::runtime_error("Update manifest URL is not configured.");
    url += url.find('?') == std::string::npos ? "?current=" : "&current=";
    url += currentVersion;
    return url;
}
}
