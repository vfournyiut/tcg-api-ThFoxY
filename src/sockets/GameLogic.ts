import { prisma } from '../database'
import { PokemonType } from '../generated/prisma/client'
import { calculateDamage } from '../utils/rules.util'

/**
 * @description Typage des données de l'entraîneur
 * @interface TrainerData
 *
 * @property {number} userId - L'identifiant unique de l'utilisateur.
 * @property {string} email - L'adresse email de l'utilisateur.
 * @property {string} [username] - Le nom d'utilisateur (optionnel).
 *
 * @property {string} socketId - L'identifiant de la connexion Socket.io.
 * @property {number} deckId - L'identifiant du deck de cartes Pokémon utilisé par l'entraîneur.
 * @property {number[]} deckCards - Les IDs des cartes Pokémon restantes dans le deck (pioche).
 * @property {number[]} handCards - Les IDs des cartes Pokémon actuellement en main (maximum 5).
 * @property {number} fieldCard - L'ID de la carte Pokémon active sur le terrain (0 si aucune).
 * @property {number} score - Le score actuel de l'entraîneur (1 point par carte adverse vaincue).
 */
interface TrainerData {
  userId: number
  email: string
  username?: string

  socketId: string
  deckId: number
  deckCards: number[]
  handCards: number[]
  fieldCard: number
  score: number
}

/**
 * @description Typage des données de l'état du jeu pour un entraîneur, renvoyées au client.
 * La main et le deck de l'adversaire ne sont jamais exposés.
 * @interface ClientGameState
 *
 * @property {boolean} clientTurn - Indique si c'est le tour du client.
 * @property {number[]} clientDeckCards - Les IDs des cartes restantes dans le deck du client (pioche).
 * @property {number[]} clientHand - Les IDs des cartes en main du client (maximum 5).
 * @property {number} clientFieldCard - L'ID de la carte Pokémon active sur le terrain du client (0 si aucune).
 * @property {number} clientScore - Le score actuel du client (1 point par carte adverse vaincue).
 *
 * @property {number} opponentFieldCard - L'ID de la carte Pokémon active sur le terrain de l'adversaire (0 si aucune).
 * @property {number} opponentScore - Le score actuel de l'adversaire (1 point par carte adverse vaincue).
 * @property {number} opponentHandCount - Le nombre de cartes actuellement en main de l'adversaire (sans les IDs).
 * @property {number} opponentDeckCount - Le nombre de cartes restantes dans le deck de l'adversaire (sans les IDs).
 */
export interface ClientGameState {
  clientTurn: boolean
  clientDeckCards: number[]
  clientHandCards: number[]
  clientFieldCard: number
  clientScore: number

  opponentFieldCard: number
  opponentScore: number
  opponentHandCount: number
  opponentDeckCount: number
}

/**
 * @description Classe GameLogic pour gérer la logique du jeu.
 * @class GameLogic
 */
export class GameLogic {
  // Constructor parameter, so no need to store it in a property
  private trainers: Map<string, TrainerData> // socketId -> TrainerData
  private turn: string // socketId de l'entraîneur dont c'est le tour

  /**
   * @description Constructeur de la classe GameLogic. Initialise les propriétés de la partie.
   * @constructor
   *
   * @param {string} roomId - L'identifiant de la salle de jeu.
   */
  constructor(_roomId: string) {
    this.trainers = new Map()
    this.turn = ''
  }

  /**
   * @description Méthode pour initialiser la partie.
   * @async
   */
  public async initializeGame(): Promise<void> {
    // 1. Récupérer les IDs de socket des entraîneurs
    const [firstSocketId] = this.trainers.keys()
    this.turn = firstSocketId // Le premier entraîneur (host) commence toujours la partie

    // 2. Charger les decks pour chaque entraîneur
    for (const [_socketId, trainer] of this.trainers) {
      const deck = await prisma.deck.findUnique({
        where: { id: Number(trainer.deckId) },
        include: { cards: true },
      })

      // Mélanger le deck aléatoirement
      const cardIds = deck!.cards.map((deckCard) => deckCard.cardId)
      cardIds.sort(() => Math.random() - 0.5) // Vu dans `seed.ts` ^^

      trainer.deckCards = cardIds
      trainer.handCards = []
      trainer.fieldCard = 0
      trainer.score = 0
    }
  }

