import { Server as HTTPServer } from 'http'
import jwt from 'jsonwebtoken'
import { Server, Socket } from 'socket.io'

import { prisma } from '../database'

/**
 * @description Typage pour les événements client -> serveur.
 * @interface ClientToServerEvents
 *
 * @property {function} user - Un utilisateur s'est connecté.
 * @property {function} getRooms - Un utilisateur demande la liste des salles disponibles.
 * @property {function} createRoom - Un utilisateur demande la création d'une nouvelle salle, avec l'ID du deck utilisé en paramètre.
 * @property {function} joinRoom - Un utilisateur a rejoint une salle, avec l'ID de la salle et l'ID du deck utilisé en paramètre.
 * @property {function} leaveRoom - Un utilisateur a quitté une salle, avec l'ID de la salle en paramètre.
 */
interface ClientToServerEvents {
  user: () => void
  getRooms: () => void
  createRoom: (data: { deckId: number }) => void
  joinRoom: (data: { roomId: string; deckId: number }) => void
  leaveRoom: (roomId: string) => void
}

/**
 * @description Typage pour les événements serveur -> client.
 * @interface ServerToClientEvents
 *
 * @property {function} welcome - Envoie un message de bienvenue au client qui vient de se connecter. Le message contient l'email de l'utilisateur.
 * @property {function} userJoined - Envoie un message à tous les clients (sauf l'émetteur) qu'un utilisateur s'est connecté. Le message contient l'email de l'utilisateur.
 * @property {function} roomsListUpdated - Envoie la liste des salles disponibles à tous les clients. Chaque salle contient son nom, l'email du host (et éventuellement son username).
 * @property {function} roomCreated - Envoie les données de la salle créée au client qui l'a créée, et met à jour la liste des salles pour tous les clients. Les données de la salle contiennent le nom de la salle, l'email du host (et éventuellement son username), et la liste des utilisateurs présents dans la salle.
 * @property {function} roomJoined - Envoie les données de la salle rejointe au client qui vient de la rejoindre, et informe les autres clients de la salle que le nouvel utilisateur a rejoint. Les données de la salle contiennent le nom de la salle et la liste des utilisateurs présents dans la salle.
 * @property {function} roomUserJoined - Envoie un message à tous les clients d'une salle lorsqu'un nouvel utilisateur rejoint la salle, avec l'email de l'utilisateur en paramètre.
 * @property {function} roomUserLeft - Envoie un message à tous les clients d'une salle lorsqu'un utilisateur quitte la salle, avec l'email de l'utilisateur en paramètre.
 * @property {function} gameStarted - Envoie l'état initial de la partie démarrée à tous les clients de la salle. Les données contiennent le nom de la salle, la liste des utilisateurs présents dans la salle, et les IDs des decks utilisés par chaque joueur.
 * @property {function} error - Envoie un message en cas d'erreur, avec le message d'erreur en paramètre.
 */
interface ServerToClientEvents {
  welcome: (message: string) => void
  userJoined: (message: string) => void
  roomsListUpdated: (
    rooms: { room: string; host: { email: string; username?: string } }[],
  ) => void
  roomCreated: (data: {
    room: string
    host: { email: string; username?: string }
    users: string[]
  }) => void
  roomJoined: (data: { room: string; users: string[] }) => void
  roomUserJoined: (email: string) => void
  roomUserLeft: (email: string) => void
  gameStarted: (data: {
    room: string
    users: string[]
    deck1: number
    deck2: number
  }) => void
  error: (message: string) => void
}

/**
 * @description Typage des données utilisateur stockées dans le socket.
 * @interface UserData
 *
 * @property {number} userId - L'identifiant unique de l'utilisateur.
 * @property {string} email - L'adresse email de l'utilisateur.
 * @property {string} [username] - Le nom d'utilisateur (optionnel).
 */
interface UserData {
  userId: number
  email: string
  username?: string
}

/**
 * @description Typage des données d'une salle.
 * @interface RoomData
 *
 * @property {Set<string>} users - Les IDs des sockets présents dans la salle (le premier est le host).
 * Set<string> évite les doublons et facilite l'ajout et la supression d'utilisateurs.
 */
interface RoomData {
  users: Set<string>
}

// Types personnalisés pour Socket.io
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>

/**
 * @description Classe SocketServer pour gérer les connexions Socket.io.
 * @class SocketServer
 */
