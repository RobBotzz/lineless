export interface Account {
  accountId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  iban: string | null;
  ibanHolderName: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface SignupInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface UpdateAccountInput {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  iban?: string | null;
  ibanHolderName?: string | null;
}
