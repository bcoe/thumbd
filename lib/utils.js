var knox = require('knox');

/**
* Create an S3 client, for a specific bucket.
*
* @param string bucket S3 bucket to connect to.
*/
exports.s3 = function(bucket) {
  return knox.createClient({
    key: config.get('awsKey'),
    secret: config.get('awsSecret'),
    bucket: bucket,
    region: config.get('awsRegion')
  });
};
