import { v4 as uuidv4 } from "uuid";
import { model, Schema } from "mongoose";

/*
email, passwordHash, firstName, lastName, 
iban, ibanHolderName, deletedAt
are not set to required because of soft deletion
*/
export interface AccountDoc {
  accountId: string;
  email?: string;
  passwordHash?: string;
  firstName?: string;
  lastName?: string;
  iban: string | null;
  ibanHolderName: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const accountSchema = new Schema<AccountDoc>(
  {
    accountId: {
      type: String,
      required: true,
      unique: true,
      default: () => uuidv4(),
    },
    email: {
      type: String,
      unique: true,
      trim: true
    },
    passwordHash: {
      type: String
    },
    firstName: {
      type: String
    },
    lastName: {
      type: String
    },
    iban: {
      type: String,
      default: null
    },
    ibanHolderName: {
      type: String,
      default: null
    },
    deletedAt: {
      type: Date,
      required: false,
      default: null
    },
  },
  {
    timestamps: true,
  }
);

export const Account = model<AccountDoc>("Account", accountSchema);
