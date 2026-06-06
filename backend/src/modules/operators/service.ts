import bcrypt from "bcrypt";
import { generateOperatorToken } from "../../middleware/authOperator";
import { Stand } from "../stands/model";
import { OperatorInvalidCredentialsError } from "./errors";
import type { OperatorLoginInput } from "./types";

export interface OperatorLoginResult {
  token: string;
  standId: string;
}

export async function loginOperator(
  input: OperatorLoginInput
): Promise<OperatorLoginResult> {
  const stand = await Stand.findOne({
    _id: input.standId,
    deletedAt: null,
  }).lean();
  if (!stand?.accessPasswordHash) {
    throw new OperatorInvalidCredentialsError();
  }

  const validPassword = await bcrypt.compare(
    input.accessPassword,
    stand.accessPasswordHash
  );
  if (!validPassword) {
    throw new OperatorInvalidCredentialsError();
  }

  return {
    token: generateOperatorToken(stand._id),
    standId: stand._id,
  };
}
