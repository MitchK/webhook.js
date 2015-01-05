var http = require('http');
var crypto = require('crypto');
var exec = require('child_process').exec;

if (!process.env.WEBHOOK_REPO_PATH) {
  throw Error("WEBHOOK_REPO_PATH env variable not set");
}

if (!process.env.WEBHOOK_SECRET) {
  throw Error("WEBHOOK_SECRET env variable not set");
}


function hmac(algorithm, key, text, encoding) {
    var hmac = crypto.createHmac(algorithm, key);

    hmac.setEncoding(encoding);
    hmac.write(text);
    hmac.end();

    return hmac.read();
};

var server = http.createServer(function(req, res) {
  var body = "";
  
  if (req.method == 'POST') {
    req.on('data', function (data) {
      body += data;
    });
    req.on('end', function () {
      var hashSent = req.headers['x-hub-signature'].replace('sha1=', '');
      var hashComputed = hmac('sha1', process.env.WEBHOOK_SECRET, body, 'hex');
      if (hashSent == hashComputed) {
        var json = JSON.parse(body);
        console.log('Payload received!');
        
        exec('sh ' * path.join(process.env.WEBHOOK_REPO_PATH, '.webhook.sh'), function (error, stdout, stderr) {
            if (error) {
                console.error(error);
                res.writeHead(500, {'Content-Type': 'text/plain'});
                return res.end('Script error, check log file');
            }
        });
        
        
        res.writeHead(202, {'Content-Type': 'text/plain'});
        res.end('Accepted');
      }
      else {
        res.writeHead(403, {'Content-Type': 'text/plain'});
        res.end('X-Hub-Signature did not match the payload signature.');
        return;
      }
    });
  }
  else {
        res.writeHead(400, {'Content-Type': 'text/plain'});
        res.end('Please use the POST method');
        return;
  }
});

server.listen(process.env.WEBHOOK_PORT || 1337);
