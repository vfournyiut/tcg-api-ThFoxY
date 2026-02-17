import cors from 'cors'
import express from 'express'
import { createServer } from 'http'
import swaggerUi from 'swagger-ui-express'

import { authRouter } from './auth/auth.route'
import { cardsRouter } from './cards/cards.route'
import { decksRouter } from './decks/decks.route'
import { swaggerDocument } from './docs'
import { env } from './env'
import { SocketServer } from './sockets/SocketServer'

// Créer une instance de l'application Express
export const app = express()

// Middlewares pour autoriser les requêtes CORS multi-origines (https://developer.mozilla.org/fr/docs/Web/HTTP/Guides/CORS)
app.use(
  // TODO: Restreindre les origines autorisées en production
  cors({
    origin: true, // Autorise toutes les origines
    credentials: true,
  }),
)

// Middleware pour parser le JSON
app.use(express.json())

// Middleware pour servir les fichiers statiques depuis le dossier "public"
app.use(express.static('public'))

// Documentation Swagger UI
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'API TCG Pokémon Documentation',
  }),
)

// Utilisation des routeurs spécifiques
// Authentification (toutes les routes d'authentification seront préfixées par /api/auth)
app.use('/api/auth', authRouter)

// Cartes Pokémon (toutes les routes de cartes Pokémon seront préfixées par /api/cards)
// Pour l'instant, il n'y a que GET /api/cards (mais d'autres endpoints seront ajoutés)
app.use('/api/cards', cardsRouter)

// Decks (toutes les routes de decks seront préfixées par /api/decks)
app.use('/api/decks', decksRouter)

// Endpoint de santé pour vérifier que le serveur fonctionne
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'TCG Backend Server is running' })
})

// Créer un serveur HTTP à partir de l'application Express
const httpServer = createServer(app)

// Créer une instance de SocketServer pour gérer les connexions Socket.io
new SocketServer(httpServer)

// Démarrer le serveur HTTP
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
