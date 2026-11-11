const app = require('./app');
const config = require('./config');
const store = require('./data/store');

store.init()
  .then(() => {
    app.listen(config.port, () => {
      console.log(`Registry API running on http://localhost:${config.port} (data: ${store.mode})`);
    });
  })
  .catch((err) => {
    console.error('Could not start. Database setup failed:', err.message);
    process.exit(1);
  });
