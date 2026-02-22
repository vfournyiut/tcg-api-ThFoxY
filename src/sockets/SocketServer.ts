import { Server as HTTPServer } from 'http'
import jwt from 'jsonwebtoken'
import { Server, Socket } from 'socket.io'

/**
 * @description Interface pour les événements envoyés du client vers le serveur.
 * @interface ClientToServerEvents
 *
 * @property {function} user - Événement envoyé lorsqu'un utilisateur se connecte, avec le nom d'utilisateur en paramètre.
 * @property {function} getRooms - Événement envoyé pour demander la liste des salles disponibles.
 * @property {function} createRoom - Événement envoyé pour créer une nouvelle salle.
 * @property {function} joinRoom - Événement envoyé lorsqu'un utilisateur rejoint une salle, avec le nom de la salle en paramètre.
 * @property {function} leaveRoom - Événement envoyé lorsqu'un utilisateur quitte une salle, avec le nom de la salle en paramètre.
 */
interface ClientToServerEvents {
  user: (username: string) => void
  getRooms: () => void
  createRoom: (room: string) => void
  joinRoom: (room: string) => void
  leaveRoom: (room: string) => void
}

/**
 * @description Interface pour les événements envoyés du serveur vers le client.
 * @interface ServerToClientEvents
 *
 * @property {function} welcome - Événement envoyé pour accueillir un nouveau client, avec un message de bienvenue en paramètre.
 * @property {function} userJoined - Événement envoyé à tous les clients sauf celui qui vient de se connecter, avec un message indiquant qu'un nouvel utilisateur s'est connecté.
 * @property {function} roomsListUpdated - Événement envoyé au client demandeur avec la liste des salles en attente d'un second joueur. Chaque entrée contient l'identifiant de la salle et l'email du host.
 * @property {function} roomCreated - Événement envoyé au client qui a créé une salle, avec les données de la salle (nom, email du host et liste des utilisateurs) en paramètre.
 * @property {function} roomJoined - Événement envoyé lorsqu'un utilisateur rejoint une salle, avec les données de la salle (nom et liste des utilisateurs) en paramètre.
 * @property {function} roomUserJoined - Événement envoyé à tous les clients d'une salle lorsqu'un nouvel utilisateur rejoint la salle, avec le nom de l'utilisateur en paramètre.
 * @property {function} roomUserLeft - Événement envoyé à tous les clients d'une salle lorsqu'un utilisateur quitte la salle, avec le nom de l'utilisateur en paramètre.
 * @property {function} error - Événement envoyé en cas d'erreur, avec un message d'erreur en paramètre.
 */
interface ServerToClientEvents {
  welcome: (message: string) => void
  userJoined: (message: string) => void
  roomsListUpdated: (rooms: { room: string; host: { email: string } }[]) => void
  roomCreated: (data: {
    room: string
    host: { email: string }
    users: string[]
  }) => void
  roomJoined: (data: { room: string; users: string[] }) => void
  roomUserJoined: (username: string) => void
  roomUserLeft: (username: string) => void
  error: (message: string) => void
}

/**
 * @description Interface pour les données utilisateur stockées dans le socket.
 * @interface UserData
 *
 * @property {number} userId - L'identifiant unique de l'utilisateur.
 * @property {string} username - Le nom d'utilisateur (optionnel).
 * @property {string} email - L'adresse email de l'utilisateur.
 */
interface UserData {
  userId: number
  username?: string
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
  private rooms: Map<string, Set<string>> // Map pour stocker les salles et les utilisateurs présents dans chaque salle
  private connectedUsers: Map<number, string> // Mpa pour stocker les IDs des utilisateurs connectés et leur socket ID

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

    this.rooms = new Map<string, Set<string>>() // Initialiser la map des salles
    this.connectedUsers = new Map<number, string>() // Initialiser la map des utilisateurs connectés

