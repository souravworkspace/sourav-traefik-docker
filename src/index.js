const got = require('got');
const existingHosts = [];
const traefikHost = process.env.TRAEFIK_HOST_NAME;
const cfEmail = process.env.CLOUDFLARE_EMAIL;
const cfToken = process.env.CLOUDFLARE_TOKEN;
function checkConfig() {
  console.log('checking');
  (async () => {
      try {
        const response = await got('http://localhost:8080/api/providers/kubernetes/frontends');
        // console.log('sourav-traefik-docker: ', response.body);
        const hosts = Object.keys(response.body).map(str => str.replace(/\/$/, ''));
        const hostRegExp = new RegExp(`${traefikHost}`);
        const respMeta = await got('http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip', {
          headers: {
            "Metadata-Flavor": "Google"
          }
        });
        const traefikHostIp = respMeta.body;
        const allowedHosts = hosts.filter(host => hostRegExp.test(host));
        console.log('traefik host: ', traefikHost);
        console.log('machine ip: ', traefikHostIp);
        console.log('allowed hosts: ', allowedHosts);

        const cloudResp = await got(`https://api.cloudflare.com/client/v4/zones?name=${traefikHost}`, {
          headers: {
            "X-Auth-Email": cfEmail,
            "X-Auth-Key": cfToken,
            "Content-Type": "application/json"
          }
        });
        const zoneId = cloudResp.result[0].id;
        console.log('zoneId: ', zoneId);

      } catch (error) {
        console.error('sourav-traefik-docker: ', error);
      }
  })();
}

setInterval(checkConfig, 60000);