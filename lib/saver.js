var knox = require('knox'),
  _ = require('underscore');

function Saver(opts) {
	_.extend(this, {
		aws_key: process.env.AWS_KEY,
		aws_secret: process.env.AWS_SECRET,
		bucket: process.env.BUCKET
	}, opts);
	
	if (this.s3) return;
	
	this.s3 = knox.createClient({
		key: this.aws_key,
		secret: this.aws_secret,
		bucket: this.bucket
	});
}

Saver.prototype.save = function(source, destination, callback) {
	this.s3.putFile(source, encodeURI(destination), function(err, res){

		if (err) {
			callback(err);
			return;
		}

		console.log('saved ' + source + ' to ' + destination)
		callback();
	});
};

exports.Saver = Saver;