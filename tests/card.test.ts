import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { prismaMock, authentificateTokenMock } from './vitest.setup'
import { app } from '../src/index'
import { PokemonType } from '../src/generated/prisma/enums'

// Tests unitaires des endpoints des cartes Pokémon
describe('Cards tests (@see cards.route.ts)', () => {
  describe('GET /cards/', () => {
    it('should return all Pokémon cards', async () => {
      // Créer des cartes de test
      const cards = [
        {
          id: 1,
          name: 'Bulbasaur',
          hp: 45,
          attack: 49,
          type: PokemonType.Grass,
          pokedexNumber: 1,
          imgUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 41,
          name: 'Ivysaur',
          hp: 60,
          attack: 62,
          type: PokemonType.Grass,
          pokedexNumber: 2,
          imgUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      // Mock de la fonction prisma.card.findMany
      prismaMock.card.findMany.mockResolvedValue(cards)

      // Requête HTTP via supertest
      const response = await request(app).get('/api/cards')

      // Assertions
      expect(response.status).toBe(200) // Cartes Pokémon trouvées avec succès
      expect(response.body).toHaveLength(cards.length) // Contient le nombre de cartes Pokémon attendu
    })

    it('should throw an 401 error when authentication fails', async () => {
      // Mock de la fonction authentificateToken
      authentificateTokenMock.mockImplementationOnce((_req, res, _next) => {
        return res.status(401).json({ error: 'Token invalide ou expiré' })
      })

      // Requête HTTP via supertest
      const response = await request(app).get('/api/cards')

      // Assertions
      expect(response.status).toBe(401) // Jeton JWT invalide
      expect(response.body).toHaveProperty('error') // Contient la propriété attendue
      expect(response.body.error).toBe('Token invalide ou expiré')
    })

    it('should throw an 500 error if the server fails', async () => {
      // Mock de la fonction prisma.card.findMany
      prismaMock.card.findMany.mockRejectedValue(new Error())

      // Requête HTTP via supertest
      const response = await request(app).get('/api/cards')

      // Assertions
      expect(response.status).toBe(500) // Erreur interne du serveur
      expect(response.body).toHaveProperty('error') // Contient la propriété attendue
      expect(response.body.error).toBe('Server error')
    })
  })
})
