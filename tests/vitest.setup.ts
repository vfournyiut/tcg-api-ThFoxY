import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended'
import { vi, beforeEach } from 'vitest'
import { PrismaClient } from '../src/generated/prisma/client'
import { prisma } from '../src/database'

vi.mock('../src/database', () => ({
  prisma: mockDeep<PrismaClient>(),
}))

// Mock du middleware d'authentification JWT
export const authentificateTokenMock = vi.fn((req, _res, next) => {
  // Simuler un utilisateur authentifié
  req.user = {
    userId: 1,
    email: 'test@example.com',
  }
  next()
})

// Remplacer le middleware d'authentification par le mock partout
vi.mock('../src/auth/auth.middleware', () => ({
  authentificateToken: authentificateTokenMock,
}))

// Avant chaque test, réinitialiser le mock du middleware
beforeEach(() => {
  mockReset(prismaMock)
  authentificateTokenMock.mockClear()
  authentificateTokenMock.mockImplementation((req, _res, next) => {
    req.user = {
      userId: 1,
      email: 'test@example.com',
    }
    next()
  })
})

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>
