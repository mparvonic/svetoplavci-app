declare module "nodemailer" {
  type TransportOptions = string | Record<string, unknown>;
  type MailOptions = Record<string, unknown>;

  interface Transporter {
    sendMail(options: MailOptions): Promise<unknown>;
  }

  const nodemailer: {
    createTransport(options?: TransportOptions): Transporter;
  };

  export default nodemailer;
}
