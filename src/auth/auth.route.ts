import bcrypt from 'bcryptjs'
import { Response, Router } from 'express'
import jwt from 'jsonwebtoken'

import { prisma } from '../../src/database'
import { SignInRequest,SignUpRequest } from '../types/express'

// Création du router pour l'authentification
export const authRouter = Router()

/**
 * @async
 * @description Enregistre un nouvel utilisateur après vérification des contraintes d'unicité.
 *
 * @param {SignInRequest} req - L'objet de requête contenant l'email, le username et le password.
 * @param {Response} res - L'objet de réponse.
 *
 * @returns {Promise<Response>} Renvoie une réponse HTTP 201 si l'inscription réussie, avec le token JWT et les infos utilisateur.
 * @throws {400} Renvoie une erreur HTTP 400 si les champs obligatoires sont manquants.
 * @throws {409} Renvoie une erreur HTTP 409 si l'email ou le username existe déjà.
 * @throws {500} Renvoie une erreur HTTP 500 si une erreur se produit.
 */
authRouter.post('/sign-up', async (req: SignUpRequest, res: Response) => {
  // Destructuration : extrait les champs email, username et password de la requête POST pour en faire des variables distinctes
  const { email, username, password } = req.body

  try {
    // 0. Vérifier que tous les champs sont remplis
    if (!email || !username || !password) {
      return res.status(400).json({ error: 'Données manquantes' })
    }

    // 1. Vérifier que l'utilisateur n'existe pas déjà (username unique)
    const existingUsername = await prisma.user.findUnique({
      where: { username },
    })

    if (existingUsername) {
      return res.status(409).json({ error: "Nom d'utilisateur déjà utilisé" })
    }

    // 2. Vérifier que l'utilisateur n'existe pas déjà (email unique)
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    })

    if (existingEmail) {
      return res.status(409).json({ error: 'Email déjà utilisé' })
    }

    // 3. Hacher le mot-de-passe
    const hashedPassword = await bcrypt.hash(password, 10)

    // 4. Créer l'utilisateur
    const newUser = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
      },
    })

    // 5. Générer le JWT (https://www.npmjs.com/package/jsonwebtoken)
    const token = jwt.sign(
      {
        userId: newUser.id,
        email: newUser.email,
      },
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' },
    )

    // 6. Retourner les infos de l'utilisateur
    return res.status(201).json({
      message: 'Inscription réussie',
      token,
      user: {
        email: newUser.email,
        username: newUser.username,
      },
    })
  } catch (error) {
    console.error('Error when signing up:', error)
    return res.status(500).json({ error: 'Server error' })
  }
})

/**
 * @async
 * @description Authentifie un utilisateur existant et génère un jeton JWT.
 *
 * @param {SignInRequest} req - L'objet de requête contenant l'email et le password.
 * @param {Response} res - L'objet de réponse.
 *
 * @returns {Promise<Response>} Renvoie une réponse HTTP 200 si la connexion réussie, avec le token JWT et les infos utilisateur.
 * @throws {400} Renvoie une erreur HTTP 400 si les champs obligatoires sont manquants.
 * @throws {401} Renvoie une erreur HTTP 401 si l'email ou le password est incorrect.
 * @throws {500} Renvoie une erreur HTTP 500 si une erreur se produit.
 */
authRouter.post('/sign-in', async (req: SignInRequest, res: Response) => {
  // Destructuration : extrait les champs email et password de la requête POST pour en faire des variables distinctes
  const { email, password } = req.body

  try {
    // 0. Vérifier que tous les champs sont remplis
    if (!email || !password) {
      return res.status(400).json({ error: 'Données manquantes' })
    }

    // 1. Vérifier que l'utilisateur existe
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (!existingUser) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' })
    }

    // 2. Vérifier le mot-de-passe
    const isPasswordValid = await bcrypt.compare(
      password,
      existingUser.password,
    )

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' })
    }

    // 3. Générer le JWT (https://www.npmjs.com/package/jsonwebtoken)
    const token = jwt.sign(
      {
        userId: existingUser.id,
        email: existingUser.email,
      },
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' },
    )

    // 4. Retourner les infos de l'utilisateur
    return res.status(200).json({
      message: 'Connexion réussie',
      token,
      user: {
        userId: existingUser.id,
        email: existingUser.email,
        username: existingUser.username,
      },
    })
  } catch (error) {
    console.error('Error when signing in:', error)
    return res.status(500).json({ error: 'Server error' })
  }
})
