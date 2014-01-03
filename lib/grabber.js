var knox = require('knox'),
	tmp = require('tmp'),
	fs = require('fs'),
	http = require('http'),
	https = require('https'),
	config = require('./config').Config;

/**
 * Initialize the Grabber
 *
 * @param object s3 The S3 client
 */
function Grabber(s3) {
	if (s3) {
		this.s3 = s3;
		return;
	}

	this.s3 = knox.createClient({
		key: config.get('awsKey'),
		secret: config.get('awsSecret'),
		bucket: config.get('s3Bucket')
	});
}

/**
 * Download an image from S3 or over http(s)
 *
 * @param string remoteImagePath The image url / s3 path
 * @param function} callback The callback function
 */
Grabber.prototype.download = function(remoteImagePath, callback) {
	var _this = this,
		extension = remoteImagePath.split('.').pop();

	tmp.file({dir: config.get('tmpDir'), postfix: "." + extension}, function(err, localImagePath, fd) {

		fs.closeSync(fd); // close immediately, we do not use this file handle.
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

/**
 * Retrieve a file from a http(s) URI
 *
 * @param string remoteImagePath The image URI
 * @param string localImagePath The local image path
 * @param WriteStream stream The stream object for the local file
 * @param function callback The callback function
 */
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
			socket.setTimeout(config.get('requestTimeout'));
			socket.on('timeout', function() {
				stream.end();
				req.abort();
				callback('socket timed out while downloading ' + remoteImagePath);
			});
		});
};

/**
 * Retrieve a file from S3
 *
 * @param string remoteImagePath The S3 path
 * @param string localImagePath The local image path
 * @param WriteStream stream The stream object for the local file
 * @param function callback The callback function
 */
Grabber.prototype.getFileS3 = function(remoteImagePath, localImagePath, stream, callback) {
	var _this = this,
		req = this.s3.getFile(remoteImagePath, function(err, res) {

			if (err || res.statusCode >= 400) {
				err = 'error retrieving from S3 status ' + res.statusCode;
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
			socket.setTimeout(config.get('requestTimeout'));
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
