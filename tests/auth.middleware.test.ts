import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Request, Response } from 'express'

// Démocker le middleware pour tester la fonction authentificateToken
vi.unmock('../src/auth/auth.middleware')

// Mocker uniquement jsonwebtoken
vi.mock('jsonwebtoken')

import jwt from 'jsonwebtoken'
import { authentificateToken } from '../src/auth/auth.middleware'

// Tests unitaires du middleware d'authentification JWT
describe('Authentification middleware tests (@see auth.middleware.ts)', () => {
  // Avant chaque test, réinitialiser tous les mocks
  beforeEach(() => {
    // Définir la variable d'environnement JWT_SECRET
    process.env.JWT_SECRET = 'test-secret-key'
    // Réinitialiser tous les mocks avant chaque test
    vi.clearAllMocks()
  })

  // Fonction utilitaire pour créer un mock de Request (ne contient que le header Authorization pour le Bearer Token)
  const createMockRequest = (authHeader?: string): Request => {
    return {
      headers: authHeader ? { authorization: authHeader } : {},
    } as Request // 'as Request' évite de renvoyer un type incorrect (Request a trop de propriétés dont on n'a pas besoin !)
  }

  // Fonction utilitaire pour créer un mock de Response
  const createMockResponse = (): Response => {
    const res = {} as Response // Enregistre le type Response
    res.status = vi.fn().mockReturnValue(res) // Renvoie l'objet res lui-même pour permettre le chaînage
    res.json = vi.fn().mockReturnValue(res)
    return res
  }

  it('should add user to request and call next with valid token', () => {
    // Mock de la fonction jwt.verify pour qu'il retourne un utilisateur valide
    const decodedUser = {
      userId: 1,
      email: 'test@example.com',
    }

    vi.mocked(jwt.verify).mockReturnValue(decodedUser)

    // Créer une requête avec un token valide
    const req = createMockRequest('Bearer test-valid-token') // Token valide dans le header Authorization
    const res = createMockResponse()
    const next = vi.fn()

    // Appeler le middleware avec les paramètres précédents
    authentificateToken(req, res, next)

    // Assertions
    expect(jwt.verify).toHaveBeenCalledWith(
      'test-valid-token',
      'test-secret-key',
    ) // A été appelée avec le token et le Bearer
    expect(req.user).toEqual({
      userId: 1,
      email: 'test@example.com',
    }) // req.user doit être défini avec les bonnes données
    expect(next).toHaveBeenCalled() // next() doit être appelé en cas de succès
    expect(res.status).not.toHaveBeenCalled() // Aucune erreur ne doit être retournée
    expect(res.json).not.toHaveBeenCalled()
  })

  it('should return an 401 error if authorization header is missing', () => {
    // Créer une requête sans header Authorization
    const req = createMockRequest() // Aucun header Authorization
    const res = createMockResponse()
    const next = vi.fn()

    // Appeler le middleware avec les paramètres précédents
    authentificateToken(req, res, next)

    // Assertions
    expect(res.status).toHaveBeenCalledWith(401) // Aucun header Authorization
    expect(res.json).toHaveBeenCalledWith({ error: 'Token manquant' })
    expect(next).not.toHaveBeenCalled() // next() ne doit pas être appelé
  })

  it('should return an 401 error if jwt.verify throws any error', () => {
    // Mock de la fonction jwt.verify pour obtenir une erreur factice
    vi.mocked(jwt.verify).mockImplementation(() => {
      throw new Error('Token error')
    })

    // Créer une requête avec un token invalide
    const req = createMockRequest('Bearer test-invalid-token')
    const res = createMockResponse()
    const next = vi.fn()

    // Appeler le middleware avec les paramètres précédents
    authentificateToken(req, res, next)

    // Assertions
    expect(jwt.verify).toHaveBeenCalledWith(
      'test-invalid-token',
      'test-secret-key',
    )
    expect(res.status).toHaveBeenCalledWith(401) // Erreur survenue
    expect(res.json).toHaveBeenCalledWith({
      error: 'Token invalide ou expiré',
    })
    expect(next).not.toHaveBeenCalled() // next() ne doit pas être appelé
    expect(req.user).toBeUndefined() // req.user ne doit pas être défini
  })

  it('should return an 401 error if jwt.verify throws a TokenExpiredError', () => {
    // Mock de la fonction jwt.verify pour obtenir une erreur TokenExpiredError
    vi.mocked(jwt.verify).mockImplementation(() => {
      throw new jwt.TokenExpiredError('Token expired', new Date()) // Simule une erreur TokenExpiredError
    })

    // Créer une requête avec un token expiré
    const req = createMockRequest('Bearer test-expired-token')
    const res = createMockResponse()
    const next = vi.fn()

    // Appeler le middleware avec les paramètres précédents
    authentificateToken(req, res, next)

    // Assertions
    expect(jwt.verify).toHaveBeenCalledWith(
      'test-expired-token',
      'test-secret-key',
    )
    expect(res.status).toHaveBeenCalledWith(401) // Erreur survenue
    expect(res.json).toHaveBeenCalledWith({
      error: 'Token invalide ou expiré',
    })
    expect(next).not.toHaveBeenCalled() // next() ne doit pas être appelé
    expect(req.user).toBeUndefined() // req.user ne doit pas être défini
  })

  it('should return an 401 error if jwt.verify returns null', () => {
    // Mock de la fonction jwt.verify pour retourner null
    vi.mocked(jwt.verify).mockReturnValue(null)

    // Créer une requête avec un token
    const req = createMockRequest('Bearer test-null-token')
    const res = createMockResponse()
    const next = vi.fn()

    // Appeler le middleware avec les paramètres précédents
    authentificateToken(req, res, next)

    // Assertions
    expect(jwt.verify).toHaveBeenCalledWith(
      'test-null-token',
      'test-secret-key',
    )
    expect(res.status).toHaveBeenCalledWith(401) // Erreur survenue
    expect(res.json).toHaveBeenCalledWith({
      error: 'Token invalide ou expiré',
    })
    expect(next).not.toHaveBeenCalled() // next() ne doit pas être appelé
    expect(req.user).toBeUndefined() // req.user ne doit pas être défini
  })
})
