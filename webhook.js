var http = require('http');
var crypto = require('crypto');
var exec = require('child_process').exec;
var path = require('path');

if (!process.env.WEBHOOK_REPOS_DIR) {
  throw Error("WEBHOOK_REPOS_DIR env variable not set");
}

if (!process.env.WEBHOOK_SECRET) {
  throw Error("WEBHOOK_SECRET env variable not set");
}

if (!process.env.WEBHOOK_REF_FILTER) {
  console.log("WARNING! WEBHOOK_REF_FILTER not set. This hook will listen to ANYTHING");
}
else {
  console.log('INFO: Using ref filter: ' + process.env.WEBHOOK_REF_FILTER);
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
	console.log(json)

        var deploy = function (ref) {
          var cmd = '';

          var repoPath = path.join(process.env.WEBHOOK_REPOS_DIR || '../repos', 
              json.repository.owner.name,
              json.repository.name);
          
          // Clean up first
          cmd += 'rm -rf ' + repoPath + '|| true ; ';

          // Shallow clone
          cmd += 'git clone ' + json.repository.url + ' ' + repoPath + '; cd ' + repoPath + '; ';
          

          if (ref) {
            cmd += 'git checkout ' + ref + '; ';
          }

          cmd += 'sh .webhook.sh; ';

          exec(cmd, function (error, stdout, stderr) {
              if (error) {
                  console.error(error);
                  res.writeHead(500, {'Content-Type': 'text/plain'});
                  return res.end('Script error, check log file');
              }
              
              process.stdout.write(stdout);
          });   
        };

        if (!process.env.WEBHOOK_REF_FILTER) {
          console.log("WARNING! WEBHOOK_REF_FILTER not set. Executing anyways... I have warned you...");
          deploy();
          res.writeHead(202, {'Content-Type': 'text/plain'});
          res.end('Accepted');
        }

        if (process.env.WEBHOOK_REF_FILTER 
          && !json.ref) {
        }

        if (process.env.WEBHOOK_REF_FILTER) {
          if (process.env.WEBHOOK_REF_FILTER 
            && json.ref) {

            var match = json.ref.match(process.env.WEBHOOK_REF_FILTER);

            if (match && match.length > 0) {
              console.log("Push to " + json.ref + ". Executing...");
              deploy(json.ref);
              res.writeHead(202, {'Content-Type': 'text/plain'});
              res.end('Accepted');
            }
            else {
              console.log('IGNORING REQUEST: Push ref ' + json.ref + ' did not match ref wildcard ' + process.env.WEBHOOK_REF_FILTER);
              res.writeHead(202, {'Content-Type': 'text/plain'});
              res.end('Accepted');
              return;
            }
          }
          else {
            console.log('Payload did not contain a ref');
            res.writeHead(202, {'Content-Type': 'text/plain'});
            res.end('Accepted');
            return;
          }
        }
        else {
          execute();
          res.writeHead(202, {'Content-Type': 'text/plain'});
          res.end('Accepted');
          return;
        }
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
