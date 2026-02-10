import { describe, it, expect } from "vitest";
import request from "supertest";
import { prismaMock, authentificateTokenMock } from "./vitest.setup";
import { app } from "../src/index";
import { PokemonType } from "../src/generated/prisma/enums";

// Fonction utilitaire pour normaliser les dates de création et de mise à jour
// L'API utilise du JSON (strings) mais la base de données utilise des objets Date
function normalizeDeck(deck: any) {
  return {
    ...deck,
    createdAt: new Date(deck.createdAt).toISOString(),
    updatedAt: new Date(deck.updatedAt).toISOString(),
  };
}

// Tests unitaires des endpoints des decks
describe("Deck tests (@see decks.route.ts)", () => {
  // Créer des données de test (généralisées et réutilisables)
  const mockCardsIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // Tableau de 10 IDs de cartes Pokémon valides

  const mockDeck = {
    id: 1,
    name: "My Test Deck",
    userId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }; // Objet Deck de base (sans les cartes)

  const mockDeckWithCards = {
    ...mockDeck,
    cards: mockCardsIds.map((cardId) => ({
      id: cardId,
      deckId: 1,
      cardId: cardId,
    })),
  }; // Objet Deck avec ses cartes

  describe("POST /api/decks", () => {
    it("should create a new deck with 10 cards", async () => {
      // Mock de la fonction prisma.card.findMany avec un tableau de 10 cartes
      // Array(10).fill permet de remplir un tableau de 10 valeurs identiques (ici, un objet Card)
      prismaMock.card.findMany.mockResolvedValue(
        new Array(10).fill({
          id: 1,
          name: "Bulbasaur",
          hp: 45,
          attack: 49,
          type: PokemonType.Grass,
          pokedexNumber: 1,
          imgUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );

      // Mock de la fonction prisma.deck.create
      prismaMock.deck.create.mockResolvedValue(mockDeck);

      // Requête HTTP via supertest
      const response = await request(app).post("/api/decks").send({
        name: "My Test Deck",
        cards: mockCardsIds,
      });

      // Assertions
      expect(response.status).toBe(201); // Deck créé avec succès
      expect(normalizeDeck(response.body)).toEqual(normalizeDeck(mockDeck)); // Contient le deck attendu
    });

    it("should throw an 400 error if name is missing", async () => {
      // Requête HTTP via supertest
      const response = await request(app).post("/api/decks").send({
        cards: mockCardsIds, // Ne contient que le tableau de cartes, pas le nom
      });

      // Assertions
      expect(response.status).toBe(400); // Données manquantes
      expect(response.body).toHaveProperty("error"); // Contient la propriété attendue
      expect(response.body.error).toBe("Données manquantes");
    });

    it("should throw an 400 error if cards are missing", async () => {
      // Requête HTTP via supertest
      const response = await request(app).post("/api/decks").send({
        name: "My Test Deck", // Ne contient que le nom, pas le tableau de cartes
      });

      // Assertions
      expect(response.status).toBe(400); // Données manquantes
      expect(response.body).toHaveProperty("error"); // Contient la propriété attendue
      expect(response.body.error).toBe("Données manquantes");
    });

    it("should throw an 400 error if cards length is not 10", async () => {
      // Requête HTTP via supertest
      const response = await request(app)
        .post("/api/decks")
        .send({
          name: "My Test Deck",
          cards: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        });

      // Assertions
      expect(response.status).toBe(400); // Données manquantes
      expect(response.body).toHaveProperty("error"); // Contient la propriété attendue
      expect(response.body.error).toBe("Données manquantes");
    });

    it("should throw an 400 error if card IDs do not exist", async () => {
      // Mock de la fonction prisma.card.findMany avec un tableau de 9 cartes seulement
      prismaMock.card.findMany.mockResolvedValue(
        new Array(9).fill({
          id: 1,
          name: "Bulbasaur",
          hp: 45,
          attack: 49,
          type: PokemonType.Grass,
          pokedexNumber: 1,
          imgUrl: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      );

      // Requête HTTP via supertest
      const response = await request(app)
        .post("/api/decks")
        .send({
          name: "My Test Deck",
          cards: [1, 2, 3, 4, 5, 6, 7, 8, 9, -1], // L'ID -1 n'existe pas
        });

      // Assertions
      expect(response.status).toBe(400); // IDs incorrects
      expect(response.body).toHaveProperty("error"); // Contient la propriété attendue
      expect(response.body.error).toBe(
        "IDs de cartes Pokémon invalides/inexistants",
      );
    });

    it("should throw an 401 error when authentication fails", async () => {
      // Mock de la fonction authentificateToken
      authentificateTokenMock.mockImplementationOnce((_req, res, _next) => {
        return res.status(401).json({ error: "Token invalide ou expiré" });
      });

      // Requête HTTP via supertest
      const response = await request(app).post("/api/decks").send({
        name: "My Test Deck",
        cards: mockCardsIds,
      });

      // Assertions
      expect(response.status).toBe(401); // Token JWT invalide
      expect(response.body).toHaveProperty("error"); // Contient la propriété attendue
      expect(response.body.error).toBe("Token invalide ou expiré");
    });

    it("should throw an 500 error if the server fails", async () => {
      // Mock de la fonction prisma.card.findMany
      prismaMock.card.findMany.mockRejectedValue(new Error());

      // Requête HTTP via supertest
      const response = await request(app).post("/api/decks").send({
        name: "My Test Deck",
        cards: mockCardsIds,
      });

      // Assertions
      expect(response.status).toBe(500); // Erreur interne du serveur
      expect(response.body).toHaveProperty("error"); // Contient la propriété attendue
      expect(response.body.error).toBe("Server error");
    });
  });

  describe("GET /api/decks/mine", () => {
    it("should return all decks of authenticated user", async () => {
      // Mock de la fonction prisma.deck.findMany avec un seul deck
      prismaMock.deck.findMany.mockResolvedValue([mockDeck]);

      // Requête HTTP via supertest
      const response = await request(app).get("/api/decks/mine");

      // Assertions
      expect(response.status).toBe(200); // Deck récupéré avec succès
      expect(response.body.map(normalizeDeck)).toEqual(
        [mockDeck].map(normalizeDeck),
      ); // Contient le deck attendu
      expect(response.body[0].userId).toBe(1); // Le deck appartient à l'utilisateur 1
    });

    it("should return an empty array if user has no decks", async () => {
      // Mock de la fonction prisma.deck.findMany avec aucun deck
      prismaMock.deck.findMany.mockResolvedValue(Array());

      // Requête HTTP via supertest
      const response = await request(app).get("/api/decks/mine");

      // Assertions
      expect(response.status).toBe(200); // Deck vide récupéré avec succès
      expect(response.body).toEqual([]); // Contient un tableau vide
    });

    it("should throw an 401 error when authentication fails", async () => {
      // Mock de la fonction authentificateToken
      authentificateTokenMock.mockImplementationOnce((_req, res, _next) => {
        return res.status(401).json({ error: "Token invalide ou expiré" });
      });

      // Requête HTTP via supertest
      const response = await request(app).get("/api/decks/mine");

      // Assertions
      expect(response.status).toBe(401); // Token JWT invalide
      expect(response.body).toHaveProperty("error"); // Contient la propriété attendue
      expect(response.body.error).toBe("Token invalide ou expiré");
    });

    it("should throw an 500 error if the server fails", async () => {
      // Mock de la fonction prisma.deck.findMany
      prismaMock.deck.findMany.mockRejectedValue(new Error());

      // Requête HTTP via supertest
      const response = await request(app).get("/api/decks/mine");

      // Assertions
      expect(response.status).toBe(500); // Erreur interne du serveur
      expect(response.body).toHaveProperty("error"); // Contient la propriété attendue
      expect(response.body.error).toBe("Server error");
    });
  });

  describe("GET /api/decks/:id", () => {
    it("should return a specific deck if owned by user", async () => {
      // Mock de la fonction prisma.deck.findUnique
      prismaMock.deck.findUnique.mockResolvedValueOnce(mockDeck); // Vérification d'existence du deck (peu importe l'utilisateur)
      prismaMock.deck.findUnique.mockResolvedValueOnce(mockDeckWithCards); // Vérification que le deck appartient à l'utilisateur authentifié et récupérer les cartes

      // Requête HTTP via supertest
      const response = await request(app).get("/api/decks/1");

      // Assertions
      expect(response.status).toBe(200); // Deck renvoyé avec succès
      // Le deck est normalisé et contient les cartes
      expect({
        ...normalizeDeck(response.body),
        cards: response.body.cards,
      }).toEqual({
        ...normalizeDeck(mockDeckWithCards),
        cards: mockDeckWithCards.cards,
      }); // Contient le deck attendu
      expect(response.body).toHaveProperty("cards"); // Contient la propriété attendue
    });

    it("should throw an 404 error if deck does not exist", async () => {
      // Mock de la fonction prisma.deck.findUnique
      prismaMock.deck.findUnique.mockResolvedValue(null);

      // Requête HTTP via supertest
      const response = await request(app).get("/api/decks/1");

      // Assertions
      expect(response.status).toBe(404); // Deck introuvable
      expect(response.body).toHaveProperty("error"); // Contient la propriété attendue
      expect(response.body.error).toBe("Deck introuvable");
    });

    it("should throw an 403 error if deck belongs to another user", async () => {
      // Mock de la fonction prisma.deck.findUnique
      prismaMock.deck.findUnique.mockResolvedValueOnce(mockDeck); // Vérification d'existence du deck
      prismaMock.deck.findUnique.mockResolvedValueOnce(null); // Vérification que le deck appartient à un autre utilisateur

      // Requête HTTP via supertest
      const response = await request(app).get("/api/decks/1");

      // Assertions
      expect(response.status).toBe(403); // Deck inaccessible
      expect(response.body).toHaveProperty("error"); // Contient la propriété attendue
      expect(response.body.error).toBe("Deck inaccessible");
    });

    it("should throw an 401 error when authentication fails", async () => {
      // Mock de la fonction authentificateToken
      authentificateTokenMock.mockImplementationOnce((_req, res, _next) => {
        return res.status(401).json({ error: "Token invalide ou expiré" });
      });

      // Requête HTTP via supertest
      const response = await request(app).get("/api/decks/1");

      // Assertions
      expect(response.status).toBe(401); // Token JWT invalide
      expect(response.body).toHaveProperty("error"); // Contient la propriété attendue
      expect(response.body.error).toBe("Token invalide ou expiré");
    });

    it("should throw an 500 error if the server fails", async () => {
      // Mock de la fonction prisma.deck.findUnique
      prismaMock.deck.findUnique.mockRejectedValue(new Error());

      // Requête HTTP via supertest
      const response = await request(app).get("/api/decks/1");

      // Assertions
      expect(response.status).toBe(500); // Erreur interne du serveur
      expect(response.body).toHaveProperty("error"); // Contient la propriété attendue
      expect(response.body.error).toBe("Server error");
    });
  });

  describe("PATCH /api/decks/:id", () => {
    it("should update an existing deck", async () => {
      // Mock de la fonction prisma.card.findMany avec un tableau de 10 cartes
      // Array(10).fill permet de remplir un tableau de 10 valeurs identiques (ici, un objet Card)
      prismaMock.card.findMany.mockResolvedValue(
        new Array(10).fill({
          id: 1,
          name: "Bulbasaur",
          hp: 45,
          attack: 49,
          type: PokemonType.Grass,
          pokedexNumber: 1,
          imgUrl: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      );

      // Mock de la fonction prisma.deck.findUnique
      prismaMock.deck.findUnique.mockResolvedValueOnce(mockDeck); // Vérification d'existence du deck (peu importe l'utilisteur)
      prismaMock.deck.findUnique.mockResolvedValueOnce(mockDeck); // Vérification que le deck appartient à l'utilisateur authentifié

      // Mock de la fonction prisma.deck.update
      prismaMock.deck.update.mockResolvedValue({
        ...mockDeckWithCards, // Spread operator pour copier toutes les propriétés du mockDeckWithCards
        name: "My Updated Test Deck",
      });

      // Requête HTTP via supertest
      const response = await request(app)
        .patch("/api/decks/1")
        .send({ name: "My Updated Test Deck", cards: mockCardsIds });

      // Assertions
      expect(response.status).toBe(200); // Mise à jour succès
      expect(response.body.name).toBe("My Updated Test Deck"); // Contient la propriété attendue
      expect(response.body).toHaveProperty("cards");
    });

    it("should throw an 400 error if name is missing", async () => {
      // Requête HTTP via supertest
      const response = await request(app)
        .patch("/api/decks/1")
        .send({ cards: mockCardsIds }); // Ne contient que le tableau de cartes, pas le nom

      // Assertions
      expect(response.status).toBe(400); // Données manquantes
      expect(response.body).toHaveProperty("error"); // Contient la propriété attendue
      expect(response.body.error).toBe("Données manquantes");
    });

    it("should throw an 400 error if cards are missing", async () => {
      // Requête HTTP via supertest
      const response = await request(app)
        .patch("/api/decks/1")
        .send({ name: "My Updated Test Deck" }); // Ne contient que le nom, pas le tableau de cartes

      // Assertions
      expect(response.status).toBe(400); // Données manquantes
      expect(response.body).toHaveProperty("error"); // Contient la propriété attendue
      expect(response.body.error).toBe("Données manquantes");
    });

    it("should throw an 400 error if cards length is not 10", async () => {
      // Requête HTTP via supertest
      const response = await request(app)
        .patch("/api/decks/1")
        .send({
          name: "My Updated Test Deck",
          cards: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        });

      // Assertions
      expect(response.status).toBe(400); // Données manquantes
      expect(response.body).toHaveProperty("error"); // Contient la propriété attendue
      expect(response.body.error).toBe("Données manquantes");
    });

    it("should throw an 400 error if card IDs do not exist", async () => {
      // Mock de la fonction prisma.card.findMany avec un tableau de 9 cartes seulement
      prismaMock.card.findMany.mockResolvedValue(
        new Array(9).fill({
          id: 1,
          name: "Bulbasaur",
          hp: 45,
          attack: 49,
          type: PokemonType.Grass,
          pokedexNumber: 1,
          imgUrl: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      );

      // Requête HTTP via supertest
      const response = await request(app)
        .patch("/api/decks/1")
        .send({
          name: "My Updated Test Deck",
          cards: [1, 2, 3, 4, 5, 6, 7, 8, 9, -1],
        });

      // Assertions
      expect(response.status).toBe(400); // IDs incorrects
      expect(response.body).toHaveProperty("error"); // Contient la propriété attendue
      expect(response.body.error).toBe(
        "IDs de cartes Pokémon invalides/inexistants",
      );
    });

    it("should throw an 404 error if deck does not exist", async () => {
      // Mock de la fonction prisma.card.findMany avec un tableau de 10 cartes
      prismaMock.card.findMany.mockResolvedValue(
        new Array(10).fill({
          id: 1,
          name: "Bulbasaur",
          hp: 45,
          attack: 49,
          type: PokemonType.Grass,
          pokedexNumber: 1,
          imgUrl: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      );
      // Mock de la fonction prisma.deck.findUnique
      prismaMock.deck.findUnique.mockResolvedValue(null);

      // Requête HTTP via supertest
      const response = await request(app)
        .patch("/api/decks/1")
        .send({ name: "My Updated Test Deck", cards: mockCardsIds });

      // Assertions
      expect(response.status).toBe(404); // Deck introuvable
      expect(response.body).toHaveProperty("error"); // Contient la propriété attendue
      expect(response.body.error).toBe("Deck introuvable");
    });

    it("should throw an 403 error if deck belongs to another user", async () => {
      // Mock de la fonction prisma.card.findMany
      prismaMock.card.findMany.mockResolvedValue(
        new Array(10).fill({
          id: 1,
          name: "Bulbasaur",
          hp: 45,
          attack: 49,
          type: PokemonType.Grass,
          pokedexNumber: 1,
          imgUrl: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      );
      // Mock de la fonction prisma.deck.findUnique
      prismaMock.deck.findUnique.mockResolvedValueOnce(mockDeck); // Vérification d'existence du deck
      prismaMock.deck.findUnique.mockResolvedValueOnce(null); // Vérification que le deck appartient à un autre utilisateur

      // Requête HTTP via supertest
      const response = await request(app)
        .patch("/api/decks/1")
        .send({ name: "My Updated Test Deck", cards: mockCardsIds });

      // Assertions
      expect(response.status).toBe(403); // Deck inaccessible
      expect(response.body).toHaveProperty("error"); // Contient la propriété attendue
      expect(response.body.error).toBe("Deck inaccessible");
    });

    it("should throw an 401 error when authentication fails", async () => {
      // Mock de la fonction authentificateToken
      authentificateTokenMock.mockImplementationOnce((_req, res, _next) => {
        return res.status(401).json({ error: "Token invalide ou expiré" });
      });

      // Requête HTTP via supertest
      const response = await request(app)
        .patch("/api/decks/1")
        .send({ name: "My Updated Test Deck", cards: mockCardsIds });

      // Assertions
      expect(response.status).toBe(401); // Token JWT invalide
      expect(response.body).toHaveProperty("error"); // Contient la propriété attendue
      expect(response.body.error).toBe("Token invalide ou expiré");
    });

    it("should throw an 500 error if the server fails", async () => {
      // Mock de la fonction prisma.card.findMany
      prismaMock.card.findMany.mockRejectedValue(new Error());

      // Requête HTTP via supertest
      const response = await request(app)
        .patch("/api/decks/1")
        .send({ name: "My Updated Test Deck", cards: mockCardsIds });

      // Assertions
      expect(response.status).toBe(500); // Erreur interne du serveur
      expect(response.body).toHaveProperty("error"); // Contient la propriété attendue
      expect(response.body.error).toBe("Server error");
    });
  });

  describe("DELETE /api/decks/:id", () => {
    it("should delete an existing deck", async () => {
      /**
       * Test de suppression d'un deck
       *
       * La route supprime d'abord les relations dans la table de jonction DeckCard
       * puis supprime le deck lui-même
       *
       * Étapes de mock :
       * 1. Vérification de l'existence du deck (findUnique)
       * 2. Vérification de l'ownership (findUnique)
       * 3. Suppression des relations DeckCard (deleteMany)
       * 4. Suppression du deck (delete)
       */
      // Mock de la fonction prisma.deck.findUnique
      prismaMock.deck.findUnique.mockResolvedValueOnce(mockDeck); // Vérification d'existence du deck (peu importe l'utilisateur)
      prismaMock.deck.findUnique.mockResolvedValueOnce(mockDeck); // Vérification que le deck appartient à l'utilisateur authentifié et récupérer les cartes

      // Mock de la fonction prisma.deckCard.deleteMany
      prismaMock.deckCard.deleteMany.mockResolvedValue({ count: 10 }); // Suppression des relations DeckCard

      // Mock de la fonction prisma.deck.delete
      prismaMock.deck.delete.mockResolvedValue(mockDeck); // Suppression du deck

      // Requête HTTP via supertest
      const response = await request(app).delete("/api/decks/1");

      // Assertions
      expect(response.status).toBe(200); // Suppression réussie
      expect(response.body).toHaveProperty("message"); // Contient la propriété attendue
      expect(response.body.message).toBe("Suppression réussie");
    });

    it("should throw an 404 error if deck does not exist", async () => {
      // Mock de la fonction prisma.deck.findUnique
      prismaMock.deck.findUnique.mockResolvedValue(null);

      // Requête HTTP via supertest
      const response = await request(app).delete("/api/decks/1");

      // Assertions
      expect(response.status).toBe(404); // Deck introuvable
      expect(response.body).toHaveProperty("error"); // Contient la propriété attendue
      expect(response.body.error).toBe("Deck introuvable");
    });

    it("should throw an 403 error if deck belongs to another user", async () => {
      // Mock de la fonction prisma.deck.findUnique
      prismaMock.deck.findUnique.mockResolvedValueOnce(mockDeck); // Vérification d'existence du deck
      prismaMock.deck.findUnique.mockResolvedValueOnce(null); // Vérification que le deck appartient à un autre utilisateur

      // Requête HTTP via supertest
      const response = await request(app).delete("/api/decks/1");

      // Assertions
      expect(response.status).toBe(403); // Deck inaccessible
      expect(response.body).toHaveProperty("error"); // Contient la propriété attendue
      expect(response.body.error).toBe("Deck inaccessible");
    });

    it("should throw an 401 error when authentication fails", async () => {
      // Mock de la fonction authentificateToken
      authentificateTokenMock.mockImplementationOnce((_req, res, _next) => {
        return res.status(401).json({ error: "Token invalide ou expiré" });
      });

      // Requête HTTP via supertest
      const response = await request(app).delete("/api/decks/1");

      // Assertions
      expect(response.status).toBe(401); // Token JWT invalide
      expect(response.body).toHaveProperty("error"); // Contient la propriété attendue
      expect(response.body.error).toBe("Token invalide ou expiré");
    });

    it("should throw an 500 error if the server fails", async () => {
      // Mock de la fonction prisma.deck.findUnique
      prismaMock.deck.findUnique.mockRejectedValue(new Error());

      // Requête HTTP via supertest
      const response = await request(app).delete("/api/decks/1");

      // Assertions
      expect(response.status).toBe(500); // Erreur interne du serveur
      expect(response.body).toHaveProperty("error"); // Contient la propriété attendue
      expect(response.body.error).toBe("Server error");
    });
  });
});
