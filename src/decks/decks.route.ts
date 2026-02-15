import { Request, Response, Router } from 'express'

import { prisma } from '../../src/database'
import { authentificateToken } from '../auth/auth.middleware'

// Création du router pour les decks
export const decksRouter = Router()

/**
 * @async
 * @description Crée un nouveau deck pour l'utilisateur authentifié.
 * Le deck doit contenir exactement 10 cartes Pokémon valides.
 * @requires JWT - Nécessite un jeton d'authentification valide via le middleware @see {@link authentificateToken}.
 *
 * @param {Request} req - L'objet de requête contenant `name` (string) et `cards` (array d'IDs de cartes Pokémon).
 * @param {Response} res - L'objet de réponse utilisé pour renvoyer les données JSON.
 *
 * @returns {Promise<Response>} Renvoie une réponse HTTP 201 si le deck a bien été créé.
 * @throws {400} Renvoie une erreur HTTP 400 si les champs obligatoires sont manquants ou si le nombre de cartes Pokémon est incorrect.
 * @throws {401} Renvoie une erreur HTTP 401 si le jeton d'authentification est manquant ou invalide.
 * @throws {500} Renvoie une erreur HTTP 500 si une erreur se produit.
 */
decksRouter.post(
  '/',
  authentificateToken,
  async (req: Request, res: Response) => {
    // Destructuration : extrait les champs name et cards de la requête POST pour en faire des variables distinctes
    // TODO : Créer un type pour req.body
    const { name, cards } = req.body

    // Créer le deck contenant 10 cartes aléatoires exactement
    try {
      // 0. Vérifier que tous les champs sont remplis (notamment s'assurer qu'il y a bien 10 cartes)
      if (!name || !cards || cards.length !== 10) {
        return res.status(400).json({ error: 'Données manquantes' })
      }

      // 1. Vérifier que toutes les IDs de cartes sont valides/existants
      const existingCards = await prisma.card.findMany({
        where: {
          id: {
            in: cards,
          },
        },
      })

      // Vérifier la taille puisque findMany renvoie un tableau
      if (existingCards.length !== 10) {
        return res
          .status(400)
          .json({ error: 'IDs de cartes Pokémon invalides/inexistants' })
      }

      // 3. Création du deck
      const newDeck = await prisma.deck.create({
        data: {
          name: name,
          userId: req.user!.userId, // '!' signifie au compilateur TypeScript que req.user n'est pas null (puisqu'on vérifie avec authentificateToken s'il y a des erreurs)
          cards: {
            createMany: {
              // Map() permet d'étaler les 10 cartes en 10 objets distincts auxquels on associe un ID
              data: cards.map((cardId: number) => ({ cardId })),
            },
          },
        },
      })

      // 4. Retourner le deck créé
      return res.status(201).json(newDeck)
    } catch (error) {
      console.error('Error when creating deck:', error)
      return res.status(500).json({ error: 'Server error' })
    }
  },
)

/**
 * @async
 * @description Récupère tous les decks appartenant à l'utilisateur authentifié.
 * @requires JWT - Nécessite un jeton d'authentification valide via le middleware @see {@link authentificateToken}.
 *
 * @param {Request} req - L'objet de requête contenant les infos de l'utilisateur authentifié.
 * @param {Response} res - L'objet de réponse utilisé pour renvoyer les données JSON.
 *
 * @returns {Promise<Response>} Renvoie une réponse HTTP 200 contenant la liste des decks de l'utilisateur authentifié.
 * @throws {500} Renvoie une erreur HTTP 500 si une erreur se produit.
 */
decksRouter.get(
  '/mine',
  authentificateToken,
  async (req: Request, res: Response) => {
    // Récupérer tous les Decks de l'utilisateur authentifié
    try {
      const decks = await prisma.deck.findMany({
        where: {
          userId: req.user!.userId,
        },
      })

      // Retourner les Decks de l'utilisateur
      return res.status(200).json(decks)
    } catch (error) {
      console.error("Error when getting user's decks:", error)
      return res.status(500).json({ error: 'Server error' })
    }
  },
)

