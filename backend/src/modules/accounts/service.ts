import { Request, Response } from 'express';
import { emailCheck, passwordCheck, generateToken, hashPassword, comparePassword } from './helper';
import Account from './model';

export const signup = async (req: Request, res: Response) => {
    try {
        const { email, password, firstName, lastName } = req.body;

        // 1. Validations
        if (!emailCheck(email)) {
            return res.status(400).json({ message: "Invalid email format" });
        }
        if (!passwordCheck(password)) {
            return res.status(400).json({ message: "Invalid password format" });
        }

        // 2. Check if email already exists
        const existingAccount = await Account.findOne({ email });
        if (existingAccount) {
            return res.status(409).json({ message: "Email already registered" });
        }

        // 3. Hash password
        const hashedPassword = await hashPassword(password);

        // 4. Create new account in DB
        const newAccount = await Account.create({
            email,
            passwordHash: hashedPassword,
            firstName,
            lastName
        });

        // 5. Generate JWT Token
        const token = generateToken(newAccount.accountId, newAccount.email);

        // 6. Return token to client
        return res.status(201).json({
            message: "Account created successfully",
            token: token
        });

    } catch (error) {
        console.error("Signup Error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        // 1. Search for account by email
        const account = await Account.findOne({ email }); 
        if (!account) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        // 2. Check if password is correct
        if (!account.passwordHash) {
            return res.status(401).json({ message: "Invalid email or password" });
        }
        const isPasswordValid = await comparePassword(password, account.passwordHash);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        // 3. Generate JWT Token
        const token = generateToken(account.accountId, account.email);

        // 4. Return token to client
        return res.status(200).json({
            message: "Login successful",
            token: token
        });

    } catch (error) {
        console.error("Login Error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
//TODO: Delete Account (remove everything except UUID), Update Account, Get Account Details.