// routes/email.js
const express = require("express");
const nodemailer = require("nodemailer");
const router = express.Router();

router.post("/send", async (req, res) => {
  try {
    const { to, subject, html } = req.body;

    const transporter = nodemailer.createTransport({
      host: "globalcityre.ae",
      port: "465",
      secure: "true",
      auth: {
        user: "contact@globalcityre.ae",
        pass: ".0JGY]rE8{?b",
      },
    });

    const info = await transporter.sendMail({
      from: "contact@globalcityre.ae",
      to,
      subject,
      html,
    });

    res.status(200).json({
      success: true,
      messageId: info.messageId,
    });
  } catch (error) {
    console.error("Email sending failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
