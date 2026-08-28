import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const secret = process.env.JWT_SECRET || "prototype-secret";

export interface AuthRequest extends Request {
  user?: { id: string; role: "farmer" | "officer"; farmerId?: string };
}

export function auth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "Authentication required" });

  try {
    req.user = jwt.verify(token, secret) as AuthRequest["user"];
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function role(...roles: Array<"farmer" | "officer">) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have permission for this action" });
    }
    next();
  };
}