  /**
   * @description Méthode pour gérer l'ajout d'un entraîneur à la partie.
   * @public
   *
   * @param {TrainerData} trainerData - Les données de l'entraîneur à ajouter.
   */
  public addTrainer(trainerData: TrainerData): void {
    this.trainers.set(trainerData.socketId, trainerData)
  }

  // TODO: Éviter la redondance de code pour les vérifications 'Entraîneur introuvable' ou 'Halte ! attendez votre tour !'

  /**
   * @description Méthode pour gérer l'événement `drawCards` -> pioche des cartes depuis le deck jusqu'à avoir 5 cartes en main.
   * @public
   *
   * @param {string} socketId - L'ID du socket de l'entraîneur qui pioche.
   * @throws {Error} Si l'entraîneur est introuvable, si ce n'est pas son tour, ou si sa main est déjà pleine.
   */
  public drawCards(socketId: string): void {
    // 1. Vérifier que l'entraîneur existe
    const trainer = this.trainers.get(socketId)
    if (!trainer) throw new Error('Entraîneur introuvable')

    // 2. Vérifier que c'est le tour de l'entraîneur
    if (this.turn !== socketId) throw new Error('Halte ! attendez votre tour !')

    // 3. Vérifier que la main n'est pas déjà pleine
    if (trainer.handCards.length >= 5)
      throw new Error('Main pleine (5 cartes maximum)')

    // 4. Piocher des cartes jusqu'à avoir 5 cartes en main ou jusqu'à épuiser le deck
    while (trainer.handCards.length < 5 && trainer.deckCards.length > 0) {
      // Shift() permet de retirer la première carte du deck et de la retourner. Étant donné que le deck a été mélangé au préalable, cela simule une pioche aléatoire.
      const card = trainer.deckCards.shift()!
      trainer.handCards.push(card) // Ajouter la carte piochée à la main de l'entraîneur
    }
  }

  /**
   * @description Méthode pour gérer l'événement `playCard` -> jouer une carte de la main sur le terrain.
   * @public
   *
   * @param {string} socketId - L'ID du socket de l'entraîneur qui joue la carte.
   * @param {number} cardIndex - L'index de la carte dans la main de l'entraîneur (0 à 4).
   * @returns {ClientGameState} L'état de jeu du point de vue de l'entraîneur.
   * @throws {Error} Si l'entraîneur est introuvable, si ce n'est pas son tour, ou si la carte n'est pas en main.
   */
  public playCard(
    socketId: string,
    data: { roomId: string; cardIndex: number },
  ): ClientGameState {
    // 1. Vérifier que l'entraîneur existe
    const trainer = this.trainers.get(socketId)
    if (!trainer) throw new Error('Entraîneur introuvable')

    // 2. Vérifier que c'est le tour de l'entraîneur
    if (this.turn !== socketId) throw new Error('Halte ! attendez votre tour !')

    // 3. Vérifier qu'il n'y a pas déjà une carte active sur le terrain
    if (trainer.fieldCard !== 0)
      throw new Error('Carte déjà active sur le terrain')

    // 3. Vérifier que la carte est bien en main de l'entraîneur
    console.log("Main de l'entraîneur :", trainer.handCards)
    if (data.cardIndex < 0 || data.cardIndex >= trainer.handCards.length)
      throw new Error('Carte introuvable')

    // 4. Retirer la carte active de la main et la placer sur le terrain
    // Splice() permet de retirer la carte de la main de l'entraîneur à l'index trouvé précédemment.
    const playedCardId = trainer.handCards.splice(data.cardIndex, 1)[0]
    trainer.fieldCard = playedCardId // Placer la carte sur le terrain
    console.log('Carte à jouer (ID) :', playedCardId)

    // Trouver l'adversaire (l'autre entraîneur dans la partie)
    const opponent = [...this.trainers.values()].find(
      (o) => o.socketId !== socketId, // L'ID de socket est différent, c'est donc l'adversaire !
    )

    // Vérifier que l'adversaire existe
    if (!opponent) throw new Error('Adversaire introuvable')

    // 5. Passer le tour à l'adversaire
    this.turn = opponent.socketId

    // 6. Construire et retourner l'état de jeu du point de vue de l'entraîneur
    return {
      clientTurn: this.turn === socketId,
      clientDeckCards: [...trainer.deckCards],
      clientHandCards: [...trainer.handCards],
      clientFieldCard: trainer.fieldCard,
      clientScore: trainer.score,

      opponentFieldCard: opponent.fieldCard,
      opponentScore: opponent.score,
      opponentHandCount: opponent.handCards.length,
      opponentDeckCount: opponent.deckCards.length,
    }
  }

