import jwt from "jsonwebtoken";
import { parse } from "cookie";
import { User } from "../models/index.js";
import { AppError, assert } from "./errors.js";

export const publicUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
});
export function authentication(config) {
  async function fromToken(token) {
    let payload;
    try {
      payload = jwt.verify(token || "", config.jwtSecret, {
        algorithms: ["HS256"],
        issuer: "printflow",
      });
    } catch {
      throw new AppError(401, "Your session expired. Please sign in");
    }
    const user = await User.findById(payload.sub);
    assert(user, 401, "Please sign in");
    return { user, expiresAt: payload.exp * 1000 };
  }
  const cookieOptions = {
    httpOnly: true,
    secure: config.production,
    sameSite: "lax",
    path: "/",
  };
  return {
    required: async (req, res, next) => {
      req.user = (await fromToken(req.cookies.session)).user;
      next();
    },
    socket: async (socket, next) => {
      try {
        const session = await fromToken(
          parse(socket.request.headers.cookie || "").session,
        );
        socket.user = session.user;
        socket.sessionExpiresAt = session.expiresAt;
        next();
      } catch {
        next(new Error("Please sign in"));
      }
    },
    setSession(res, user) {
      const token = jwt.sign({}, config.jwtSecret, {
        subject: String(user._id),
        issuer: "printflow",
        algorithm: "HS256",
        expiresIn: "8h",
      });
      res.cookie("session", token, {
        ...cookieOptions,
        maxAge: 8 * 60 * 60 * 1000,
      });
    },
    clearSession(res) {
      res.clearCookie("session", cookieOptions);
    },
  };
}
export const roles =
  (...allowed) =>
  (req, res, next) => {
    assert(
      allowed.includes(req.user.role),
      403,
      "This action requires a staff account",
    );
    next();
  };
export function sameOrigin(req, res, next) {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    if (origin) {
      let originHost;
      try {
        originHost = new URL(origin).host;
      } catch {
        throw new AppError(403, "Invalid origin");
      }
      assert(
        originHost === req.get("host"),
        403,
        "Cross-origin requests are not allowed",
      );
    }
    assert(
      req.get("sec-fetch-site") !== "cross-site",
      403,
      "Cross-site requests are not allowed",
    );
  }
  next();
}
