import crypto from "node:crypto";
import argon2 from "argon2";
import { z } from "zod";
import { parseRemote } from "../shared/launch.js";

export const hashPassword = (password) =>
  argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });

export const verifyPassword = (hash, password) => argon2.verify(hash, password);
export const token = (bytes = 32) =>
  crypto.randomBytes(bytes).toString("base64url");
export const digest = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

export const passwordSchema = z
  .string()
  .min(14, "Password must be at least 14 characters.")
  .max(128, "Password must be at most 128 characters.")
  .refine(
    (s) => /[a-z]/.test(s) && /[A-Z]/.test(s) && /[0-9]/.test(s),
    "Password must include uppercase, lowercase, and a number.",
  );

export function createVault(secret, salt) {
  if (!secret) {
    throw new Error("VAULT_SECRET must contain at least 32 characters.");
  }
  const key = crypto.scryptSync(secret, salt, 32, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return {
    encrypt(value, context = "default") {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
      cipher.setAAD(Buffer.from(context, "utf8"));
      const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(value), "utf8"),
        cipher.final(),
      ]);
      return [iv, cipher.getAuthTag(), encrypted]
        .map((b) => b.toString("base64url"))
        .join(".");
    },
    decrypt(value, context = "default") {
      if (!value) return null;
      const parts = value.split(".").map((s) => Buffer.from(s, "base64url"));
      if (parts.length !== 3) throw new Error("Invalid vault payload format.");
      const [iv, tag, encrypted] = parts;
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAAD(Buffer.from(context, "utf8"));
      decipher.setAuthTag(tag);
      return JSON.parse(
        Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
          "utf8",
        ),
      );
    },
  };
}

export function validCustomIcon(value) {
  if (typeof value !== "string") return false;
  if (value.startsWith("data:image/png;base64,")) {
    try {
      const buf = Buffer.from(value.split(",")[1], "base64");
      return buf
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    } catch {
      return false;
    }
  }
  if (!value.startsWith("data:image/svg+xml;base64,")) return false;
  try {
    const svg = Buffer.from(value.split(",")[1], "base64").toString("utf8");
    return (
      /^\s*<svg[\s>]/i.test(svg) &&
      !/<(?:script|foreignObject|iframe|style|image|use|animate|set)|\bon\w+\s*=|(?:href|src)\s*=|<!|url\s*\(/i.test(
        svg,
      )
    );
  } catch {
    return false;
  }
}

export const entrySchema = z
  .object({
    name: z.string().trim().min(1, "Name is required.").max(80),
    address: z.string().trim().min(1, "Address is required.").max(2048),
    category: z.string().trim().min(1, "Category is required.").max(50),
    icon: z.string().max(300000).default("server"),
    description: z.string().max(400).default(""),
    method: z.enum(["web", "rdp", "anydesk", "rustdesk", "ssh"]).default("web"),
    access: z.array(z.number().int().positive()).max(500).default([]),
    credentials: z
      .object({
        username: z.string().max(256).default(""),
        password: z.string().max(4096).default(""),
      })
      .optional(),
    clearCredentials: z.boolean().optional(),
  })
  .superRefine((e, ctx) => {
    if (["ssh", "rdp"].includes(e.method)) {
      try {
        parseRemote(e.address, e.method);
      } catch (error) {
        ctx.addIssue({
          code: "custom",
          message: error.message,
          path: ["address"],
        });
      }
    }
    if (e.method === "web") {
      try {
        const u = new URL(e.address);
        if (
          !["http:", "https:"].includes(u.protocol) ||
          u.username ||
          u.password
        )
          throw Error();
      } catch {
        ctx.addIssue({
          code: "custom",
          message:
            "Enter a valid HTTP(S) URL (e.g. https://cpanel.example.com:2083).",
          path: ["address"],
        });
      }
    } else if (e.method === "ssh") {
      if (
        !/^(?:[a-zA-Z0-9_.-]+@)?(?:[a-zA-Z0-9.-]+|\[[a-fA-F0-9:]+\])(?::\d{1,5})?$/.test(
          e.address,
        )
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Use format: host, host:port, or user@host:port",
          path: ["address"],
        });
      }
    } else if (e.method === "rdp") {
      if (!/^[a-zA-Z0-9.-]+(?::\d{1,5})?$/.test(e.address)) {
        ctx.addIssue({
          code: "custom",
          message: "Use format: hostname or host:3389",
          path: ["address"],
        });
      }
    } else if (!/^[a-zA-Z0-9 _-]{3,100}$/.test(e.address)) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a valid remote ID or alias.",
        path: ["address"],
      });
    }

    if (!/^[a-z0-9-]+$/.test(e.icon) && !validCustomIcon(e.icon)) {
      ctx.addIssue({
        code: "custom",
        message: "Invalid icon identifier or format.",
        path: ["icon"],
      });
    }
  });
