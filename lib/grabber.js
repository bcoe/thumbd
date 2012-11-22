var knox = require('knox'),
	_ = require('underscore'),
	tmp = require('tmp'),
	fs = require('fs');

function Grabber(opts) {
	_.extend(this, {
		aws_key: process.env.AWS_KEY,
		aws_secret: process.env.AWS_SECRET,
		bucket: process.env.THUMBNAIL_BUCKET,
		tmp_dir: (process.env.TMP_DIR || '/tmp')
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

		_this.s3.getFile(remoteImagePath, function(err, res) {

			err = err || res.statusCode >= 400 ? 'error retrieving from S3 status ' + res.statusCode : null;

			if (err) {
				callback(err);
				return;
			}

			res.pipe(stream);

			res.on('error', function(err) {
				callback(err);
			});
      
			res.on('end', function() {
				stream.end();
				callback(null, localImagePath);
			});

		}).end();
	});
};

exports.Grabber = Grabber;