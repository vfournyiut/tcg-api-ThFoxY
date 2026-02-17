import { Server as HTTPServer } from 'http'
import jwt from 'jsonwebtoken'
import { Server, Socket } from 'socket.io'

/**
 * @description Interface pour les événements envoyés du client vers le serveur.
 * @interface ClientToServerEvents
 *
 * @property {function} user - Événement envoyé lorsqu'un utilisateur se connecte, avec le nom d'utilisateur en paramètre.
 */
interface ClientToServerEvents {
  user: (username: string) => void
}

/**
 * @description Interface pour les événements envoyés du serveur vers le client.
 * @interface ServerToClientEvents
 *
 * @property {function} welcome - Événement envoyé pour accueillir un nouveau client, avec un message de bienvenue en paramètre.
 * @property {function} user-joined - Événement envoyé à tous les clients sauf celui qui vient de se connecter, avec un message indiquant qu'un nouvel utilisateur s'est connecté.
 * @property {function} error - Événement envoyé en cas d'erreur, avec un message d'erreur en paramètre.
 */
interface ServerToClientEvents {
  welcome: (message: string) => void
  'user-joined': (message: string) => void
  error: (message: string) => void
}

/**
 * @description Interface pour les données utilisateur stockées dans le socket.
 * @interface UserData
 *
 * @property {number} userId - L'identifiant unique de l'utilisateur.
 * @property {string} username - Le nom d'utilisateur.
 */
interface UserData {
  userId: number
  email: string
}

// Types personnalisés pour Socket.io
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>

/**
 * @description Classe SocketServer pour gérer les connexions Socket.io.
 * @class SocketServer
 */
export class SocketServer {
  private io: TypedServer // Instance de Socket.io avec les types personnalisés

  /**
   * @description Constructeur de la classe SocketServer. Initialise Socket.io et configure les événements de connexion.
   * @param {HTTPServer} httpServer - Le serveur HTTP sur lequel Socket.io doit être attaché.
   */
  constructor(httpServer: HTTPServer) {
    this.io = new Server<ClientToServerEvents, ServerToClientEvents>(
      httpServer,
      {
        // TODO: Restreindre les origines autorisées en production
        cors: {
          origin: '*', // Autorise toutes les origines
        },
      },
    )
    this.setupAuthMiddleware() // Configure le middleware d'authentification pour Socket.io
    this.initializeSocket() // Configure les événements de connexion Socket.io
  }

  /**
   * @description Configure le middleware d'authentification pour Socket.io.
   * @private
   */
  private setupAuthMiddleware(): void {
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token

      if (!token) {
        return next(new Error('Token manquant'))
      }

      try {
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET as string,
        ) as UserData

        // Stocker les données utilisateur dans le socket pour une utilisation ultérieure
        socket.data = decoded
        next()
      } catch (_error) {
        next(new Error('Token invalide ou expiré'))
      }
    })
  }

  /**
   * @description Méthode pour configurer les événements de connexion Socket.io.
   * Gère les événements 'connection', 'user', 'disconnect' et 'error'.
   *
   * @private
   * @returns {void}
   */
  private initializeSocket(): void {
    this.io.on('connection', (socket) => {
      const userData = socket.data as UserData // Récupérer les données utilisateur stockées dans le socket
      console.log('Nouvelle connexion :', socket.id, `(${userData.email})`)

      // Envoyer un événement uniquement à ce client
      socket.emit('welcome', `Bienvenue ${userData.email}!`)

      // Gérer les événements envoyés par le client
      socket.on('user', (_username) => this.handleUser(socket, userData))
      socket.on('disconnect', () => this.handleDisconnect(socket))
      socket.on('error', (error) => this.handleError(socket, error))
    })
  }

  /**
   * @description Méthode pour gérer l'événement 'user' envoyé par le client lorsqu'un utilisateur se connecte.
   * Affiche le nom d'utilisateur dans la console et envoie un événement 'user-joined' aux autres clients.
   * @private
   *
   * @param {TypedSocket} socket - Le socket du client qui a envoyé l'événement.
   * @param {UserData} userData - Les données utilisateur extraites du token JWT.
   */
  private handleUser(socket: TypedSocket, userData: UserData): void {
    console.log('Utilisateur connecté :', userData.email)
    socket.broadcast.emit('user-joined', `${userData.email} s'est connecté`)
  }

  /**
   * @description Méthode pour gérer l'événement 'disconnect' lorsque le client se déconnecte.
   * Affiche un message dans la console indiquant que le client s'est déconnecté.
   * @private
   *
   * @param {TypedSocket} socket - Le socket du client qui s'est déconnecté.
   */
  private handleDisconnect(socket: TypedSocket): void {
    console.log('Utilisateur déconnecté :', socket.id)
  }

  /**
   * @description Méthode pour gérer les erreurs sur le socket. Affiche l'erreur dans la console et envoie un message d'erreur au client.
   * @private
   *
   * @param {TypedSocket} socket - Le socket du client sur lequel l'erreur est survenue.
   * @param {Error} error - L'erreur qui s'est produite.
   */
  private handleError(socket: TypedSocket, error: Error): void {
    console.error('Erreur sur le socket :', error)
    socket.emit('error', 'Une erreur est survenue sur le serveur')
  }
}
