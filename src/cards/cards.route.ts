import { Request, Response, Router } from "express";
import { prisma } from "../../src/database";
import { authentificateToken } from "../auth/auth.middleware";

// Création du router pour les cartes Pokémon
export const cardsRouter = Router();

/**
 * @async
 * @description Récupère la liste exhaustive des cartes Pokémon, triées par leur numéro de Pokédex.
 * @requires JWT - Nécessite un jeton d'authentification valide via le middleware @see {@link authentificateToken}.
 *
 * @param {Request} _req - L'objet de requête (inutilisé ici).
 * @param {Response} res - L'objet de réponse utilisé pour renvoyer les données JSON.
 *
 * @returns {Promise<Response>} Renvoie une réponse HTTP 200 avec le tableau des cartes Pokémon.
 * @throws {Error} Renvoie une erreur HTTP 500 si une erreur se produit.
 *
 * @example
 * GET /api/cards
 * Response: [{ "id": 1, "name": "Bulbasaur", ... }, { "id": 2, "name": "Ivysaur", ... }, ...]
 */
cardsRouter.get(
  "/",
  authentificateToken,
  async (_req: Request, res: Response) => {
    // Récupérer toutes les cartes Pokémon
    try {
      const cards = await prisma.card.findMany({
        // Trier les cartes Pokémon par ordre croissant de numéro Pokédex
        orderBy: {
          pokedexNumber: "asc",
        },
      });

      // Retourner les cartes Pokémon
      return res.status(200).json(cards);
    } catch (error) {
      console.error("Error when getting Pokémon cards:", error);
      return res.status(500).json({ error: "Server error" });
    }
  },
);
