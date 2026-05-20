import nodemailer from 'nodemailer';
import puppeteer from 'puppeteer';

/**
 * generateReportHtml - renders a gorgeous, modern responsive HTML placement report.
 */
export const generateReportHtml = (username, profile, overallScore, aptScore, codingScore, hrPercentage) => {
  const strengthsList = (profile?.gapAnalysis?.strengths || [])
    .map(s => `<li style="margin-bottom: 8px; color: #374151; font-size: 14px;"><strong>✓</strong> ${s}</li>`)
    .join('');

  const improvementsList = (profile?.gapAnalysis?.improvements || [])
    .map(i => `<li style="margin-bottom: 8px; color: #374151; font-size: 14px;"><strong>↑</strong> ${i}</li>`)
    .join('');

  const readinessColor = (profile?.gapAnalysis?.overallReadiness || 'Moderate') === 'Strong' ? '#10B981' : '#F59E0B';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=initial-scale=1.0">
      <title>Placement Performance Report</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #F3F4F6;
          margin: 0;
          padding: 0;
          -webkit-font-smoothing: antialiased;
        }
        .container {
          max-width: 600px;
          margin: 20px auto;
          background-color: #FFFFFF;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        }
        .header {
          background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
          padding: 40px 30px;
          text-align: center;
          color: #FFFFFF;
        }
        .header h1 {
          margin: 0;
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.5px;
        }
        .header p {
          margin: 10px 0 0 0;
          font-size: 14px;
          opacity: 0.9;
          font-weight: 500;
        }
        .badge {
          display: inline-block;
          background-color: rgba(255, 255, 255, 0.2);
          padding: 6px 16px;
          border-radius: 9999px;
          font-size: 12px;
          font-weight: 700;
          margin-top: 15px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .content {
          padding: 30px;
        }
        .welcome {
          font-size: 16px;
          color: #1F2937;
          line-height: 1.5;
          margin-bottom: 25px;
        }
        .score-box {
          background-color: #EEF2FF;
          border: 1px solid #E0E7FF;
          border-radius: 20px;
          padding: 24px;
          text-align: center;
          margin-bottom: 30px;
        }
        .score-box .label {
          font-size: 12px;
          font-weight: 800;
          color: #4F46E5;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin-bottom: 5px;
        }
        .score-box .value {
          font-size: 48px;
          font-weight: 900;
          color: #1E1B4B;
          margin: 0;
        }
        .score-box .subtext {
          font-size: 13px;
          color: #6B7280;
          margin-top: 5px;
          font-weight: 500;
        }
        .grid {
          display: table;
          width: 100%;
          margin-bottom: 30px;
        }
        .grid-row {
          display: table-row;
        }
        .grid-col {
          display: table-cell;
          width: 33.33%;
          padding: 10px;
        }
        .card {
          background-color: #F9FAFB;
          border: 1px solid #F3F4F6;
          border-radius: 16px;
          padding: 15px;
          text-align: center;
        }
        .card .title {
          font-size: 11px;
          font-weight: 700;
          color: #6B7280;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .card .score {
          font-size: 20px;
          font-weight: 800;
          color: #111827;
        }
        .section-title {
          font-size: 15px;
          font-weight: 800;
          color: #111827;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 2px solid #F3F4F6;
          padding-bottom: 8px;
          margin-bottom: 15px;
        }
        .pillars-list {
          list-style: none;
          padding: 0;
          margin: 0 0 30px 0;
        }
        .footer {
          background-color: #F9FAFB;
          padding: 25px 30px;
          text-align: center;
          border-top: 1px solid #F3F4F6;
          color: #9CA3AF;
          font-size: 12px;
        }
        .footer p {
          margin: 5px 0;
        }
        .btn-action {
          display: inline-block;
          background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
          color: #FFFFFF !important;
          text-decoration: none;
          padding: 14px 28px;
          border-radius: 14px;
          font-weight: 700;
          font-size: 14px;
          margin-top: 15px;
          box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Placement Readiness Report</h1>
          <p>LMS Institutional Performance Suite</p>
          <div class="badge" style="background-color: ${readinessColor}">
            Readiness Tier: ${profile?.gapAnalysis?.overallReadiness || 'Moderate'}
          </div>
        </div>
        
        <div class="content">
          <div class="welcome">
            Hi <strong>${username}</strong>,<br>
            Congratulations on completing your comprehensive placement evaluation! Below is the detailed breakdown of your metrics and key placement indicators.
          </div>
          
          <div class="score-box">
            <div class="label">Overall Score</div>
            <div class="value">${overallScore}%</div>
            <div class="subtext">Based on theory, system implementation, and communication performance</div>
          </div>
          
          <div class="grid">
            <div class="grid-row">
              <div class="grid-col">
                <div class="card">
                  <div class="title">Aptitude</div>
                  <div class="score" style="color: #2563EB;">${aptScore}%</div>
                </div>
              </div>
              <div class="grid-col">
                <div class="card">
                  <div class="title">Coding</div>
                  <div class="score" style="color: #059669;">${codingScore}%</div>
                </div>
              </div>
              <div class="grid-col">
                <div class="card">
                  <div class="title">HR Interview</div>
                  <div class="score" style="color: #7C3AED;">${hrPercentage}%</div>
                </div>
              </div>
            </div>
          </div>

          <div style="margin-bottom: 25px; background-color: #F9FAFB; padding: 15px 20px; border-radius: 16px; border: 1px dashed #E5E7EB;">
            <span style="font-size: 13px; font-weight: bold; color: #4B5563; text-transform: uppercase;">Theory vs Practical Balance:</span>
            <span style="font-size: 14px; font-weight: 800; color: #1F2937; margin-left: 8px;">${profile?.gapAnalysis?.theoryVsPractical || 'Balanced'}</span>
          </div>
          
          <div class="section-title" style="color: #059669;">Key Strengths</div>
          <ul style="padding-left: 20px; margin-bottom: 30px;">
            ${strengthsList || '<li style="color: #6B7280; font-size: 13px;">No strengths registered yet.</li>'}
          </ul>
          
          <div class="section-title" style="color: #D97706;">Areas for Improvement</div>
          <ul style="padding-left: 20px; margin-bottom: 30px;">
            ${improvementsList || '<li style="color: #6B7280; font-size: 13px;">No recommendations registered yet.</li>'}
          </ul>


        </div>
        
        <div class="footer">
          <p>This report was securely generated by the LMS Assessment Platform.</p>
          <p>&copy; 2026 LMS Inc. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * sendReportEmail - sends a rich HTML placement performance report email.
 * Supports auto-fallback to Ethereal SMTP test account for instant out-of-the-box local testing.
 */
export const sendReportEmail = async (toEmail, subject, htmlContent, attachments = []) => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  let transporter;
  if (user && pass) {
    console.log(`[Mailer] Creating secure SMTP transport using: ${user} via ${host}:${port}`);
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass
      }
    });
  } else {
    console.log('[Mailer] No local SMTP environment variables found. Generating high-fidelity Ethereal test SMTP credentials...');
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
  }

  const mailOptions = {
    from: process.env.SMTP_FROM || user || '"LMS Assessment Portal" <noreply@lmsportal.com>',
    to: toEmail,
    subject: subject,
    html: htmlContent,
    attachments
  };

  const info = await transporter.sendMail(mailOptions);
  console.log('[Mailer] Email successfully dispatched! Message ID: %s', info.messageId);
  
  if (!user || !pass) {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log('\n=================== SMTP TEST PREVIEW ===================');
    console.log(`Email dispatched to Ethereal SMTP server!`);
    console.log(`You can view and inspect the fully rendered rich email here:`);
    console.log(`${previewUrl}`);
    console.log('=========================================================\n');
    info.previewUrl = previewUrl;
  }
  
  return info;
};

/**
  * generatePdfFromHtml - Uses Puppeteer headless to render gorgeous, high-fidelity PDF documents.
  */
export const generatePdfFromHtml = async (htmlContent) => {
  let browser;
  try {
    console.log('[PDF Generator] Launching headless browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--headless', '--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        bottom: '20px',
        left: '20px',
        right: '20px'
      }
    });
    console.log('[PDF Generator] PDF successfully rendered.');
    return pdfBuffer;
  } catch (err) {
    console.error('[PDF Generator] Error during Puppeteer PDF generation:', err);
    throw err;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
};
