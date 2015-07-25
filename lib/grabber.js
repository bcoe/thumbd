var tmp = require('tmp'),
	utils = require('./utils'),
	fs = require('fs'),
	http = require('http'),
	https = require('https'),
	config = require('./config').Config;

/**
 * Initialize the Grabber
 *
 * @param object s3 The S3 client
 */
function Grabber() {
	this.logger = require('./logger');
}

/**
 * Download an image from S3 or over http(s)
 *
 * @param string remoteImagePath The image url / s3 path
 * @param function} callback The callback function
 */
Grabber.prototype.download = function(bucket, region, remoteImagePath, callback) {
	var _this = this,
		extension = remoteImagePath.split('.').pop();

	tmp.file({dir: config.get('tmpDir'), postfix: "." + extension}, function(err, localImagePath, fd) {

		if (err) return callback(err);

		fs.close(fd, function() {
			_this.logger.info('downloading', remoteImagePath, 'from s3 to local file', localImagePath);

			var stream = fs.createWriteStream(localImagePath);

			if (remoteImagePath.match(/https?:\/\//)) { // we are thumbnailing a remote image.
				_this.getFileHTTP(remoteImagePath, localImagePath, stream, callback);
			} else { // we are thumbnailing an Object in our thumbnail S3 bucket.
				_this.getFileS3(bucket, region, remoteImagePath, localImagePath, stream, callback);
			}
		}); // close immediately, we do not use this file handle.
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
Grabber.prototype.getFileS3 = function(bucket, region, remoteImagePath, localImagePath, stream, callback) {
	var _this = this,
		req = utils.s3(bucket, region).getFile(remoteImagePath, function(err, res) {

			// no response should count as an error.
			res = res || { statusCode: 503 };

			if (err || res.statusCode >= 400) {
				stream.end();
				return callback(Error('error retrieving from S3 status ' + res.statusCode));
			}

			stream.on('finish', function() {
				stream.close(function() { callback(null, localImagePath, _this.getMeta(res)); });
			});

			res.pipe(stream);

			res.on('error', function(err) {
				stream.end();
				callback(err);
			});

			res.on('end', function() {
				stream.end();
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

// copy any x-amz-meta prefixed headers to the
// thumbnail image being created.
Grabber.prototype.getMeta = function(res) {
	var metadata = {};
	if (config.get('keepMeta')) {
		for (var prop in res.headers){
			if (prop.slice(0,11) === config.get('metaPrefix')){
				metadata[prop] = res.headers[prop];
			}
		}
	}

	return metadata;
};

exports.Grabber = Grabber;
