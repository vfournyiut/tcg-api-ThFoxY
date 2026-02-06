import { Request, Response, Router } from 'express';
import { prisma } from '../../src/database';
import { authenticateToken } from '../auth/auth.middleware';

// Création du router pour les cartes Pokémon
export const cardsRouter = Router();

// GET /api/cards
// Accessible via GET /api/cards
// JWT : S'assure que le token est valide (@see documentation Get All Cards.bru)
cardsRouter.get(
    '/',
    authenticateToken,
    async (_req: Request, res: Response) => {
        // Récupérer toutes les cartes Pokémon
        try {
            const cards = await prisma.card.findMany({
                // Trier les cartes Pokémon par ordre croissant de numéro Pokédex
                orderBy: {
                    pokedexNumber: 'asc',
                },
            });

            // Retourner les cartes Pokémon
            return res.status(200).json(cards);
        } catch (error) {
            console.error('Error when getting Pokémon cards:', error);
            return res.status(500).json({ error: 'Server error' });
        }
    },
);
