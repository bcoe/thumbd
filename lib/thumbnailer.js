var _ = require("underscore"),
	exec = require('child_process').exec,
	tmp = require('tmp'),
	fs = require('fs');

function Thumbnailer(opts) {
	_.extend(this, {
		background: 'black',
		tmp_dir: (process.env.TMP_DIR || '/tmp')
	}, opts);
}

Thumbnailer.prototype.thumbnail = function(localImagePath, width, height, callback) {
	var extension = localImagePath.split('.').pop(),
		_this = this;

	tmp.file({dir: this.tmp_dir, postfix: ".jpg"}, function(err, convertedImagePath, fd) {

		if (err) {
			callback(err);
			return;
		}

		var thumbnailCommand = _this._thumbnailCommand(localImagePath, convertedImagePath, width, height);

		console.log('executing thumbnail command "', thumbnailCommand, '"');

		exec(thumbnailCommand, function(err, stdout, stderr) {
			
			if (err) {
				console.log(err);
				callback(err);
				return;
			}
			
			fs.stat(convertedImagePath, function(err, stat) {
				err = err || stat.size === 0 ? 'zero byte thumbnail created' : null;
				if (err) {
					callback(err);
					return;
				}
				callback(null, convertedImagePath);
			});
		});
	});
};

Thumbnailer.prototype._thumbnailCommand = function(localImagePath, convertedImagePath, width, height) {
	return 'convert "' + localImagePath + '" -thumbnail ' + (width * height) + '@ -gravity center -background ' + this.background + ' -extent ' + width + 'X' + height + ' ' + convertedImagePath;
};

exports.Thumbnailer = Thumbnailer;