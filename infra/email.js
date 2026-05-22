import nodemailer from "nodemailer";
import { ServiceError } from "./errors";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SMTP_HOST,
  port: process.env.EMAIL_SMTP_PORT,
  auth: {
    user: process.env.EMAIL_SMTP_USER,
    pass: process.env.EMAIL_SMTP_PASSWORD,
  },
  secure: process.env.NODE_ENV == "production" ? true : false,
});

async function send(mailOptions) {
  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    throw new ServiceError({
      message: "Failed to send email",
      action: "Try again later or check the email service status",
      cause: error,
      context: mailOptions,
    });
  }
}

const email = {
  send,
};

export default email;
