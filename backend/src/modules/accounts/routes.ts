import { Router, type Request, type Response } from "express";
import { validateBody } from "../../middleware/validate";
import {
  deleteAccount,
  getAccountInfo,
  login,
  signup,
  updateAccountInfo,
} from "./service";
import {
  accountIdSchema,
  loginSchema,
  signupSchema,
  updateAccountSchema,
} from "./types";
import {
  AccountAlreadyExistsError,
  AccountInvalidCredentialsError,
  AccountNotFoundError,
} from "./errors";

const accountRouter = Router();

type RequestWithUser = Request & {
  user?: {
    accountId?: string;
  };
};

function tokenAccountId(req: Request): string | undefined {
  return (req as RequestWithUser).user?.accountId;
}

function isForbidden(req: Request, accountId: string): boolean {
  return tokenAccountId(req) !== accountId;
}

function handleError(err: unknown, res: Response): Response {
  if (err instanceof AccountAlreadyExistsError) {
    return res.status(409).json({ message: err.message });
  }
  if (err instanceof AccountInvalidCredentialsError) {
    return res.status(401).json({ message: err.message });
  }
  if (err instanceof AccountNotFoundError) {
    return res.status(404).json({ message: err.message });
  }
  console.error("Accounts error:", err);
  return res.status(500).json({ message: "Internal server error" });
}

accountRouter.post(
  "/signup",
  validateBody(signupSchema, async (_req, res, data) => {
    try {
      const result = await signup(data);
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  })
);

accountRouter.post(
  "/login",
  validateBody(loginSchema, async (_req, res, data) => {
    try {
      const result = await login(data);
      res.status(200).json(result);
    } catch (err) {
      handleError(err, res);
    }
  })
);

accountRouter.delete(
  "/delete",
  validateBody(accountIdSchema, async (req, res, data) => {
    if (isForbidden(req, data.accountId)) {
      res
        .status(403)
        .json({ message: "Forbidden: You can only delete your own account" });
      return;
    }

    try {
      await deleteAccount(data.accountId);
      res.status(200).json({ message: "Account deleted successfully" });
    } catch (err) {
      handleError(err, res);
    }
  })
);

accountRouter.get(
  "/info",
  validateBody(accountIdSchema, async (req, res, data) => {
    if (isForbidden(req, data.accountId)) {
      res.status(403).json({ message: "Forbidden: Access denied" });
      return;
    }

    try {
      const account = await getAccountInfo(data.accountId);
      res.status(200).json({ account });
    } catch (err) {
      handleError(err, res);
    }
  })
);

accountRouter.put(
  "/update",
  validateBody(updateAccountSchema, async (req, res, data) => {
    if (isForbidden(req, data.accountId)) {
      res.status(403).json({ message: "Forbidden: Access denied" });
      return;
    }

    try {
      const result = await updateAccountInfo(data);
      res.status(200).json({
        message: "Account updated successfully",
        account: result.account,
        ...(result.token ? { token: result.token } : {}),
      });
    } catch (err) {
      handleError(err, res);
    }
  })
);

export default accountRouter;
