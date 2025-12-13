import prisma from "./prisma";
import jwt from "jsonwebtoken";
import { generateOTP } from "./utils";
import nodemailer from "nodemailer";

const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: "SUPER_ADMIN" | "ADMIN" | "USER";
  userId?: string;
}

export async function generateToken(user: AuthUser): Promise<string> {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      userId: user.userId, // Include userId for USER role
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    return decoded;
  } catch {
    return null;
  }
}

export async function sendOTPEmail(email: string, otp: string): Promise<void> {
  // Get Email credentials from environment
  // Remove quotes if present (common in .env files)
  const emailUser = process.env.EMAIL_USER?.replace(/^["']|["']$/g, "").trim();
  const emailPassword = process.env.EMAIL_PASS?.replace(
    /^["']|["']$/g,
    ""
  ).trim();
  const emailHost = (process.env.EMAIL_HOST || "smtp.gmail.com")
    .replace(/^["']|["']$/g, "")
    .trim();
  const emailPort = parseInt(
    (process.env.EMAIL_PORT || "587").replace(/^["']|["']$/g, "")
  );
  const emailFrom = (process.env.EMAIL_FROM || emailUser)
    ?.replace(/^["']|["']$/g, "")
    .trim();

  // Check if email credentials are configured
  if (
    !emailUser ||
    !emailPassword ||
    emailUser.length === 0 ||
    emailPassword.length === 0
  ) {
    // Debug: Log what we found (without exposing password)
    const hasUser = !!process.env.EMAIL_USER;
    const hasPassword = !!process.env.EMAIL_PASS;
    const userLength = process.env.EMAIL_USER?.length || 0;
    const passwordLength = process.env.EMAIL_PASS?.length || 0;

    throw new Error(
      `Email credentials are not configured properly. EMAIL_USER: ${
        hasUser ? `found (${userLength} chars)` : "missing"
      }, EMAIL_PASS: ${
        hasPassword ? `found (${passwordLength} chars)` : "missing"
      }. Please check your .env file and restart the server.`
    );
  }

  // Create nodemailer transporter
  const transporter = nodemailer.createTransport({
    host: emailHost,
    port: emailPort,
    secure: emailPort === 465,
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    tls: {
      rejectUnauthorized: false,
    },
  });

  // Send email directly
  const appName = process.env.APP_NAME || "Application";
  const mailOptions = {
    from: `"${appName}" <${emailFrom || emailUser}>`,
    to: email,
    subject: `Your OTP Code - ${appName}`,
    text: `Your OTP code is: ${otp}. This code will expire in 10 minutes.`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); background-color: #f3f4f6;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px;">
          <tr>
            <td align="center" style="padding: 20px 0;">
              <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); padding: 40px 30px; text-align: center;">
                    <div style="width: 64px; height: 64px; background: rgba(255, 255, 255, 0.2); border-radius: 16px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px);">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 17C11.45 17 11 16.55 11 16C11 15.45 11.45 15 12 15C12.55 15 13 15.45 13 16C13 16.55 12.55 17 12 17ZM13 13H11V7H13V13Z" fill="white"/>
                      </svg>
                    </div>
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">${appName}</h1>
                    <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0; font-size: 16px;">Secure Login Verification</p>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 48px 40px; background-color: #ffffff;">
                    <h2 style="color: #1f2937; margin: 0 0 12px; font-size: 24px; font-weight: 600;">Your Verification Code</h2>
                    <p style="color: #6b7280; margin: 0 0 32px; font-size: 16px; line-height: 1.6;">Please use the following code to complete your login:</p>
                    
                    <!-- OTP Box -->
                    <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0e7ff 100%); border: 2px solid #3b82f6; border-radius: 12px; padding: 32px; text-align: center; margin: 0 0 32px;">
                      <p style="font-size: 48px; font-weight: 700; color: #3b82f6; letter-spacing: 8px; margin: 0; font-family: 'Courier New', 'Monaco', monospace; text-shadow: 0 2px 4px rgba(59, 130, 246, 0.1);">${otp}</p>
                    </div>
                    
                    <!-- Info Box -->
                    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 0 0 32px;">
                      <p style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.5;">
                        <strong style="display: block; margin-bottom: 4px;">⏰ Expires in 10 minutes</strong>
                        This code is valid for a limited time only. Do not share this code with anyone.
                      </p>
                    </div>
                    
                    <!-- Instructions -->
                    <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 0 0 24px;">
                      <p style="color: #374151; margin: 0 0 12px; font-size: 14px; font-weight: 600;">What to do next:</p>
                      <ol style="color: #6b7280; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
                        <li>Enter the code above in the login page</li>
                        <li>Complete your authentication</li>
                        <li>If you didn't request this, ignore this email</li>
                      </ol>
                    </div>
                    
                    <!-- Footer Note -->
                    <p style="color: #9ca3af; margin: 0; font-size: 12px; line-height: 1.6; text-align: center; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                      This is an automated message. Please do not reply to this email.<br>
                      If you have any concerns, please contact support.
                    </p>
                  </td>
                </tr>
                
                <!-- Bottom Bar -->
                <tr>
                  <td style="background-color: #f9fafb; padding: 20px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; margin: 0; font-size: 12px;">
                      © ${new Date().getFullYear()} ${appName}. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (sendError: any) {
    let errorMessage = "Failed to send email. ";
    if (sendError.code === "EAUTH") {
      errorMessage += "Authentication failed. Check EMAIL_USER and EMAIL_PASS.";
    } else if (sendError.code === "ECONNECTION") {
      errorMessage += `Connection failed. Check EMAIL_HOST and EMAIL_PORT.`;
    } else if (sendError.code === "ETIMEDOUT") {
      errorMessage += "Connection timeout. Check network settings.";
    } else {
      errorMessage += sendError.message || "Unknown error.";
    }
    throw new Error(errorMessage);
  }
}
