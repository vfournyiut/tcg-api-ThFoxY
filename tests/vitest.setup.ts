import {mockDeep, mockReset, DeepMockProxy} from 'vitest-mock-extended';
import {vi, beforeEach} from 'vitest';
import {PrismaClient} from '../src/generated/prisma/client';
import {prisma} from '../src/database';

vi.mock('../src/database', () => ({
    prisma: mockDeep<PrismaClient>()
}));

// Mock du middleware d'authentification JWT
// vi.mock('../src/auth/auth.middleware', () => ({
//     authentificateToken: vi.fn((req, res, next) => {
//         // Simuler un utilisateur authentifié
//         req.user = {
//             userId: 1,
//             email: 'red@example.com'
//         };
//         next();
//     })
// }));

beforeEach(() => {
    mockReset(prismaMock);
});

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
