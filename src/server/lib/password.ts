import { compare, hash } from "bcryptjs";

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, 12);
}

export function verifyPassword(plain: string, passwordHash: string | null): Promise<boolean> {
  if (passwordHash === null) {
    return Promise.resolve(false);
  }
  // bcryptjs は Laravel の $2y$ 接頭辞を受け付けないため、同じ bcrypt 形式へ直す。
  return compare(plain, passwordHash.replace(/^\$2y\$/, "$2b$"));
}
