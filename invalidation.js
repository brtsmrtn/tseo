const AWS=require('aws-sdk');

const cloudfront = new AWS.CloudFront();

const main = async () => {

  let date = new Date();
  let timestamp = date.getTime();

  let invalidationParams = {
    DistributionId: process.env.CF_DISTRIBUTION_ID, /* required */
    InvalidationBatch: { /* required */
      CallerReference: String(timestamp), /* required */
      Paths: { /* required */
        Quantity: '1', /* required */
        Items: [
          '/*'
        ]
      }
    }
  };
  let invalidationResult = await cloudfront.createInvalidation(invalidationParams).promise();
  console.log(invalidationResult);

}

main()