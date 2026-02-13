import cors from 'cors'
import express from 'express'
import { createServer } from 'http'

import { authRouter } from './auth/auth.route'
import { cardsRouter } from './cards/cards.route'
import { decksRouter } from './decks/decks.route'
import { env } from './env'

console.log('test')

// Create Express app
export const app = express()

// Middlewares pour autoriser les requêtes CORS multi-origines (https://developer.mozilla.org/fr/docs/Web/HTTP/Guides/CORS)
app.use(
  cors({
    origin: true, // Autorise toutes les origines
    credentials: true,
  }),
)

// Middleware pour parser le JSON
app.use(express.json())

// Serve static files (Socket.io test client)
app.use(express.static('public'))

// Utilisation des routeurs spécifiques
// Authentification (toutes les routes d'authentification seront préfixées par /api/auth)
app.use('/api/auth', authRouter)

// Cartes Pokémon (toutes les routes de cartes Pokémon seront préfixées par /api/cards)
// Pour l'instant, il n'y a que GET /api/cards (mais d'autres endpoints seront ajoutés)
app.use('/api/cards', cardsRouter)

// Decks (toutes les routes de decks seront préfixées par /api/decks)
app.use('/api/decks', decksRouter)

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'TCG Backend Server is running' })
})

// Start server only if this file is run directly (not imported for tests)
if (require.main === module) {
  // Create HTTP server
  const httpServer = createServer(app)

  // Start server
  try {
    httpServer.listen(env.PORT, () => {
      console.log(`\n🚀 Server is running on http://localhost:${env.PORT}`)
      console.log(
        `🧪 Socket.io Test Client available at http://localhost:${env.PORT}`,
      )
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}