    this.setupAuthMiddleware() // Configure le middleware d'authentification pour Socket.io
    this.initializeSocket() // Configure les événements de connexion Socket.io
  }

  /**
   * @description Configure le middleware d'authentification pour Socket.io.
   * @private
   */
  private setupAuthMiddleware(): void {
    this.io.use((socket, next) => {
      // 1. Récupérer le token JWT envoyé par le client dans les données d'authentification du handshake
      const token = socket.handshake.auth.token

      // 2. Vérifier que le token est présent
      if (!token) {
        return next(new Error('Token manquant'))
      }

      // 3. Vérifier la validité du token et extraire les données utilisateur
      try {
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET as string,
        ) as UserData

        // 4. Vérifier si l'utilisateur est déjà connecté
        if (this.connectedUsers.has(decoded.userId)) {
          const existingSocketId = this.connectedUsers.get(decoded.userId)!
          // Déconnecter la session précédente
          this.io.sockets.sockets.get(existingSocketId)?.disconnect(true)
          console.log(
            `Utilisateur ${decoded.email} déjà connecté, déconnexion de la session précédente.`,
          )
        }

        // Stocker les données utilisateur dans le socket pour une utilisation ultérieure
        socket.data = decoded
        next()
      } catch (_error) {
        // Si le token est invalide ou expiré, rejeter la connexion avec une erreur
        next(new Error('Token invalide ou expiré'))
      }
    })
  }

  /**
   * @description Méthode pour configurer les événements de connexion Socket.io.
   * Gère les événements 'connection', 'user', 'join-room', 'leave-room', 'disconnect' et 'error' pour chaque client connecté.
   *
   * @private
   * @returns {void}
   */
  private initializeSocket(): void {
    this.io.on('connection', (socket) => {
      const userData = socket.data as UserData // Récupérer les données utilisateur stockées dans le socket
      this.connectedUsers.set(userData.userId, socket.id) // Ajouter l'utilisateur à la map des utilisateurs connectés
      console.log('Nouvelle connexion :', socket.id, `(${userData.email})`)

      // Envoyer un événement uniquement à ce client
      socket.emit('welcome', `Bienvenue ${userData.email} !`)

      // Gérer les événements envoyés par le client
      socket.on('user', () => this.handleUser(socket, userData))
      socket.on('getRooms', () => this.handleGetRooms(socket))
      socket.on('createRoom', (room) => this.handleCreateRoom(socket, room))
      socket.on('joinRoom', (room) =>
        this.handleJoinRoom(socket, userData, room),
      )
      socket.on('leaveRoom', (room) =>
        this.handleLeaveRoom(socket, userData, room),
      )
      socket.on('disconnect', () => this.handleDisconnect(socket, userData))
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
    socket.broadcast.emit('userJoined', `${userData.email} s'est connecté`)
  }

  /**
   * @description Méthode pour gérer l'événement 'getRooms' envoyé par le client lorsqu'il demande la liste des salles disponibles.
   * Filtre les salles qui possèdent exactement un joueur (le host) et renvoie un événement 'roomsListUpdated' avec, pour chaque salle, son identifiant et l'email du host.
   * @private
   *
   * @param {TypedSocket} socket - Le socket du client qui a envoyé l'événement.
   */
  private handleGetRooms(socket: TypedSocket): void {
    const availableRooms: {
      room: string
      host: { email: string; username?: string }
    }[] = [] // Liste pour stocker les salles disponibles avec l'email et le nom d'utilisateur du host

    // Parcourir les salles et filtrer celles qui ont exactement un joueur (le host)
    this.rooms.forEach((roomSet, room) => {
      if (roomSet.size === 1) {
        const [hostSocketId] = roomSet // Récupérer l'ID du socket du host (le seul joueur dans la salle)
        const hostSocket = this.io.sockets.sockets.get(hostSocketId)

        // Si le socket du host existe, extraire les données utilisateur pour obtenir l'email et ajouter la salle à la liste des salles disponibles
        if (hostSocket) {
          const hostData = hostSocket.data as UserData
          availableRooms.push({
            room,
            host: { email: hostData.email, username: hostData.username },
          })
        }
      }
    })

    socket.emit('roomsListUpdated', availableRooms)
  }

  /**
   * @description Méthode pour gérer l'événement 'createRoom' envoyé par le client lorsqu'un utilisateur veut créer une nouvelle salle.
   * Créer une nouvelle salle et envoie un événement 'roomCreated' au créateur (host), ainsi qu'un evénement 'roomsListUpdated' aux autres clients.
   * @private
   *
   * @param {TypedSocket} socket - Le socket du client qui a envoyé l'événement.
   * @param {string} room - Le nom de la salle que l'utilisateur veut créer.
   * @return {boolean | void} - Retourne false si la salle existe deja, sinon retourne void.
   */
  private handleCreateRoom(socket: TypedSocket, room: string): boolean | void {
    // Vérifier si la salle existe deja
    if (this.rooms.has(room)) {
      return socket.emit('error', 'La salle existe déjà')
    }

    // Créer la salle et ajouter le créateur (host) à la salle
    this.rooms.set(room, new Set<string>([socket.id]))
    socket.join(room)

    const userData = socket.data as UserData // Récupérer les données utilisateur pour obtenir l'email du host
    socket.emit('roomCreated', {
      room,
      host: { email: userData.email },
      users: [userData.email],
    }) // Envoyer les données de la salle au client qui vient de la créer

    socket.broadcast.emit('roomsListUpdated', [
      { room, host: { email: userData.email } },
    ]) // Informer les autres clients qu'une nouvelle salle a été créée

    console.log(`${userData.email} a créé la salle ${room}`)
  }

  /**
   * @description Méthode pour gérer l'événement 'joinRoom' envoyé par le client lorsqu'un utilisateur veut rejoindre une salle.
   * Ajoute l'utilisateur à la salle et envoie un événement 'userJoinedRoom' aux autres clients dans la salle.
   * @private
   *
   * @param {TypedSocket} socket - Le socket du client qui a envoyé l'événement.
   * @param {UserData} userData - Les données utilisateur extraites du token JWT.
   * @param {string} room - Le nom de la salle que l'utilisateur veut rejoindre.
   * @return {boolean | void} - Retourne false si la salle n'existe pas, sinon retourne void.
   */
  private handleJoinRoom(
    socket: TypedSocket,
    userData: UserData,
    room: string,
  ): boolean | void {
    // Vérifier que la salle existe
    if (!this.rooms.has(room)) {
      return socket.emit('error', "La salle n'existe pas")
    }

    // Ajouter l'utilisateur à la salle
    socket.join(room)
    this.rooms.get(room)!.add(socket.id) // Ajouter le socket ID à la liste des utilisateurs de la salle

    const users = this.getRoomUsers(room) // Récupérer la liste des utilisateurs dans la salle
    socket.emit('roomJoined', { room, users }) // Envoyer les données de la salle au client qui vient de rejoindre
    socket.to(room).emit('roomUserJoined', userData.email) // Informer les autres clients dans la salle qu'un nouvel utilisateur a rejoint

    console.log(`${userData.email} a rejoint la salle ${room}`)
  }

  /**
   * @description Méthode pour gérer l'événement 'leaveRoom' envoyé par le client lorsqu'un utilisateur veut quitter une salle.
   * Retire l'utilisateur de la salle et envoie un événement 'userLeftRoom' aux autres clients dans la salle.
   * @private
   *
   * @param {TypedSocket} socket - Le socket du client qui a envoyé l'événement.
   * @param {UserData} userData - Les données utilisateur extraites du token JWT.
   * @param {string} room - Le nom de la salle que l'utilisateur veut quitter.
   * @returns {boolean | void} - Retourne false si la salle n'existe pas ou si l'utilisateur n'est pas dans la salle, sinon retourne void.
   */
  private handleLeaveRoom(
    socket: TypedSocket,
    userData: UserData,
    room: string,
  ): boolean | void {
    const roomSet = this.rooms.get(room)
    if (roomSet && roomSet.has(socket.id)) {
      roomSet.delete(socket.id) // Retirer le socket ID de la liste des utilisateurs de la salle
      socket.leave(room) // Faire quitter la salle au socket
      socket.to(room).emit('roomUserLeft', userData.email) // Informer les autres clients dans la salle qu'un utilisateur a quitté

      console.log(`${userData.email} a quitté la salle ${room}`)
    }
  }

  /**
   * @description Méthode pour récupérer la liste des utilisateurs présents dans une salle donnée.
   * Parcourt les sockets présents dans la salle et extrait les données utilisateur pour construire une liste d'emails.
   * @private
   *
   * @param {string} room - Le nom de la salle pour laquelle récupérer la liste des utilisateurs.
   * @returns {string[]} - La liste des emails des utilisateurs présents dans la salle.
   */
  private getRoomUsers(room: string): string[] {
    // Vérifier que la salle existe
    const roomSet = this.rooms.get(room)
    if (!roomSet) return [] // Si la salle n'existe pas, retourner une liste vide

    const users: string[] = [] // Liste pour stocker les emails des utilisateurs présents dans la salle

    // Parcourir les sockets présents dans la salle et extraire les données utilisateur
    roomSet.forEach((socketId) => {
      const socket = this.io.sockets.sockets.get(socketId) // Récupérer le socket à partir de son ID

      // Si le socket existe, extraire les données utilisateur et ajouter l'email à la liste des utilisateurs
      if (socket) {
        users.push((socket.data as UserData).email) // Ajouter l'email de l'utilisateur à la liste
      }
    })
    return users
  }

  /**
   * @description Méthode pour gérer l'événement 'disconnect' lorsque le client se déconnecte. Retire l'utilisateur de toutes les salles auxquelles il appartient et informe les autres clients dans ces salles que l'utilisateur a quitté.
   * @private
   *
   * @param {TypedSocket} socket - Le socket du client qui s'est déconnecté.
   * @param {UserData} userData - Les données utilisateur extraites du token JWT.
   */
  private handleDisconnect(socket: TypedSocket, userData: UserData): void {
    // Retirer l'utilisateur du map des utilisateurs connectés
    this.connectedUsers.delete(userData.userId)

    // Parcourir les salles et retirer l'utilisateur de toutes les salles auxquelles il appartient
    this.rooms.forEach((roomSet, roomName) => {
      if (roomSet.has(socket.id)) {
        roomSet.delete(socket.id) // Retirer le socket ID de la liste des utilisateurs de la salle
        socket.to(roomName).emit('roomUserLeft', userData.email) // Informer les autres clients dans la salle qu'un utilisateur a quitté

        console.log(
          `${userData.email} s'est déconnecté de la salle ${roomName}`,
        )
      }
    })
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