export class SocketServer {
  private io: TypedServer
  private rooms: Map<string, RoomData> // roomId -> données de la salle
  private connectedUsers: Map<number, string> // userId -> socketId
  private userRooms: Map<number, string> // userId -> roomId

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

    // Map() permet d'associer des données à des clés
    this.rooms = new Map()
    this.connectedUsers = new Map()
    this.userRooms = new Map()

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
            `Utilisateur ${decoded.email} déjà connecté, déconnexion de la session précédente`,
          )
        }

        // 5. Stocker les données utilisateur dans le socket pour une utilisation ultérieure
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
   * @private
   */
  private initializeSocket(): void {
    this.io.on('connection', (socket) => {
      const userData = socket.data as UserData // Récupérer les données utilisateur stockées dans le socket

      this.connectedUsers.set(userData.userId, socket.id) // Associer l'utilisateur connecté à son socket ID
      console.log('Connexion :', socket.id, `(${userData.email})`)

      socket.emit('welcome', `Bienvenue ${userData.email} !`)

      // Gérer les événements envoyés par le client
      socket.on('user', () => this.handleUser(socket))
      socket.on('getRooms', () => this.handleGetRooms(socket))
      socket.on('createRoom', (data) => this.handleCreateRoom(socket, data))
      socket.on('joinRoom', (data) => this.handleJoinRoom(socket, data))
      socket.on('leaveRoom', (roomId) =>
        this.handleLeaveRoom(socket, userData, roomId),
      )
      socket.on('disconnect', () => this.handleDisconnect(socket))
      socket.on('error', (error) => this.handleError(socket, error))
    })
  }

  /**
   * @description Méthode pour gérer l'événement `user` -> informe les autres clients de la connexion au lobby d'attente.
   * @private
   *
   * @param {TypedSocket} socket - Le socket du client qui a envoyé l'événement.
   */
  private handleUser(socket: TypedSocket): void {
    const userData = socket.data as UserData
    console.log('Utilisateur connecté :', userData.email)
    socket.broadcast.emit(
      'userJoined',
      `${userData.email} s'est connecté au lobby d'attente`,
    )
  }

  /**
   * @description Méthode pour gérer l'événement `getRooms` -> renvoie la liste des salles disponibles (le host uniquement).
   * @private
   *
   * @param {TypedSocket} socket - Le socket du client qui a envoyé l'événement.
   */
  private handleGetRooms(socket: TypedSocket): void {
    const availableRooms: {
      room: string
      host: { email: string; username?: string }
    }[] = []

    this.rooms.forEach((roomData, roomId) => {
      // Seules les salles avec exactement 1 joueur sont disponibles (le host uniquement).
      if (roomData.users.size === 1) {
        const [hostSocketId] = roomData.users // Récupérer l'ID du socket du host
        const hostSocket = this.io.sockets.sockets.get(hostSocketId)

        // Récupérer les données du host à partir du socket et les ajouter à la liste des salles disponibles
        if (hostSocket) {
          const hostData = hostSocket.data as UserData
          availableRooms.push({
            room: roomId,
            host: { email: hostData.email, username: hostData.username },
          })
        }
      }
    })

    socket.emit('roomsListUpdated', availableRooms)
  }

  /**
   * @description Méthode pour gérer l'événement `createRoom` -> crée une nouvelle salle avec l'ID du deck utilisé en paramètre.
   * Le deck doit exister, appartenir à l'utilisateur et contenir exactement 10 cartes valides.
   * Si l'utilisateur est déjà dans une salle, il en est retiré automatiquement avant la création.
   * @private
   *
   * @param {TypedSocket} socket - Le socket du client qui a envoyé l'événement.
   * @param {{ deckId: number }} data - Les données envoyées avec l'événement.
   * @return {boolean | void} - Retourne false en cas d'erreur, sinon rien.
   */
  private async handleCreateRoom(
    socket: TypedSocket,
    data: { deckId: number },
  ): Promise<boolean | void> {
    const userData = socket.data as UserData
    const { deckId } = data // Récupérer les données du deck à partir de la base de données pour vérifier sa validité

    // 1. Vérifier la validité du deck
    const deck = await prisma.deck.findUnique({
      where: { id: Number(deckId) },
      include: { cards: true },
    })

    // Cas d'erreur possibles :
    if (!deck) return socket.emit('error', 'Deck introuvable')
    if (deck.userId !== userData.userId)
      return socket.emit('error', 'Deck inaccessible')
    if (deck.cards.length !== 10)
      return socket.emit('error', 'IDs de cartes Pokémon invalides/inexistants')

    // 2. Quitter la salle précédente si elle existe
    const existingRoomId = this.userRooms.get(userData.userId) // Récupérer l'ID de la salle actuelle de l'utilisateur
    if (existingRoomId) {
      this.handleLeaveRoom(socket, userData, existingRoomId)
      console.log(
        `${userData.email} a quitté la salle ${existingRoomId} pour en créer une nouvelle`,
      )
    }

    // 3. Créer la nouvelle salle et y ajouter l'utilisateur
    const roomId = `room-${String(deckId)}-${userData.email}` // Générer un ID de salle unique basé sur l'ID du deck et de l'utilisateur
    this.rooms.set(roomId, { users: new Set([socket.id]) })
    this.userRooms.set(userData.userId, roomId)
    socket.join(roomId) // Rejoindre la salle

    // 4. Envoyer les données de la salle au client qui l'a créée
    socket.emit('roomCreated', {
      room: roomId,
      host: { email: userData.email, username: userData.username },
      users: [userData.email],
    })

    // 5. Mettre à jour la liste des salles pour tous les clients (sauf le host)
    socket.broadcast.emit('roomsListUpdated', [
      {
        room: roomId,
        host: { email: userData.email, username: userData.username },
      },
    ])

    console.log(`${userData.email} a créé la salle ${roomId}`)
  }

  /**
   * @description Méthode pour gérer l'événement `joinRoom` -> rejoint une salle existante avec l'ID de la salle et l'ID du deck utilisé en paramètre.
   * La salle doit exister et avoir moins de 1 joueur (le host uniquement).
   * Le deck doit exister, appartenir à l'utilisateur et contenir exactement 10 cartes valides.
   * Si l'utilisateur est déjà dans une salle, il en est retiré automatiquement avant de rejoindre.
   * @private
   *
   * @param {TypedSocket} socket - Le socket du client qui a envoyé l'événement.
   * @param {{ roomId: string; deckId: number }} data - Les données envoyées avec l'événement.
   * @return {boolean | void} - Retourne false en cas d'erreur, sinon rien.
   */
  private async handleJoinRoom(
    socket: TypedSocket,
    data: { roomId: string; deckId: number },
  ): Promise<boolean | void> {
    const { roomId, deckId } = data // Récupérer les données de la salle et du deck à partir de la base de données pour vérifier leur validité

    // 1. Vérifier la validité de la salle
    if (!this.rooms.has(roomId))
      return socket.emit('error', 'Salle introuvable')

    const userData = socket.data as UserData
    const roomData = this.rooms.get(roomId)! // Récupérer les données de la salle (existe, car vérifié juste avant)

    // 2. Vérifier que la salle n'est pas déjà complète
    if (roomData.users.size >= 2) return socket.emit('error', 'Salle complète')

    // 3. Vérifier la validité du deck
    const deck = await prisma.deck.findUnique({
      where: { id: Number(deckId) },
      include: { cards: true },
    })

    // Cas d'erreur possibles :
    if (!deck) return socket.emit('error', 'Deck introuvable')
    if (deck.userId !== userData.userId)
      return socket.emit('error', 'Deck inaccessible')
    if (deck.cards.length !== 10)
      return socket.emit('error', 'IDs de cartes Pokémon invalides/inexistants')

    // 4. Quitter la salle précédente si elle existe
    const existingRoomId = this.userRooms.get(userData.userId) // Récupérer l'ID de la salle actuelle de l'utilisateur
    if (existingRoomId) {
      this.handleLeaveRoom(socket, userData, existingRoomId)
      console.log(
        `${userData.email} a quitté la salle ${existingRoomId} pour rejoindre ${roomId}`,
      )
    }

    // 5. Rejoindre la salle et y ajouter l'utilisateur
    roomData.users.add(socket.id)
    this.userRooms.set(userData.userId, roomId)
    socket.join(roomId) // Rejoindre la salle

    socket.to(roomId).emit('roomUserJoined', userData.email) // Informer les autres clients de la salle que le nouvel utilisateur a rejoint

    // 6. Mettre à jour la liste des salles pour tous les clients et retirer la salle des salles disponibles
    socket.broadcast.emit('roomsListUpdated', [
      {
        room: roomId,
        host: { email: userData.email, username: userData.username },
      },
    ])

    console.log(`${userData.email} a rejoint la salle ${roomId}`)

    // 7. Démarrer la partie dès que 2 joueurs sont présents
    if (roomData.users.size === 2) {
      const users = this.getRoomUsers(roomId) // Récupérer la liste des utilisateurs présents dans la salle

      // Envoyer l'état initial de la partie à tous les clients de la salle
      this.io.to(roomId).emit('gameStarted', {
        room: roomId,
        users,
        deck1: parseInt(roomId.split('-')[1]), // Le deck du host est extrait de l'ID de la salle (c'est intelligent ^^)
        deck2: deckId, // Le deck de l'adversaire est celui envoyé par l'utilisateur qui vient de rejoindre
      })

      console.log(
        `La partie dans la salle ${roomId} a démarré avec les joueurs : ${users.join(', ')}`,
      )
    }
  }

  /**
   * @description Méthode pour gérer l'événement `leaveRoom` -> retire l'utilisateur de la salle spécifiée.
   * @private
   *
   * @param {TypedSocket} socket - Le socket du client qui a envoyé l'événement.
   * @param {string} roomId - L'ID de la salle à quitter.
   * @return {boolean | void} - Retourne false en cas d'erreur, sinon rien.
   */
  private handleLeaveRoom(
    socket: TypedSocket,
    userData: UserData,
    roomId: string,
  ): boolean | void {
    // 1. Vérifier que la salle existe
    if (!this.rooms.has(roomId))
      return socket.emit('error', 'Salle introuvable')

    const roomData = this.rooms.get(roomId)! // Récupérer les données de la salle (existe, car vérifié juste avant)

    // 2. Vérifier que l'utilisateur est bien dans la salle
    if (roomData.users.has(socket.id)) {
      roomData.users.delete(socket.id) // Retirer l'utilisateur de la salle
      this.userRooms.delete(userData.userId)
      socket.leave(roomId) // Quitter la salle

      socket.to(roomId).emit('roomUserLeft', userData.email) // Informer les autres clients de la salle que l'utilisateur a quitté
      console.log(`${userData.email} a quitté la salle ${roomId}`)
    }

    // 3. Supprimer la salle si elle est vide
    // Étant donné qu'une partie démarre directement lorsqu'il y a 2 joueurs, un joueur qui n'est pas host ne pourra jamais être seul dans une salle. Seul le host peut être seul, et s'il quitte, la salle doit être supprimée.
    if (roomData.users.size === 0) {
      this.rooms.delete(roomId)
      console.log(`La salle ${roomId} a été supprimée`)
    }
  }

  /**
   * @description Méthode pour gérer l'événement `disconnect` -> retire l'utilisateur de sa salle et des utilisateurs connectés.
   * @private
   *
   * @param {TypedSocket} socket - Le socket du client qui a envoyé l'événement.
   */
  private handleDisconnect(socket: TypedSocket): void {
    const userData = socket.data as UserData
    this.connectedUsers.delete(userData.userId) // Retirer l'utilisateur de la liste des utilisateurs connectés

    const roomId = this.userRooms.get(userData.userId) // Récupérer l'ID de la salle actuelle de l'utilisateur
    if (roomId) {
      this.handleLeaveRoom(socket, userData, roomId)
    }

    console.log('Déconnexion :', socket.id, `(${userData.email})`)
  }

  /**
   * @description Méthode qui gère les erreurs sur le socket.
   * @private
   */
  private handleError(socket: TypedSocket, error: Error): void {
    console.error('Erreur sur le socket :', error)
    socket.emit('error', error.message)
  }

  /**
   * @description Retourne la liste des utilisateurs présents dans une salle, à partir de l'ID de la salle.
   * @private
   *
   * @param {string} roomId - L'ID de la salle dont on veut récupérer les utilisateurs.
   * @return {string[]} - La liste des emails des utilisateurs présents dans la salle.
   */
  private getRoomUsers(roomId: string): string[] {
    const roomData = this.rooms.get(roomId)
    if (!roomData) return [] // Si la salle n'existe pas, retourner une liste vide

    const users: string[] = []

    roomData.users.forEach((socketId) => {
      const user = this.io.sockets.sockets.get(socketId) // Récupérer le socket de l'utilisateur à partir de son ID de socket
      if (user) users.push((user.data as UserData).email) // Récupérer les données utilisateur stockées dans le socket et ajouter l'email à la liste des utilisateurs de la salle
    })

    return users
  }
}
