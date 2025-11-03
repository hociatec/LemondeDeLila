<?php

namespace App\Module\User\Controller;

use App\Module\User\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Validator\Validator\ValidatorInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Component\HttpFoundation\Cookie;

class AuthController extends AbstractController
{
    #[Route('/api/login', name: 'api_login', methods: ['POST'])]
    public function login(
        Request $request,
        EntityManagerInterface $em,
        UserPasswordHasherInterface $hasher,
        JWTTokenManagerInterface $jwt
    ): Response {
        $data = json_decode($request->getContent(), true) ?? [];
        $username = (string)($data['username'] ?? '');
        $password = (string)($data['password'] ?? '');
        if ($username === '' || $password === '') {
            return $this->json(['error' => 'Identifiants requis'], 400);
        }
        $repo = $em->getRepository(User::class);
        $user = $repo->findOneBy(['username' => $username]);
        if (!$user) { return $this->json(['error' => 'Utilisateur introuvable'], 401); }
        if (!$hasher->isPasswordValid($user, $password)) { return $this->json(['error' => 'Mot de passe invalide'], 401); }
        $token = $jwt->create($user);
        return $this->json(['token' => $token]);
    }

    #[Route('/api/register', name: 'api_register', methods: ['POST'])]
    public function register(
        Request $request,
        EntityManagerInterface $em,
        UserPasswordHasherInterface $hasher,
        ValidatorInterface $validator
    ): Response {
        $data = json_decode($request->getContent(), true) ?? [];
        $email = $data['email'] ?? '';
        $password = $data['password'] ?? '';
        $username = $data['username'] ?? '';

        $violations = $validator->validate($email, [new Assert\NotBlank(), new Assert\Email()]);
        $violations->addAll($validator->validate($password, [new Assert\NotBlank(), new Assert\Length(min: 6)]));
        $violations->addAll($validator->validate($username, [new Assert\NotBlank(), new Assert\Length(min: 3, max: 100)]));
        if (count($violations) > 0) {
            return $this->json(['errors' => (string) $violations], 400);
        }

        $existing = $em->getRepository(User::class)->findOneBy(['email' => strtolower($email)]);
        if ($existing) {
            return $this->json(['error' => 'Email already registered'], 409);
        }

        $existingUsername = $em->getRepository(User::class)->findOneBy(['username' => $username]);
        if ($existingUsername) {
            return $this->json(['error' => 'Username already taken'], 409);
        }

        $user = (new User())
            ->setEmail($email)
            ->setUsername($username);
        $user->setPassword($hasher->hashPassword($user, $password));

        $em->persist($user);
        $em->flush();

        return $this->json(['message' => 'User registered'], 201);
    }

    #[Route('/api/logout', name: 'api_logout', methods: ['POST'])]
    public function logout(): Response
    {
        $response = $this->json(['message' => 'logged out']);
        $cookie = Cookie::create('BEARER', '', (new \DateTimeImmutable('-1 hour')))
            ->withHttpOnly(true)
            ->withSecure(false)
            ->withPath('/')
            ->withSameSite('lax');
        $response->headers->setCookie($cookie);
        return $response;
    }

    // Login unique (email ou username) → retourne un JWT
}
