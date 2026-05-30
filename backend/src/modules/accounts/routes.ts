import { Router, type Request, type Response } from "express";
import { validateBody } from "../../middleware/validate";
import { authAccount } from "../../middleware/authAccount";
import {
  deleteAccount,
  getAccountInfo,
  login,
  signup,
  updateAccountInfo,
} from "./service";
import { loginSchema, signupSchema, updateAccountSchema } from "./types";
import {
  AccountAlreadyExistsError,
  AccountInvalidCredentialsError,
  AccountNotFoundError,
} from "./errors";

const accountRouter = Router();

function tokenAccountId(req: Request): string | undefined {
  return req.user?.accountId;
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

// Public — no auth.
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

// Public — no auth.
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

// Protected — the account to act on comes from the verified token, never the body.
accountRouter.delete("/delete", authAccount, async (req, res) => {
  const accountId = tokenAccountId(req);
  if (!accountId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  try {
    await deleteAccount(accountId);
    res.status(200).json({ message: "Account deleted successfully" });
  } catch (err) {
    handleError(err, res);
  }
});

accountRouter.get("/info", authAccount, async (req, res) => {
  const accountId = tokenAccountId(req);
  if (!accountId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  try {
    const account = await getAccountInfo(accountId);
    res.status(200).json({ account });
  } catch (err) {
    handleError(err, res);
  }
});

accountRouter.put(
  "/update",
  authAccount,
  validateBody(updateAccountSchema, async (req, res, data) => {
    const accountId = tokenAccountId(req);
    if (!accountId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    try {
      const result = await updateAccountInfo(accountId, data);
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
