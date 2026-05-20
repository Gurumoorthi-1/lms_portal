const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Store the browser cache inside the project directory so it is copied to the final Render running container
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