/**
 * @async
 * @description Récupère les détails d'un deck spécifique par ID.
 * Le deck doit exister et appartir à l'utilisateur authentifié.
 * @requires JWT - Nécessite un jeton d'authentification valide via le middleware @see {@link authentificateToken}.
 *
 * @param {Request} req - L'objet de requête contenant l'ID du deck en paramètre d'URL.
 * @param {Response} res - L'objet de réponse utilisé pour renvoyer les données JSON.
 *
 * @returns {Promise<Response>} Renvoie une réponse HTTP 200 contenant les données du deck (avec cartes incluses) si le deck existe et appartient à l'utilisateur authentifié.
 * @throws {401} Renvoie une erreur HTTP 401 si le jeton d'authentification est manquant ou invalide.
 * @throws {403} Renvoie une erreur HTTP 403 si le deck n'appartient pas à l'utilisateur authentifié.
 * @throws {404} Renvoie une erreur HTTP 404 si le deck n'existe pas.
 * @throws {500} Renvoie une erreur HTTP 500 si une erreur se produit.
 */
decksRouter.get(
  '/:id',
  authentificateToken,
  async (req: Request, res: Response) => {
    // Récupérer l'ID en paramètre
    const deckId = Number(req.params.id)

    // Récupérer le Deck par son ID
    try {
      // 1. Vérifier si le deck existe
      const existingDeck = await prisma.deck.findUnique({
        where: {
          id: deckId,
        },
      })

      if (!existingDeck) {
        return res.status(404).json({ error: 'Deck introuvable' })
      }

      // 2. Vérifier si le deck appartient à l'utilisateur authentifié
      const deckById = await prisma.deck.findUnique({
        where: {
          id: deckId,
          userId: req.user!.userId,
        },
        // Inclure les cartes du Deck (Prisma s'occupe de lier la jointure DeckCard)
        include: {
          cards: true,
        },
      })

      if (!deckById) {
        return res.status(403).json({ error: 'Deck inaccessible' })
      }

      // 3. Retourner le Deck
      return res.status(200).json(deckById)
    } catch (error) {
      console.error('Error when getting deck by ID:', error)
      return res.status(500).json({ error: 'Server error' })
    }
  },
)

/**
 * @async
 * @description Met à jour un deck existant (nom et cartes) par ID.
 * Les cartes du deck sont remplacées intégralement si une nouvelle sélection est fournie.
 * @requires JWT - Nécessite un jeton d'authentification valide via le middleware @see {@link authentificateToken}.
 *
 * @param {Request} req - L'objet de requête contenant l'ID du deck et les nouvelles données (name et cards).
 * @param {Response} res - L'objet de réponse utilisé pour renvoyer les données JSON.
 *
 * @returns {Promise<Response>} Renvoie une réponse HTTP 200 si le deck a bien été mis à jour.
 * @throws {400} Renvoie une erreur HTTP 400 si les champs obligatoires sont manquants ou si le nombre de cartes Pokémon est incorrect.
 * @throws {401} Renvoie une erreur HTTP 401 si le jeton d'authentification est manquant ou invalide.
 * @throws {403} Renvoie une erreur HTTP 403 si le deck n'appartient pas à l'utilisateur authentifié.
 * @throws {404} Renvoie une erreur HTTP 404 si le deck n'existe pas.
 * @throws {500} Renvoie une erreur HTTP 500 si une erreur se produit.
 */
