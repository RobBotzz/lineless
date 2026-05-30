import jwt, { type SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { config } from '../../config/config';

const JWT_SECRET = config.jwt.secret;
const TOKEN_EXPIRATION = config.jwt.expiresIn as SignOptions["expiresIn"];

export const emailCheck = (email: string): boolean => {
  if (!email) return false;
  
  // Simple email regex validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const passwordCheck = (password: string): boolean => {
  if (!password) return false;
  
  // min 8 characters, at least one letter and one number
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
  return passwordRegex.test(password);
};

/**
 * Creates a JWT token for the given account ID and email.
 */
export const generateToken = (accountId: string | undefined | null, email: string | undefined | null): string => {
  if (!accountId || !email) {
    throw new Error('Cannot generate token: missing accountId or email');
  }

  const payload = {
    sub: accountId, // "sub" ist der JWT-Standard für das Subjekt (die User-ID)
    email: email
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });
};

/**
 * Hashes a password before storing it in the database
 */
export const hashPassword = async (password: string): Promise<string> => {
    const saltRounds = config.bcryptRounds;
    return await bcrypt.hash(password, saltRounds);
};

/**
 * Compares a plaintext password with a hashed password from the DB
 */
export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
    return await bcrypt.compare(password, hash);
};