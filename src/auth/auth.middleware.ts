import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'

// Étendre le type Request (@see src/types/express.d.ts)

/**
 * @description Middleware d'authentification JWT chargé de valider le jeton présent les en-têtes Authorization des requêtes.
 * Si le jeton est valide, les informations de l'utilisateur sont injectées dans l'objet `req.user`.
 *
 * @param {SignInRequest} req - L'objet de requête contenant l'en-tête Authorization.
 * @param {Response} res - L'objet de réponse.
 * @param {NextFunction} next - Le callback pour passer au middleware ou à la route suivante.
 *
 * @returns {Response | void} Renvoie une réponse HTTP 401 si le jeton est manquant ou invalide, sinon ne renvoie rien et appelle next().
 * @throws {401} Renvoie une erreur HTTP 401 si le jeton est manquant ou invalide.
 */
export const authentificateToken = (
  req: Request,
  res: Response,
  next: NextFunction,
): Response | void => {
  // 1. Récupérer le token depuis l'en-tête Authorization
  const authHeader = req.headers.authorization
  const token = authHeader && authHeader.split(' ')[1] // Format: "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ error: 'Token manquant' })
  }

  try {
    // 2. Vérifier et décoder le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      userId: number
      email: string
    }

    if (!decoded) {
      return res.status(401).json({ error: 'Token invalide ou expiré' })
    }

    // 3. Ajouter userId à la requête pour l'utiliser dans les routes
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    }

    // 4. Passer au prochain middleware ou à la route
    next()
  } catch (_error) {
    return res.status(401).json({ error: 'Token invalide ou expiré' })
  }
}
