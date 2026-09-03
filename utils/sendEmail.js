// utils/sendEmail.js
const nodemailer = require('nodemailer');

// Create reusable transporter
const transporter = nodemailer.createTransport({
  service: 'gmail', // Change to your provider if not Gmail
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * Send an HTML email
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - HTML content
 * @returns {Promise} - Nodemailer send result
 */
async function sendEmail(to, subject, html) {
  try {
    const info = await transporter.sendMail({
      from: `"KABARAK SOKO" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });
    console.log(`✅ Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
    throw error;
  }
}

/**
 * Send a plain text email
 * @param {string} to - Recipient email
 * @param {string} subject - Subject
 * @param {string} text - Plain text content
 * @returns {Promise}
 */
async function sendPlainEmail(to, subject, text) {
  try {
    const info = await transporter.sendMail({
      from: `"KABARAK SOKO" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text
    });
    console.log(`✅ Plain email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('❌ Plain email sending failed:', error.message);
    throw error;
  }
}

module.exports = {
  sendEmail,
  sendPlainEmail
};