decksRouter.patch(
  '/:id',
  authentificateToken,
  async (req: Request, res: Response) => {
    // Récupérer l'ID en paramètre
    const deckId = Number(req.params.id)

    // Destructuration : extrait les champs name et cards de la requête PATCH pour en faire des variables distinctes
    // TODO : Créer un type pour req.body
    const { name, cards } = req.body

    // Récupérer le Deck par son ID
    try {
      // 0. Vérifier que tous les champs sont remplis (notamment s'assurer qu'il y a bien 10 cartes)
      if (!name || !cards || cards.length !== 10) {
        return res.status(400).json({ error: 'Données manquantes' })
      }

      // 1. Vérifier que toutes les IDs de cartes sont valides/existants
      const existingCards = await prisma.card.findMany({
        where: {
          id: {
            in: cards,
          },
        },
      })

      // Vérifier la taille puisque findMany renvoie un tableau
      if (existingCards.length !== 10) {
        return res
          .status(400)
          .json({ error: 'IDs de cartes Pokémon invalides/inexistants' })
      }

      // 2. Vérifier si le deck existe
      const existingDeck = await prisma.deck.findUnique({
        where: {
          id: deckId,
        },
      })

      if (!existingDeck) {
        return res.status(404).json({ error: 'Deck introuvable' })
      }

      // 3. Vérifier si le deck appartient à l'utilisateur authentifié
      const deckById = await prisma.deck.findUnique({
        where: {
          id: deckId,
          userId: req.user!.userId,
        },
      })

      if (!deckById) {
        return res.status(403).json({ error: 'Deck inaccessible' })
      }

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
              data: cards.map((cardId: number) => ({ cardId })),
            },
          },
        },
        // Inclure les cartes du Deck (Prisma s'occupe de lier la jointure DeckCard)
        include: {
          cards: true,
        },
      })

      // 5. Retourner le Deck mis à jour
      return res.status(200).json(updatedDeck)
    } catch (error) {
      console.error('Error when updating deck by ID:', error)
      return res.status(500).json({ error: 'Server error' })
    }
  },
)

/**
 * @async
 * @description Supprime un deck et ses cartes associées par ID.
 * @requires JWT - Nécessite un jeton d'authentification valide via le middleware @see {@link authentificateToken}.
 *
 * @param {Request} req - L'objet de requête contenant l'ID du deck à supprimer.
 * @param {Response} res - L'objet de réponse utilisé pour renvoyer les données JSON.
 *
 * @returns {Promise<Response>} Renvoie une réponse HTTP 200 si le deck a bien été supprimé.
 * @throws {401} Renvoie une erreur HTTP 401 si le jeton d'authentification est manquant ou invalide.
 * @throws {403} Renvoie une erreur HTTP 403 si le deck n'appartient pas à l'utilisateur authentifié.
 * @throws {404} Renvoie une erreur HTTP 404 si le deck n'existe pas.
 * @throws {500} Renvoie une erreur HTTP 500 si une erreur se produit.
 */
decksRouter.delete(
  '/:id',
  authentificateToken,
  async (req: Request, res: Response) => {
    // Récupérer l'ID en paramètre
    const deckId = Number(req.params.id)

    // Récupérer le Deck par son ID
    try {
      // 1. Vérifier si le deck existe
      const existingDeck = await prisma.deck.findUnique({
        where: {
          id: deckId,
        },
      })

      if (!existingDeck) {
        return res.status(404).json({ error: 'Deck introuvable' })
      }

      // 2. Vérifier si le deck appartient à l'utilisateur authentifié
      const deckById = await prisma.deck.findUnique({
        where: {
          id: deckId,
          userId: req.user!.userId,
        },
      })

      if (!deckById) {
        return res.status(403).json({ error: 'Deck inaccessible' })
      }

      // 3. Supprimer le Deck et ses dépendances (jointure DeckCard)
      // Supprimer les cartes associées au Deck via la jointure
      await prisma.deckCard.deleteMany({
        where: {
          deckId: deckId,
        },
      })
      // Supprime le Deck
      await prisma.deck.delete({
        where: {
          id: deckId,
        },
      })

      // 4. Retourner la réussite de la suppression
      return res.status(200).json({
        message: 'Suppression réussie',
      })
    } catch (error) {
      console.error('Error when getting deck by ID:', error)
      return res.status(500).json({ error: 'Server error' })
    }
  },
)
