import bcrypt from "bcryptjs";

export const isBcryptHash = (value) =>
  typeof value === "string" && /^\$2[aby]\$/.test(value);

export const hashPassword = (plain) => bcrypt.hashSync(plain, 10);

export const verifyPassword = (plain, stored) =>
  isBcryptHash(stored)
    ? bcrypt.compareSync(plain, stored)
    : plain === stored;