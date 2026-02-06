import 'express';
import { Request } from 'express';

declare module 'express' {
    interface Request {
        user?: {
            userId: number;
            email: string;
        };
    }
}

// Typage pour la requête POST /sign-up
export interface SignUpRequestBody {
    email: string;
    password: string;
    username: string;
}

export interface SignUpRequest extends Request<{}, any, SignUpRequestBody> {}

// Typage pour la requête POST /sign-in
export interface SignInRequestBody {
    email: string;
    password: string;
}

export interface SignInRequest extends Request<{}, any, SignInRequestBody> {}
