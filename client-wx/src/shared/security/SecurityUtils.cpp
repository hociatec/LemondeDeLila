#include "shared/security/SecurityUtils.h"

#include <algorithm>
#include <array>
#include <cstdint>
#include <cstring>
#include <fstream>
#include <vector>

#ifdef _WIN32
#include <windows.h>
#include <wincrypt.h>
#include <aclapi.h>
#else
#include <sys/stat.h>
#include <unistd.h>
#endif

namespace lila::shared::security
{
namespace
{
std::string Base64Encode(const std::uint8_t* data, std::size_t length)
{
    static constexpr char Table[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string result;
    result.reserve(((length + 2) / 3) * 4);

    for (std::size_t i = 0; i < length; i += 3)
    {
        std::uint32_t val = (data[i] << 16);
        if (i + 1 < length) val |= (data[i + 1] << 8);
        if (i + 2 < length) val |= data[i + 2];

        result.push_back(Table[(val >> 18) & 0x3F]);
        result.push_back(Table[(val >> 12) & 0x3F]);
        result.push_back((i + 1 < length) ? Table[(val >> 6) & 0x3F] : '=');
        result.push_back((i + 2 < length) ? Table[val & 0x3F] : '=');
    }

    return result;
}

std::vector<std::uint8_t> Base64Decode(const std::string& input)
{
    std::vector<int> T(256, -1);
    for (int i = 0; i < 64; i++) T["ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"[i]] = i;

    std::vector<std::uint8_t> out;
    int val = 0, valb = -8;
    for (unsigned char c : input)
    {
        if (T[c] == -1) break;
        val = (val << 6) + T[c];
        valb += 6;
        if (valb >= 0)
        {
            out.push_back(static_cast<std::uint8_t>((val >> valb) & 0xFF));
            valb -= 8;
        }
    }
    return out;
}
}

void SecureWipeMemory(void* ptr, std::size_t size)
{
    if (!ptr || size == 0) return;
#ifdef _WIN32
    ::SecureZeroMemory(ptr, size);
#else
    volatile unsigned char* p = static_cast<volatile unsigned char*>(ptr);
    while (size--)
    {
        *p++ = 0;
    }
#endif
}

void SecureWipeString(std::string& str)
{
    if (!str.empty())
    {
        SecureWipeMemory(str.data(), str.size());
        str.clear();
    }
}

std::string ProtectSecret(const std::string& plaintext)
{
    if (plaintext.empty()) return "";

#ifdef _WIN32
    DATA_BLOB inBlob;
    inBlob.cbData = static_cast<DWORD>(plaintext.size());
    inBlob.pbData = reinterpret_cast<BYTE*>(const_cast<char*>(plaintext.data()));

    DATA_BLOB outBlob;
    if (::CryptProtectData(&inBlob, L"LilaSessionToken", nullptr, nullptr, nullptr, CRYPTPROTECT_UI_FORBIDDEN, &outBlob))
    {
        std::string encoded = Base64Encode(outBlob.pbData, outBlob.cbData);
        ::LocalFree(outBlob.pbData);
        return encoded;
    }
#endif

    return plaintext;
}

std::string UnprotectSecret(const std::string& cipherTextOrBase64)
{
    if (cipherTextOrBase64.empty()) return "";

#ifdef _WIN32
    auto decoded = Base64Decode(cipherTextOrBase64);
    if (!decoded.empty())
    {
        DATA_BLOB inBlob;
        inBlob.cbData = static_cast<DWORD>(decoded.size());
        inBlob.pbData = decoded.data();

        DATA_BLOB outBlob;
        if (::CryptUnprotectData(&inBlob, nullptr, nullptr, nullptr, nullptr, CRYPTPROTECT_UI_FORBIDDEN, &outBlob))
        {
            std::string plaintext(reinterpret_cast<char*>(outBlob.pbData), outBlob.cbData);
            ::LocalFree(outBlob.pbData);
            return plaintext;
        }
    }
#endif

    return cipherTextOrBase64;
}

void HardenFilePermissions(const std::string& path)
{
#ifdef _WIN32
    std::wstring wpath(path.begin(), path.end());
    PACL pOldDacl = nullptr;
    PSECURITY_DESCRIPTOR pSD = nullptr;

    if (GetNamedSecurityInfoW(wpath.c_str(), SE_FILE_OBJECT, DACL_SECURITY_INFORMATION, nullptr, nullptr, &pOldDacl, nullptr, &pSD) == ERROR_SUCCESS)
    {
        HANDLE hToken = nullptr;
        if (OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &hToken))
        {
            DWORD len = 0;
            GetTokenInformation(hToken, TokenUser, nullptr, 0, &len);
            if (GetLastError() == ERROR_INSUFFICIENT_BUFFER)
            {
                std::vector<BYTE> buffer(len);
                if (GetTokenInformation(hToken, TokenUser, buffer.data(), len, &len))
                {
                    PTOKEN_USER pTokenUser = reinterpret_cast<PTOKEN_USER>(buffer.data());

                    EXPLICIT_ACCESS_W ea;
                    ZeroMemory(&ea, sizeof(EXPLICIT_ACCESS_W));
                    ea.grfAccessPermissions = GENERIC_ALL;
                    ea.grfAccessMode = SET_ACCESS;
                    ea.grfInheritance = NO_INHERITANCE;
                    ea.Trustee.TrusteeForm = TRUSTEE_IS_SID;
                    ea.Trustee.TrusteeType = TRUSTEE_IS_USER;
                    ea.Trustee.ptstrName = reinterpret_cast<LPWSTR>(pTokenUser->User.Sid);

                    PACL pNewDacl = nullptr;
                    if (SetEntriesInAclW(1, &ea, nullptr, &pNewDacl) == ERROR_SUCCESS)
                    {
                        SetNamedSecurityInfoW(const_cast<LPWSTR>(wpath.c_str()), SE_FILE_OBJECT, DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION, nullptr, nullptr, pNewDacl, nullptr);
                        LocalFree(pNewDacl);
                    }
                }
            }
            CloseHandle(hToken);
        }
        LocalFree(pSD);
    }
#else
    ::chmod(path.c_str(), S_IRUSR | S_IWUSR);
#endif
}

void SecureDeleteFile(const std::string& path)
{
    std::fstream file(path, std::ios::in | std::ios::out | std::ios::binary);
    if (file.is_open())
    {
        file.seekp(0, std::ios::end);
        std::streamsize size = file.tellp();
        if (size > 0)
        {
            file.seekp(0, std::ios::beg);
            std::vector<char> zeros(static_cast<std::size_t>(size), 0);
            file.write(zeros.data(), size);
            file.flush();
        }
        file.close();
    }
    ::remove(path.c_str());
}
}
