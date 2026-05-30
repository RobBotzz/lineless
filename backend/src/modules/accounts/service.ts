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

export const deleteAccount = async (req: Request, res: Response) => {
    try {
        const { accountId } = req.body;
        
        // @ts-ignore (Extract accountId from verified JWT payload via middleware)
        const tokenAccountId = req.user?.accountId; 

        if (!accountId) {
            return res.status(400).json({ message: "Account ID is required in body" });
        }

        // Security check: Match token ID with requested body ID
        if (tokenAccountId !== accountId) {
            return res.status(403).json({ message: "Forbidden: You can only delete your own account" });
        }

        // Anonymize account data and set deletion date
        const updatedAccount = await Account.findOneAndUpdate(
            { accountId, deletedAt: null },
            {
                $set: { deletedAt: new Date() },
                $unset: {
                    email: 1,
                    passwordHash: 1,
                    firstName: 1,
                    lastName: 1,
                    iban: 1,
                    ibanHolderName: 1
                }
            },
            { new: true }
        );

        if (!updatedAccount) {
            return res.status(404).json({ message: "Account not found" });
        }

        return res.status(200).json({ message: "Account deleted successfully" });

    } catch (error) {
        console.error("Delete Error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const getAccountInfo = async (req: Request, res: Response) => {
    try {
               
        const { accountId } = req.body;
        // @ts-ignore (Extract accountId from verified JWT payload via middleware)
        const tokenAccountId = req.user?.accountId;

        if (!accountId) {
            return res.status(400).json({ message: "Account ID is required" });
        }

        // Security check: Match token ID with requested body ID
        if (tokenAccountId !== accountId) {
            return res.status(403).json({ message: "Forbidden: Access denied" });
        }

        // Find active account and exclude passwordHash from the result
        const account = await Account.findOne({ accountId, deletedAt: null }).select('-passwordHash');

        if (!account) {
            return res.status(404).json({ message: "Account not found" });
        }

        return res.status(200).json({ account });

    } catch (error) {
        console.error("Get Account Info Error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const updateAccountInfo = async (req: Request, res: Response) => {
    try {
        const { accountId, email, password, firstName, lastName, iban, ibanHolderName } = req.body;
        
        // @ts-ignore
        const tokenAccountId = req.user?.accountId;

        if (!accountId) {
            return res.status(400).json({ message: "Account ID is required" });
        }

        // Security check
        if (tokenAccountId !== accountId) {
            return res.status(403).json({ message: "Forbidden: Access denied" });
        }

        const account = await Account.findOne({ accountId, deletedAt: null });
        if (!account) {
            return res.status(404).json({ message: "Account not found" });
        }

        const updates: any = {};

        // Map optional profile fields
        if (firstName !== undefined) updates.firstName = firstName;
        if (lastName !== undefined) updates.lastName = lastName;
        if (iban !== undefined) updates.iban = iban;
        if (ibanHolderName !== undefined) updates.ibanHolderName = ibanHolderName;

        // Validate and update email
        if (email && email !== account.email) {
            if (!emailCheck(email)) {
                return res.status(400).json({ message: "Invalid email format" });
            }
            const emailExists = await Account.findOne({ email, deletedAt: null });
            if (emailExists) {
                return res.status(409).json({ message: "Email already registered" });
            }
            updates.email = email;
        }

        // Validate and hash new password
        if (password) {
            if (!passwordCheck(password)) {
                return res.status(400).json({ message: "Invalid password format" });
            }
            updates.passwordHash = await hashPassword(password);
        }

        const updatedAccount = await Account.findOneAndUpdate(
            { accountId, deletedAt: null },
            { $set: updates },
            { new: true }
        ).select('-passwordHash');

        if (!updatedAccount) {
            return res.status(404).json({ message: "Account not found" });
        }

        // Generate new token if email changed
        let token: string | undefined = undefined;
        if (updates.email) {
            token = generateToken(updatedAccount.accountId, updatedAccount.email!);
        }

        return res.status(200).json({
            message: "Account updated successfully",
            account: updatedAccount,
            ...(token && { token })
        });

    } catch (error) {
        console.error("Update Account Info Error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};