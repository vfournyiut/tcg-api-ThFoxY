/**
 * @description Extension de l'interface Request globale d'Express pour y inclure l'utilisateur authentifié.
 * @interface Request
 * @property {number} userId - L'ID de l'utilisateur authentifié.
 * @property {string} email - L'email de l'utilisateur authentifié.
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number
        email: string
      }
    }
  }
}

/**
 * @description Typage pour la requête POST /sign-up.
 * @interface SignUpRequestBody
 * @property {string} email - L'email de l'utilisateur.
 * @property {string} password - Le mot de passe de l'utilisateur (haché en backend).
 * @property {string} username - Le nom d'utilisateur de l'utilisateur.
 */
export interface SignUpRequestBody {
  email: string
  password: string
  username: string
}

/**
 * @description Type personnalisé utilisant SignUpRequestBody.
 * @extends Request
 */
export type SignUpRequest = Request<{}, {}, SignUpRequestBody>

/**
 * @description Typage pour la requête POST /sign-in.
 * @interface SignInRequestBody
 * @property {string} email - L'email de l'utilisateur.
 * @property {string} username - Le nom d'utilisateur de l'utilisateur.
 * @property {string} password - Le mot de passe de l'utilisateur (haché en backend).
 */
export interface SignInRequestBody {
  email: string
  password: string
}

/**
 * @description Type personnalisé utilisant SignInRequestBody.
 * @extends Request
 */
export type SignInRequest = Request<{}, {}, SignInRequestBody>
