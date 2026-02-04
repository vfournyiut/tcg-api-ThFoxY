import {Request, Response, Router} from "express";
import {prisma} from "../../src/database";
import { authenticateToken } from "../auth/auth.middleware";

// TODO: Améliorer la documentation des fonctions
// TODO: Traduire en français les noms pour les erreurs serveur (500+)

// Création du router pour les decks
export const decksRouter = Router();

// POST /api/decks
// Accessible via POST /api/decks
// JWT : S'assure que le token est valide
decksRouter.post("/", authenticateToken, async (req: Request, res: Response) =>
{
    // Destructuration : extrait les champs name et cards de la requête POST pour en faire des variables distinctes
    // TODO : Créer un type pour req.body
    const {name, cards} = req.body;

    // Créer le deck contenant 10 cartes aléatoires exactement
    try {
        // 0. Vérifier que tous les champs sont remplis (notamment s'assurer qu'il y a bien 10 cartes)
        if (!name || !cards || cards.length !== 10) {
            return res.status(400).json({error: "Données manquantes"});
        };

        // 1. Vérifier que toutes les IDs de cartes sont valides/existants
        const existingCards = await prisma.card.findMany({
            where: {
                id: {
                    in: cards,
                },
            },
        });

        // Vérifier la taille puisque findMany renvoie un tableau
        if (existingCards.length !== 10) {
            return res.status(400).json({error: "IDs de cartes Pokémon invalides/inexistants"});
        };

        // 3. Création du deck
        const newDeck = await prisma.deck.create({
            data: {
                name: name,
                userId: req.user!.userId,   // '!' signifie au compilateur TypeScript que req.user n'est pas null (puisqu'on vérifie avec authenticateToken s'il y a des erreurs)
                cards: {
                    createMany: {
                        // Map() permet d'étaler les 10 cartes en 10 objets distincts auxquels on associe un ID
                        data: cards.map((cardId: number) => ({cardId})),
                    },
                },
            },
        });

        // 4. Retourner le deck créé
        return res.status(201).json(newDeck);
    } catch (error) {
        console.error("Error when creating deck:", error);
        return res.status(500).json({error: "Server error"});
    };
});

// GET /api/decks/mine
// Accessible via GET /api/decks/mine
// JWT : S'assure que le token est valide
decksRouter.get("/mine", authenticateToken, async (req: Request, res: Response) =>
{
    // Récupérer tous les Decks de l'utilisateur authentifié
    try {
        const decks = await prisma.deck.findMany({
            where: {
                userId: req.user!.userId,
            }
        });

        // Retourner les Decks de l'utilisateur
        return res.status(200).json(decks);
    } catch (error) {
        console.error("Error when getting user's decks:", error);
        return res.status(500).json({error: "Server error"});
    };
});

// GET /api/decks/:id
// Accessible via GET /api/decks/:id
// JWT : S'assure que le token est valide
decksRouter.get("/:id", authenticateToken, async (req: Request, res: Response) =>
{
    // Récupérer l'ID en paramètre
    const deckId = Number(req.params.id);

    // Récupérer le Deck par son ID
    try {
        // 1. Vérifier si le deck existe
        const existingDeck = await prisma.deck.findUnique({
            where: {
                id: deckId,
            }
        });

        if (!existingDeck) {
            return res.status(404).json({error: "Deck introuvable"});
        };

        // 2. Vérifier si le deck appartient à l'utilisateur authentifié
        const deckById = await prisma.deck.findUnique({
            where: {
                id: deckId,
                userId: req.user!.userId,
            },
            // Inclure les cartes du Deck (Prisma s'occupe de lier la jointure DeckCard)
            include: {
                cards: true,
            }
        });

        if (!deckById) {
            return res.status(403).json({error: "Deck inaccesible"});
        };

        // 3. Retourner le Deck
        return res.status(200).json(deckById);
    } catch (error) {
        console.error("Error when getting deck by ID:", error);
        return res.status(500).json({error: "Server error"});
    };
});

// PATCH /api/decks/:id
// Accessible via PATCH /api/decks/:id
// JWT : S'assure que le token est valide
decksRouter.patch("/:id", authenticateToken, async (req: Request, res: Response) =>
{
    // Récupérer l'ID en paramètre
    const deckId = Number(req.params.id);

    // Destructuration : extrait les champs name et cards de la requête PATCH pour en faire des variables distinctes
    // TODO : Créer un type pour req.body
    const {name, cards} = req.body;

    // Récupérer le Deck par son ID
    try {
        // 0. Vérifier que tous les champs sont remplis (notamment s'assurer qu'il y a bien 10 cartes)
        if (!name || !cards || cards.length !== 10) {
            return res.status(400).json({error: "Données manquantes"});
        };

        // 1. Vérifier que toutes les IDs de cartes sont valides/existants
        const existingCards = await prisma.card.findMany({
            where: {
                id: {
                    in: cards,
                },
            },
        });

        // Vérifier la taille puisque findMany renvoie un tableau
        if (existingCards.length !== 10) {
            return res.status(400).json({error: "IDs de cartes Pokémon invalides/inexistants"});
        };

        // 2. Vérifier si le deck existe
        const existingDeck = await prisma.deck.findUnique({
            where: {
                id: deckId,
            }
        });

        if (!existingDeck) {
            return res.status(404).json({error: "Deck introuvable"});
        };

        // 3. Vérifier si le deck appartient à l'utilisateur authentifié
        const deckById = await prisma.deck.findUnique({
            where: {
                id: deckId,
                userId: req.user!.userId,
            }
        });

        if (!deckById) {
            return res.status(403).json({error: "Deck inaccesible"});
        };

        // 4. Mettre à jour le Deck
        const updatedDeck = await prisma.deck.update({
            where: {
                id: deckId,
            },
            data: {
                name,
                cards: {
                    // Suppression des cartes existantes
                    deleteMany: {},
                    // Ajout des nouvelles cartes
                    createMany: {
                        // Map() permet d'étaler les 10 cartes en 10 objets distincts auxquels on associe un ID
                        data: cards.map((cardId: number) => ({cardId})),
                    },
                },
            },
            // Inclure les cartes du Deck (Prisma s'occupe de lier la jointure DeckCard)
            include: {
                cards: true,
            }
        })

        // 5. Retourner le Deck mis à jour
        return res.status(200).json(updatedDeck);
    } catch (error) {
        console.error("Error when updating deck by ID:", error);
        return res.status(500).json({error: "Server error"});
    };
});
