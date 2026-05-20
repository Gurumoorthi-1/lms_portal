import nodemailer from 'nodemailer';

async function testMail() {
  console.log('Testing nodemailer...');
  try {
    let transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: 'guru707378@gmail.com',
        pass: 'eajp zkvn yewt vzbx'
      }
    });

    let info = await transporter.sendMail({
      from: '"Test" <guru707378@gmail.com>',
      to: 'guru03042005@gmail.com',
      subject: 'Test Email',
      text: 'This is a test email to verify credentials.'
    });

    console.log('Message sent: %s', info.messageId);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

testMail();
