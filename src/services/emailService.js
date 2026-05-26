const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbzbY94CzxwlqHcYuZbFu15DiWXHGCz9c1P_1JViBkO35eHnBaYn6jXXEQN1ctBOfFGEPw/exec';

const sendEmail = async (to, subject, html) => {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ to, subject, htmlMessage: html }),
  });
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    if (data.status !== 'success') throw new Error(data.error || 'Email sending failed');
  } catch {
    console.error('[Email] Apps Script response:', text.slice(0, 200));
    throw new Error('Email service unavailable');
  }
};

const sendPasswordResetEmail = async (email, resetLink) => {
  await sendEmail(
    email,
    'Reset your SmartSpend password',
    `<div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2>Password Reset</h2>
      <p>Click the button below to reset your password. The link expires in <strong>1 hour</strong>.</p>
      <a href="${resetLink}" style="display:inline-block;padding:12px 24px;background:#7c3aed;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">
        Reset Password
      </a>
      <p style="margin-top:24px;color:#6b7280;font-size:13px">If you didn't request this, you can ignore this email.</p>
    </div>`
  );
};

const sendLoginOtpEmail = async (email, code) => {
  await sendEmail(
    email,
    'Your SmartSpend login code',
    `<div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2>Login Verification Code</h2>
      <p>Use the code below to complete your login. It expires in <strong>10 minutes</strong>.</p>
      <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#7c3aed;margin:24px 0;text-align:center">
        ${code}
      </div>
      <p style="color:#6b7280;font-size:13px">If you didn't attempt to log in, you can ignore this email.</p>
    </div>`
  );
};

module.exports = { sendPasswordResetEmail, sendLoginOtpEmail };
