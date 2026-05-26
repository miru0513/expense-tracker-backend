const nodemailer = require('nodemailer');

const hasSmtp = !!(process.env.SMTP_USER && process.env.SMTP_PASS);

const transporter = hasSmtp
  ? nodemailer.createTransport({
      host:   process.env.SMTP_HOST || 'smtp.gmail.com',
      port:   parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

const sendPasswordResetEmail = async (email, resetLink) => {
  if (!hasSmtp) {
    // Dev mode — print to console so you can test without a real mail server
    console.log('\n────────────────────────────────────────');
    console.log(`[Email] Password reset for: ${email}`);
    console.log(`[Email] Open this link:     ${resetLink}`);
    console.log('────────────────────────────────────────\n');
    return;
  }

  await transporter.sendMail({
    from:    `SmartSpend <${process.env.SMTP_USER}>`,
    to:      email,
    subject: 'Reset your SmartSpend password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Password Reset</h2>
        <p>Click the button below to reset your password. The link expires in <strong>1 hour</strong>.</p>
        <a href="${resetLink}" style="display:inline-block;padding:12px 24px;background:#7c3aed;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">
          Reset Password
        </a>
        <p style="margin-top:24px;color:#6b7280;font-size:13px">If you didn't request this, you can ignore this email.</p>
      </div>
    `,
  });
};

const sendLoginOtpEmail = async (email, code) => {
  if (!hasSmtp) {
    console.log('\n────────────────────────────────────────');
    console.log(`[Email] Login OTP for: ${email}`);
    console.log(`[Email] Code: ${code}`);
    console.log('────────────────────────────────────────\n');
    return;
  }

  await transporter.sendMail({
    from:    `SmartSpend <${process.env.SMTP_USER}>`,
    to:      email,
    subject: 'Your SmartSpend login code',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Login Verification Code</h2>
        <p>Use the code below to complete your login. It expires in <strong>10 minutes</strong>.</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#7c3aed;margin:24px 0;text-align:center">
          ${code}
        </div>
        <p style="color:#6b7280;font-size:13px">If you didn't attempt to log in, you can ignore this email.</p>
      </div>
    `,
  });
};

module.exports = { sendPasswordResetEmail, sendLoginOtpEmail };
