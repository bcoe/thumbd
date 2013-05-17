var knox = require('knox'),
  _ = require('underscore'),
  tmp = require('tmp'),
  fs = require('fs'),
  http = require('http'),
  https = require('https');

function Grabber(opts) {
  _.extend(this, {
    aws_key: process.env.AWS_KEY,
    aws_secret: process.env.AWS_SECRET,
    bucket: process.env.THUMBNAIL_BUCKET,
    tmp_dir: (process.env.TMP_DIR || '/tmp'),
    requestTimeout: 15000
  }, opts);

  if (this.s3) return;
  	
  this.s3 = knox.createClient({
    key: this.aws_key,
    secret: this.aws_secret,
    bucket: this.bucket
  })
}

Grabber.prototype.download = function(remoteImagePath, callback) {
  var _this = this,
    extension = remoteImagePath.split('.').pop();

  tmp.file({dir: this.tmp_dir, postfix: "." + extension}, function(err, localImagePath, fd) {

    console.log('downloading', remoteImagePath, 'from s3 to local file', localImagePath);

    if (err) {
      callback(err);
      return;
    }

    var stream = fs.createWriteStream(localImagePath);

    if (remoteImagePath.match(/https?:\/\//)) { // we are thumbnailing a remote image.
      _this.getFileHTTP(remoteImagePath, localImagePath, stream, callback);
    } else { // we are thumbnailing an Object in our thumbnail S3 bucket.
      _this.getFileS3(remoteImagePath, localImagePath, stream, callback);
    }

  });
};

Grabber.prototype.getFileHTTP = function(remoteImagePath, localImagePath, stream, callback) {
  var _this = this,
    protocol = remoteImagePath.match('https://') ? https : http,
    req = protocol.get(remoteImagePath, function(res) {
    
      res.on('error', function(err) {
        stream.end();
        callback(err);
      });

      res.on('end', function() {
        stream.end();
        callback(null, localImagePath);
      });

      res.pipe(stream);

    }).on('error', function(err) {
      stream.end();
      callback(err);
    }).on('socket', function(socket) { // abort connection if we're in idle state too long.
      socket.setTimeout(_this.requestTimeout);
      socket.on('timeout', function() {
        stream.end();
        req.abort();
        callback('socket timed out while downloading ' + remoteImagePath);
      });
    });
};

Grabber.prototype.getFileS3 = function(remoteImagePath, localImagePath, stream, callback) {
  
  var _this = this,
    req = this.s3.getFile(encodeURI(remoteImagePath), function(err, res) {

      err = err || res.statusCode >= 400 ? 'error retrieving from S3 status ' + res.statusCode : null;

      if (err) {
        stream.end();
        callback(err);
        return;
      }

      res.pipe(stream);

      res.on('error', function(err) {
        stream.end();
        callback(err);
      });

      res.on('end', function() {
        stream.end();
        callback(null, localImagePath);
      });

    }).on('socket', function(socket) {  // abort connection if we're in idle state too long.
      socket.setTimeout(_this.requestTimeout);
      socket.on('timeout', function() {
        stream.end();
        req.abort();
        callback('socket timeout while downloading ' + remoteImagePath);
      });
    }).on('error', function(err) {
      stream.end();
      callback(err);
    });

};

exports.Grabber = Grabber;