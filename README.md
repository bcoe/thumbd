Thumbd
------

Thumbd is an image thumbnailing server built on top of Node.js, SQS, S3, and ImageMagick.

Setup
=====

```
apt-get install imagemagick
npm install thumbd
```

Thumbd requires the following environment variables to be set:

* **AWS_KEY** the key for your AWS account (the IAM user must have access to the appropriate SQS and S3 resources).
* **AWS_SECRET** the AWS secret key.
* **BUCKET** the bucket to download the original images from. The converted images will be placed in this bucket.
* **SQS_QUEUE** the queue to listen for image thumbnaling

You can export these variables to your environment, or specify them when running the thumbd CLI.

Personally, I set these environment variables in a .env file, and execute thumbd using Foreman.

Server
======

The thumbd server:

* listens for thumbnailing jobs on the queue specified.
* downloads the original image from S3, to a temporary directory.
* Uses ImageMagick to perform the set of transformations on the image.
* uploads the thumbnails created back to S3, with the following naming convention: <original filename excluding extension>\_<transformation name>.jpg: source.jpg.
	
Assume that the following thumbnail job is received over SQS:

```json
{
	"original": "example.png"
	"thumbnail_descriptions": [
		{
			"suffix": "tiny",
			"width": 48,
			"height": 48
		},
		{
			"suffix": "small",
			"width": 100,
			"height": 100
		},
		{
			"suffix": "medium",
			"width": 150,
			"height": 150
		}
	]
}
```

S3 will have the following files stored in it:

**/example.png**
**/example\_tiny.jpg**
**/example\_small.jpg**
**/example\_medium.jpg**

CLI
===

Starting a server:

```bash
thumbd server --aws_key=<key> --aws_secret=<secret> --tmp_dir=</tmp> --sqs_queue=<sqs queue name> --bucket=<s3 thumbnail bucket>
```

