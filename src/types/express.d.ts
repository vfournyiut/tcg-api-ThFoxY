import "express";
import { Request } from "express";

/**
 * @description Extension de l'interface Request globale d'Express pour y inclure l'utilisateur authentifié.
 * @interface Request
 * @property {number} userId - L'ID de l'utilisateur authentifié.
 * @property {string} email - L'email de l'utilisateur authentifié.
 */
declare module "express" {
  interface Request {
    user?: {
      userId: number;
      email: string;
    };
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
  email: string;
  password: string;
  username: string;
}

/**
 * @description Type personnalisé utilisant SignUpRequestBody.
 * @extends Request
 */
export interface SignUpRequest extends Request<{}, any, SignUpRequestBody> {}

/**
 * @description Typage pour la requête POST /sign-in.
 * @interface SignUpRequestBody
 * @property {string} email - L'email de l'utilisateur.
 * @property {string} username - Le nom d'utilisateur de l'utilisateur.
 */
export interface SignInRequestBody {
  email: string;
  password: string;
}

/**
 * @description Type personnalisé utilisant SignInRequestBody.
 * @extends Request
 */
export interface SignInRequest extends Request<{}, any, SignInRequestBody> {}
