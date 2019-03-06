const got = require('got');

function checkConfig() {
  console.log('checking');
  (async () => {
      try {
        const response = await got('traefik:8080/api/providers');
        console.log('sourav-traefik-docker: ', response.body);
      } catch (error) {
        console.error('sourav-traefik-docker: ', error);
      }
  })();
}

setInterval(checkConfig, 5000);