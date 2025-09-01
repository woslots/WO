// flash-policy-server.js
const net = require('net');

const policyXML =
  '<?xml version="1.0"?>\n' +
  '<!DOCTYPE cross-domain-policy SYSTEM "http://www.macromedia.com/xml/dtds/cross-domain-policy.dtd">\n' +
  '<cross-domain-policy>\n' +
  '   <allow-access-from domain="*" to-ports="*" />\n' +
  '</cross-domain-policy>\n';

net.createServer((socket) => {
  socket.on('data', (data) => {
    if (data.toString().indexOf('<policy-file-request/>') === 0) {
      socket.write(policyXML);
      socket.end();
      console.log(">> Served Flash crossdomain.xml");
    }
  });
}).listen(843, () => {
  console.log("Flash policy server running on port 843");
});
