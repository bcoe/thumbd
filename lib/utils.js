var knox = require('knox'),
  config = require('./config').Config;

/**
* Create an S3 client, for a specific bucket.
*
* @param string bucket S3 bucket to connect to.
*/
exports.s3 = function(bucket, region) {
  // Knox wants 'us-standard' instead of 'us-east-1'.
	if (region == 'us-east-1') region = 'us-standard';
    
  return knox.createClient({
    key: config.get('awsKey'),
    secret: config.get('awsSecret'),
    bucket: bucket,
    region: region
  });
};