  // TODO: Peut-être éviter les appels à la base de données à chaque attaque ?
  /**
   * @description Méthode pour gérer l'événement `attack` -> attaque avec la carte active sur le terrain.
   * @async
   * @public
   *
   * @param {string} socketId - L'ID du socket de l'entraîneur qui attaque.
   * @returns {ClientGameState} L'état de jeu du point de vue de l'entraîneur.
   * @throws {Error} Si l'entraîneur est introuvable, si ce n'est pas son tour, si aucune carte active sur le terrain, ou si l'adversaire n'a pas de carte active.
   */
  public async attack(socketId: string): Promise<ClientGameState> {
    // Vérifier que l'entraîneur existe
    const trainer = this.trainers.get(socketId)
    if (!trainer) throw new Error('Entraîneur introuvable')

    // Vérifier que c'est le tour de l'entraîneur
    if (this.turn !== socketId) throw new Error('Halte ! attendez votre tour !')

    // Vérifier qu'il y a une carte active sur le terrain
    if (trainer.fieldCard === 0)
      throw new Error('Aucune carte active sur le terrain')

    // Trouver l'adversaire (l'autre entraîneur dans la partie)
    const opponent = [...this.trainers.values()].find(
      (o) => o.socketId !== socketId, // L'ID de socket est différent, c'est donc l'adversaire !
    )

    // Vérifier que l'adversaire existe
    if (!opponent) throw new Error('Adversaire introuvable')

    // Vérifier que l'adversaire a une carte active sur le terrain
    if (opponent.fieldCard === 0)
      throw new Error("L'adversaire n'a pas de carte active sur le terrain")

    // 1. Récupérer les cartes complètes pour lire leurs propriétés
    const trainerfieldCard = await prisma.card.findUnique({
      where: { id: trainer.fieldCard },
    })
    const opponentfieldCard = await prisma.card.findUnique({
      where: { id: opponent.fieldCard },
    })
    if (!trainerfieldCard || !opponentfieldCard)
      throw new Error('Carte active introuvable')

    // 2. Calculer les dégâts infligés par l'entraîneur à l'adversaire
    const damage = calculateDamage(
      Number(trainerfieldCard.attack || 0),
      trainerfieldCard.type as PokemonType,
      opponentfieldCard.type as PokemonType,
    )

    // 3. Soustraire les dégâts de la carte active de l'adversaire
    opponentfieldCard.hp = Number(opponentfieldCard.hp) - damage

    console.log(
      `Dégâts infligés : ${damage} (${trainerfieldCard.name} -> ${opponentfieldCard.name})`,
    )
    console.log(`HP restant de la carte adverse : ${opponentfieldCard.hp || 0}`) // Empêcher les valeurs négatives

    // 4. Vérifier si la carte active de l'adversaire est vaincue
    if (opponentfieldCard.hp <= 0) {
      opponent.fieldCard = 0 // Retirer la carte du terrain de l'adversaire
      trainer.score += 1 // L'entraîneur marque 1 point pour avoir vaincu une carte adverse
      console.log('Carte adverse vaincue !')
    }

    // 5. Passer le tour à l'adversaire
    this.turn = opponent.socketId

    // 6. Construire et retourner l'état de jeu du point de vue de l'entraîneur
    return {
      clientTurn: this.turn === socketId,
      clientDeckCards: [...trainer.deckCards],
      clientHandCards: [...trainer.handCards],
      clientFieldCard: trainer.fieldCard,
      clientScore: trainer.score,

      opponentFieldCard: opponent.fieldCard,
      opponentScore: opponent.score,
      opponentHandCount: opponent.handCards.length,
      opponentDeckCount: opponent.deckCards.length,
    }
  }

