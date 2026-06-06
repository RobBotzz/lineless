import { Router, type Response } from "express";
import { validateBody } from "../../middleware/validate";
import { authOrganizer } from "../../middleware/authOrganizer";
import {
  changePassword,
  deleteAccount,
  getAccountInfo,
  login,
  signup,
  updateAccountInfo,
} from "./service";
import {
  changePasswordSchema,
  loginSchema,
  signupSchema,
  updateAccountSchema,
} from "./types";
import {
  AccountAlreadyExistsError,
  AccountInvalidCredentialsError,
  AccountInvalidPasswordError,
  AccountNotFoundError,
} from "./errors";

const accountRouter = Router();

function handleError(err: unknown, res: Response): Response {
  if (err instanceof AccountAlreadyExistsError) {
    return res.status(409).json({ message: err.message });
  }
  if (err instanceof AccountInvalidCredentialsError) {
    return res.status(401).json({ message: err.message });
  }
  if (err instanceof AccountInvalidPasswordError) {
    return res.status(400).json({ message: err.message });
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

accountRouter.use(authOrganizer);

accountRouter.delete("/delete", async (req, res) => {
  try {
    await deleteAccount(req.organizer!.accountId);
    res.status(200).json({ message: "Account deleted successfully" });
  } catch (err) {
    handleError(err, res);
  }
});

accountRouter.get("/info", async (req, res) => {
  try {
    const account = await getAccountInfo(req.organizer!.accountId);
    res.status(200).json({ account });
  } catch (err) {
    handleError(err, res);
  }
});

accountRouter.patch(
  "/update",
  validateBody(updateAccountSchema, async (req, res, data) => {
    try {
      const result = await updateAccountInfo(req.organizer!.accountId, data);
      res.status(200).json({
        message: "Account updated successfully",
        account: result.account,
      });
    } catch (err) {
      handleError(err, res);
    }
  })
);

accountRouter.patch(
  "/password",
  validateBody(changePasswordSchema, async (req, res, data) => {
    try {
      const result = await changePassword(req.organizer!.accountId, data);
      res.status(200).json(result);
    } catch (err) {
      handleError(err, res);
    }
  })
);

export default accountRouter;
