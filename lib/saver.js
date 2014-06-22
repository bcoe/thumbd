var knox = require('knox'),
	url = require('url'),
	config = require('./config').Config;

/**
 * Initialize the Saver
 *
 * @param object s3 The S3 client
 */
function Saver(s3) {
	if (s3) {
		this.s3 = s3;
		return;
	}

	this.s3 = knox.createClient({
		key: config.get('awsKey'),
		secret: config.get('awsSecret'),
		bucket: config.get('s3Bucket'),
		region: config.get('awsRegion')
	});
}

/**
 * Save the (local or remote file) to disk
 *
 * @param string source The local file path, or remote file uri
 * @param string destination The local file path
 * @param function callback The callback function. Optional
 */
Saver.prototype.save = function(source, destination, callback) {
	if (typeof callback === 'undefined') {
		callback = function(){};
	}

	var headers = {
		'x-amz-acl': config.get('s3Acl'),
		'x-amz-storage-class': config.get('s3StorageClass')
	};

	if (destination.match(/https?:\/\//)) {
		destination = this.destinationFromURL(destination);
	}

	this.s3.putFile(source, destination, headers, function(err, res) {
		if (err) return callback(err);

		res.on('error', function(err) {
			callback(err);
		});

		res.on('end', function() {
			console.log('saved ' + source + ' to ' + destination);
			callback();
		})
		res.resume();
	});
};

/**
 * Get a file path from a URL
 *
 * @param string destination The destination url. e.g. http://example.com/foo/test.jpg
 *
 * @return string The file path. E.g. example.com/foo/test.jpg
 */
Saver.prototype.destinationFromURL = function(destination) {
	var parsedURL = url.parse(destination);
	return parsedURL.hostname + parsedURL.path;
};

exports.Saver = Saver;
