import { handlers } from "@/src/lib/auth";

export const { GET, POST } = handlers;

// Vynucení Node.js runtime – Nodemailer provider používá modul 'stream', který Edge nepodporuje.
export const runtime = "nodejs";
