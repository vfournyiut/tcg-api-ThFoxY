import {
    describe,
    it,
    expect,
} from 'vitest';
import request from 'supertest';
import {prismaMock} from "./vitest.setup";
import {app} from "../src/index";
import bcrypt from "bcryptjs";

// Tests unitaires des endpoints d'authentification
describe('Authentification tests (@see auth.route.ts)', () => {
    describe('POST /auth/sign-up', () => {
        it('should create a new user', async() => {
            // Créer un utilisateur de test
            const newUser = {
                id: 1,
                email: 'test@example.com',
                username: 'test',
                password: 'password123',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Mock de la fonction prisma.user.create
            prismaMock.user.create.mockResolvedValue(newUser);

            // Requête HTTP via supertest
            const response = await request(app)
                .post('/api/auth/sign-up')
                .send({
                    username: 'test',
                    email: 'test@example.com',
                    password: 'password123'
                });

            // Assertions
            expect(response.status).toBe(201);  // Utilisateur créé avec succès
            // Récupérer les clés de l'objet de réponse et vérifier si elles contiennent les propriétés attendues
            expect(Object.keys(response.body)).toEqual(expect.arrayContaining(['message', 'token', 'user']));
            expect(response.body.message).toBe('Inscription réussie');
        });

        it('should throw an 400 error if data is missing', async() => {
            // Requête HTTP via supertest
            const response = await request(app)
                .post('/api/auth/sign-up')
                .send({});

            // Assertions
            expect(response.status).toBe(400);  // Données manquantes
            expect(response.body).toHaveProperty('error');  // Contient la propriété attendue
            expect(response.body.error).toBe('Données manquantes');
        });

        it('should throw an 409 error if the username already exists', async() => {
            // Créer un utilisateur de test avec un username identique
            const newUser = {
                id: 1,
                email: 'test1@example.com',
                username: 'test',
                password: 'password123',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Mock de la fonction prisma.user.findUnique
            prismaMock.user.findUnique.mockResolvedValue(newUser);

            // Requête HTTP via supertest
            const response = await request(app)
                .post('/api/auth/sign-up')
                .send({
                    username: 'test',
                    email: 'test2@example.com',
                    password: 'password123'
                });

            // Assertions
            expect(response.status).toBe(409);  // Utilisateur déjà existant avec ce username
            expect(response.body).toHaveProperty('error');  // Contient la propriété attendue
            expect(response.body.error).toBe("Nom d'utilisateur déjà utilisé");
        });

        it('should throw an 409 error if the email is already used', async() => {
            // Créer un utilisateur de test avec un email identique
            const newUser = {
                id: 1,
                email: 'test@example.com',
                username: 'test1',
                password: 'password123',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Mock de la fonction prisma.user.findUnique
            prismaMock.user.findUnique.mockResolvedValueOnce(null); // Passe l'étape de vérification de l'username
            prismaMock.user.findUnique.mockResolvedValueOnce(newUser);

            // Requête HTTP via supertest
            const response = await request(app)
                .post('/api/auth/sign-up')
                .send({
                    username: 'test2',
                    email: 'test@example.com',
                    password: 'password123'
                });

            // Assertions
            expect(response.status).toBe(409);  // Utilisateur déjà existant avec cet email
            expect(response.body).toHaveProperty('error');  // Contient la propriété attendue
            expect(response.body.error).toBe('Email déjà utilisé');
        });

        it('should throw an 500 error if the server fails', async() => {
            // Mock de la fonction prisma.user.create
            prismaMock.user.findUnique.mockRejectedValue(new Error());

            // Requête HTTP via supertest
            const response = await request(app)
                .post('/api/auth/sign-up')
                .send({
                    username: 'test',
                    email: 'test@example.com',
                    password: 'password123'
                });

            // Assertions
            expect(response.status).toBe(500);  // Erreur interne du serveur
            expect(response.body).toHaveProperty('error');  // Contient la propriété attendue
            expect(response.body.error).toBe('Server error');
        });
    });

    describe('POST /auth/sign-in', () => {
        it('should sign in a user', async() => {
            // Hacher le mot-de-passe
            const hashedPassword = await bcrypt.hash('password123', 10);

            // Créer un utilisateur de test
            const newUser = {
                id: 1,
                email: 'blue@example.com',
                username: 'blue',
                password: hashedPassword,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Mock de la fonction prisma.user.findUnique
            prismaMock.user.findUnique.mockResolvedValue(newUser);

            // Requête HTTP via supertest
            const response = await request(app)
                .post('/api/auth/sign-in')
                .send({
                    email: 'blue@example.com',
                    password: 'password123'
                });

            // Assertions
            expect(response.status).toBe(200);  // Connexion réussie
            // Récupérer les clés de l'objet de réponse et vérifier si elles contiennent les propriétés attendues
            expect(Object.keys(response.body)).toEqual(expect.arrayContaining(['message', 'token', 'user']));
            expect(response.body.message).toBe('Connexion réussie');
        });

        it('should throw an 400 error if data is missing', async() => {
            // Requête HTTP via supertest
            const response = await request(app)
                .post('/api/auth/sign-in')
                .send({});

            // Assertions
            expect(response.status).toBe(400);  // Données manquantes
            expect(response.body).toHaveProperty('error');  // Contient la propriété attendue
            expect(response.body.error).toBe('Données manquantes');
        });

        it('should throw an 401 error if the email is incorrect', async() => {
            // Mock de la fonction prisma.user.findUnique
            prismaMock.user.findUnique.mockResolvedValue(null);

            // Requête HTTP via supertest
            const response = await request(app)
                .post('/api/auth/sign-in')
                .send({
                    email: 'test@example.com',
                    password: 'password123'
                });

            // Assertions
            expect(response.status).toBe(401);  // Identifiants incorrects
            expect(response.body).toHaveProperty('error');  // Contient la propriété attendue
            expect(response.body.error).toBe('Email ou mot de passe incorrect');
        });

        it('should throw an 401 error if the password is incorrect', async() => {
            // Hacher le mot-de-passe
            const hashedPassword = await bcrypt.hash('password123', 10);

            // Créer un utilisateur de test
            const newUser = {
                id: 1,
                email: 'test@example.com',
                username: 'test',
                password: hashedPassword,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Mock de la fonction prisma.user.findUnique
            prismaMock.user.findUnique.mockResolvedValue(newUser);

            // Requête HTTP via supertest
            const response = await request(app)
                .post('/api/auth/sign-in')
                .send({
                    email: 'test@example.com',
                    password: 'anotherpasswordthatwontevenwork'
                });

            // Assertions
            expect(response.status).toBe(401);  // Identifiants incorrects
            expect(response.body).toHaveProperty('error');  // Contient la propriété attendue
            expect(response.body.error).toBe('Email ou mot de passe incorrect');
        });

        it('should throw an 500 error if the server fails', async() => {
            // Mock de la fonction prisma.user.create
            prismaMock.user.findUnique.mockRejectedValue(new Error());

            // Requête HTTP via supertest
            const response = await request(app)
                .post('/api/auth/sign-in')
                .send({
                    email: 'test@example.com',
                    password: 'password123'
                });

            // Assertions
            expect(response.status).toBe(500);  // Erreur interne du serveur
            expect(response.body).toHaveProperty('error');  // Contient la propriété attendue
            expect(response.body.error).toBe('Server error');
        });
    });
});
