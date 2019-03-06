const got = require('got');
const existingHosts = [];
const traefikHost = process.env.TRAEFIK_HOST_NAME;
function checkConfig() {
  console.log('checking');
  (async () => {
      try {
        const response = await got('http://localhost:8080/api/providers/kubernetes/frontends');
        // console.log('sourav-traefik-docker: ', response.body);
        const hosts = Object.keys(response.body).map(str => str.replace(/\/$/, ''));
        const hostRegExp = new RegExp(traefikHost);
        const traefikHostIp = await got('http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip', {
          headers: {
            "Metadata-Flavor": "Google"
          }
        });
        const allowedHosts = hosts.filter(host => hostRegExp.test(host));
        console.log('machine ip: ', traefikHostIp);
        console.log('allowed hosts: ', allowedHosts);
      } catch (error) {
        console.error('sourav-traefik-docker: ', error);
      }
  })();
}

setInterval(checkConfig, 60000);