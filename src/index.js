const got = require('got');

const traefikHost = process.env.TRAEFIK_HOST_NAME;
const cfEmail = process.env.CLOUDFLARE_EMAIL;
const cfToken = process.env.CLOUDFLARE_TOKEN;
const cloudflareHeaders = {
  "X-Auth-Email": cfEmail,
  "X-Auth-Key": cfToken,
};

let zoneId = null;
let existingHosts = {};

function handleError(err) {
  console.error(err);
}

async function fetchExistingDNS() {
  (async () => {
    const cloudResp = await got(`https://api.cloudflare.com/client/v4/zones?name=${traefikHost}`, {
      json: true,
      headers: cloudflareHeaders,
    });
    zoneId = cloudResp.body.result[0].id;

    const dnsResp = await got(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=A&order=name&direction=desc&per_page=100&match=all`, {
      json: true,
      headers: cloudflareHeaders,
    });
    
    const { result: dnsRecords } = dnsResp.body;

    existingHosts = dnsRecords.reduce((all,dns) => {
      all[dns.name] = dns;
      return all;
    }, {});

    return true;
  })().catch(err => handleError(err));
}

function checkForUpdate() {
  (async () => {
    const traefikResp = await got('http://localhost:8080/api/providers/kubernetes/frontends', { json: true });
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

    allowedHosts.forEach((host) => {
      const body = {
        name: host,
        type: "A",
        content: traefikHostIp,
        proxied: true,
        ttl: 120
      };
      
      if (Object.keys(existingHosts).includes(host)) {
        if (existingHosts[host].content !== traefikHostIp) {
          const recordId = existingHosts[host].id;
          (async () => {
            const putResp = await got(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`, {
              method: 'PUT',
              body,
              json: true,
              headers: cloudflareHeaders,
            });
            if (putResp.body.success) console.log('Updated DNS: ', host);
          })().catch(err => handleError(err));
        } else {
          console.log('DNS record is correct', host);
        }
      } else {
        (async () => {
          const postResp = await got(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
            method: 'POST',
            body,
            json: true,
            headers: cloudflareHeaders,
          });
          if (postResp.body.success) console.log('Added DNS: ', host);
        })().catch(err => handleError(err));
      }
    });
  })().catch(err => handleError(err));
}

if (fetchExistingDNS()) {
  setInterval(checkForUpdate, 60000);
} else {
  console.error('Can not fetch existing records');
}