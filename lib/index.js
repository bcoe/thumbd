exports.Client = require('./client').Client;
exports.Grabber = require('./grabber').Grabber;
exports.Saver = require('./saver').Saver;
exports.Thumbnailer = require('./thumbnailer').Thumbnailer;
exports.Worker = require('./worker').Worker;
exports.Config = require('./config').Config;

// expose the raw knox S3 client.
exports.knox = function(bucket, region) {
  return require('./utils').s3(bucket, region);
}
