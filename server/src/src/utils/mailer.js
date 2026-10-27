const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter;

function getTransporter() {
  if (!transporter) {
    if (env.smtp.host) {
      transporter = nodemailer.createTransport({
        host: env.smtp.host,
        port: env.smtp.port,
        secure: env.smtp.port === 465,
        auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
        // Fail fast if the SMTP host is unreachable; nodemailer's defaults
        // can hang a registration request for up to 2 minutes.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      });
    } else {
      // Dev fallback: no SMTP configured - emails are logged, not sent.
      transporter = nodemailer.createTransport({ jsonTransport: true });
    }
  }
  return transporter;
}

async function sendVerificationEmail(to, verifyUrl) {
  const info = await getTransporter().sendMail({
    from: env.smtp.from,
    to,
    subject: 'Verify your StaffSync account',
    text: `Welcome to StaffSync!\n\nPlease verify your email by opening this link:\n${verifyUrl}\n\nThe link expires in 5 minutes.`,
    html: `<p>Welcome to <strong>StaffSync</strong>!</p><p>Please verify your email by clicking the link below:</p><p><a href="${verifyUrl}">Verify my account</a></p><p>The link expires in 5 minutes.</p>`,
  });
  if (!env.smtp.host) {
    console.log(`[mailer] Verification link for ${to}: ${verifyUrl}`);
  }
  return info;
}

async function sendPasswordResetEmail(to, resetUrl) {
  const info = await getTransporter().sendMail({
    from: env.smtp.from,
    to,
    subject: 'Reset your StaffSync password',
    text: `A password reset was requested for your StaffSync account.\n\nOpen this link to choose a new password:\n${resetUrl}\n\nThe link expires in 30 minutes. If you did not request this, you can ignore this email.`,
    html: `<p>A password reset was requested for your <strong>StaffSync</strong> account.</p><p><a href="${resetUrl}">Choose a new password</a></p><p>The link expires in 30 minutes. If you did not request this, you can ignore this email.</p>`,
  });
  if (!env.smtp.host) {
    console.log(`[mailer] Password reset link for ${to}: ${resetUrl}`);
  }
  return info;
}

async function verifyMailer() {
  if (!env.smtp.host) {
    console.log('[mailer] SMTP_HOST not set - verification links will be logged to the console');
    return;
  }
  try {
    await getTransporter().verify();
    console.log(`[mailer] SMTP connection to ${env.smtp.host}:${env.smtp.port} verified`);
  } catch (err) {
    console.error(`[mailer] SMTP verification failed (${env.smtp.host}:${env.smtp.port}): ${err.message}`);
  }
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail, verifyMailer };
