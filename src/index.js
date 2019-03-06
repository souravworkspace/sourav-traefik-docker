const got = require('got');
let existingHosts = {};
const traefikHost = process.env.TRAEFIK_HOST_NAME;
const cfEmail = process.env.CLOUDFLARE_EMAIL;
const cfToken = process.env.CLOUDFLARE_TOKEN;
function checkConfig() {
  console.log('checking');
  (async () => {
      try {
        const traefikResp = await got('http://localhost:8080/api/providers/kubernetes/frontends', { json: true });
        // console.log('sourav-traefik-docker: ', response.body);
        const hosts = Object.keys(traefikResp.body).map(str => str.replace(/\/$/, ''));
        const hostRegExp = new RegExp(`${traefikHost}`);
        const respMeta = await got('http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip', {
          headers: {
            "Metadata-Flavor": "Google"
          }
        });
        const traefikHostIp = respMeta.body;
        const allowedHosts = hosts.filter(host => hostRegExp.test(host));
        allowedHosts.push(traefikHost);
        console.log('traefik host: ', traefikHost);
        console.log('machine ip: ', traefikHostIp);
        console.log('allowed hosts: ', allowedHosts);

        const cloudResp = await got(`https://api.cloudflare.com/client/v4/zones?name=${traefikHost}`, {
          json: true,
          headers: {
            "X-Auth-Email": cfEmail,
            "X-Auth-Key": cfToken,
            "Content-Type": "application/json"
          }
        });
        const zoneId = cloudResp.body.result[0].id;

        console.log('zoneId: ', zoneId);

        const dnsResp = await got(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?name=${traefikHost}&type=A&order=name&direction=desc&per_page=100&match=all`, {
          json: true,
          headers: {
            "X-Auth-Email": cfEmail,
            "X-Auth-Key": cfToken,
            "Content-Type": "application/json"
          }
        });
        
        const { result: dnsRecords } = dnsResp.body;

        existingHosts = dnsRecords.reduce((all,dns) => {
          all[dns.name] = dns;
          return all;
        }, {});

        console.log('existing: ', existingHosts);

        allowedHosts.forEach(async (host) => {
          const body = {
            name: host,
            type: "A",
            content: traefikHostIp,
            proxied: true,
            ttl: 120
          };
          
          if (Object.keys(existingHosts).includes(host)) {
            console.log('host exists: ', host);
            const recordId = existingHosts[host].id;
            // (async () => {
            //   const dnsEditResp = await got(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`, {
            //     method: 'PUT',
            //     body,
            //     form: true,
            //     json: true,
            //     headers: {
            //       "X-Auth-Email": cfEmail,
            //       "X-Auth-Key": cfToken,
            //       "Content-Type": "application/json"
            //     }
            //   });
            // }).catch(err => console.error('sourav-traefik-docker: ', err));
          } else {
            console.log('create host: ', host);

            try {
              const dnsCreateResp = await got(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
                method: 'POST',
                body,
                form: true,
                json: true,
                headers: {
                  "X-Auth-Email": cfEmail,
                  "X-Auth-Key": cfToken,
                  "Content-Type": "application/json"
                }
              });
              console.log('created host: ', host, dnsCreateResp.body);
            } catch (error) {
              console.error('sourav-traefik-docker: ', error);
            }
          }
        });
      } catch (error) {
        console.error('sourav-traefik-docker: ', error);
      }
  })();
}

setInterval(checkConfig, 60000);