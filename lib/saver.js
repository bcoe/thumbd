var knox = require('knox'),
	_ = require('underscore'),
	url = require('url');

function Saver(opts) {
	_.extend(this, {
		aws_key: process.env.AWS_KEY,
		aws_secret: process.env.AWS_SECRET,
		bucket: process.env.BUCKET,
		s3_storage_class: (process.env.S3_STORAGE_CLASS || 'STANDARD')
	}, opts);
	
	if (this.s3) return;
	
	this.s3 = knox.createClient({
		key: this.aws_key,
		secret: this.aws_secret,
		bucket: this.bucket
	});
}

Saver.prototype.save = function(source, destination, callback) {
	var headers = {
		'x-amz-storage-class': this.s3_storage_class
	};

	if (destination.match(/https?:\/\//)) {
		destination = this.destinationFromURL(destination);
	}

	this.s3.putFile(source, encodeURI(destination), headers, function(err, res){
		if (err) {
			callback(err);
		} else {
			console.log('saved ' + source + ' to ' + destination)
			callback();
		}
	});
};

Saver.prototype.destinationFromURL = function(destination) {
	var parsedURL = url.parse(destination);
	return parsedURL.hostname + parsedURL.path;
};

exports.Saver = Saver;