//account mongoose model
import mongoose from 'mongoose';
const { Schema } = mongoose;
import { v4 as uuidv4 } from 'uuid';

/*
email, passwordHash, firstName, lastName, 
iban, ibanHolderName, deletedAt
are not set to required because of soft deletion
*/
const accountSchema = new Schema(
    {
    accountId: {
      type: String,
      required: true,
      unique: true,
      default: uuidv4 //generates a unique UUID for each account automatically
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
    }
  },
  {
    timestamps: true //includes createdAt and updatedAt
  }
);

const Account = mongoose.model('Account', accountSchema);

export default Account;