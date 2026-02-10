import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Nodemailer from "next-auth/providers/nodemailer";
import { authConfig } from "@/src/lib/auth.config";
import { prisma } from "@/src/lib/prisma";

const emailServer = process.env.EMAIL_SERVER ?? process.env.SMTP_URL;
const emailProviders = [
  ...authConfig.providers,
  ...(emailServer
    ? [
        Nodemailer({
          server: emailServer,
          from: process.env.EMAIL_FROM ?? process.env.EMAIL_FROM_ADDRESS ?? "noreply@localhost",
        }),
      ]
    : []),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: emailProviders,
});