  /**
   * @description Méthode pour gérer l'événement `endTurn` -> passer le tour à l'adversaire.
   * @public
   *
   * @param {string} socketId - L'ID du socket de l'entraîneur qui termine son tour.
   * @return {ClientGameState} L'état de jeu du point de vue de l'entraîneur.
   * @throws {Error} Si l'entraîneur est introuvable, ou si ce n'est pas son tour.
   */
  public endTurn(socketId: string): ClientGameState {
    // Vérifier que l'entraîneur existe
    const trainer = this.trainers.get(socketId)
    if (!trainer) throw new Error('Entraîneur introuvable')

    // Vérifier que c'est le tour de l'entraîneur
    if (this.turn !== socketId) throw new Error('Halte ! attendez votre tour !')

    // Trouver l'adversaire (l'autre entraîneur dans la partie)
    const opponent = [...this.trainers.values()].find(
      (o) => o.socketId !== socketId, // L'ID de socket est différent, c'est donc l'adversaire !
    )

    // Vérifier que l'adversaire existe
    if (!opponent) throw new Error('Adversaire introuvable')

    // Passer le tour à l'adversaire
    this.turn = opponent.socketId

    // Construire et retourner l'état de jeu du point de vue de l'entraîneur
    return {
      clientTurn: this.turn === socketId,
      clientDeckCards: [...trainer.deckCards],
      clientHandCards: [...trainer.handCards],
      clientFieldCard: trainer.fieldCard,
      clientScore: trainer.score,

      opponentFieldCard: opponent.fieldCard,
      opponentScore: opponent.score,
      opponentHandCount: opponent.handCards.length,
      opponentDeckCount: opponent.deckCards.length,
    } // Extrait du ticket n°11 : "L'état du jeu contient l'information sur le joueur actuel (`currentPlayerSocketId`)" => wtf do you mean? UwU
  }

  /**
   * @description Méthode pour gérer l'état de jeu pour un entraîneur donné.
   * La main et le deck de l'adversaire ne sont jamais exposés.
   * @public
   *
   * @param {string} socketId - L'ID du socket de l'entraîneur.
   * @returns {ClientGameState} L'état de jeu du point de vue de l'entraîneur.
   * @throws {Error} Si l'entraîneur ou l'adversaire est introuvable.
   */
  public getGameStateFor(socketId: string): ClientGameState {
    // 1. Vérifier que l'entraîneur existe
    const trainer = this.trainers.get(socketId)
    if (!trainer) throw new Error('Entraîneur introuvable')

    // 2. Trouver l'adversaire (l'autre entraîneur dans la partie)
    const opponent = [...this.trainers.values()].find(
      (o) => o.socketId !== socketId, // L'ID de socket est différent, c'est donc l'adversaire !
    )

    // 3. Vérifier que l'adversaire existe
    if (!opponent) throw new Error('Adversaire introuvable')

    // 4. Construire et retourner l'état de jeu du point de vue de l'entraîneur
    return {
      clientTurn: this.turn === socketId,
      clientDeckCards: [...trainer.deckCards],
      clientHandCards: [...trainer.handCards],
      clientFieldCard: trainer.fieldCard,
      clientScore: trainer.score,

      opponentFieldCard: opponent.fieldCard,
      opponentScore: opponent.score,
      opponentHandCount: opponent.handCards.length,
      opponentDeckCount: opponent.deckCards.length,
    }
  }

  /**
   * @description Retourne les IDs de socket de tous les entraîneurs de la partie.
   * @public
   *
   * @returns {string[]} La liste des IDs de socket des entraîneurs.
   */
  public getTrainerSocketIds(): string[] {
    return [...this.trainers.keys()]
  }
}
