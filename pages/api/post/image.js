import aws from 'aws-sdk'

export default async function handler(요청, 응답){

    aws.config.update({
      accessKeyId: process.env.ACCESS_KEY, // aws access_key 
      secretAccessKey: process.env.SECRET_KEY, // aws secret_key 
      region: 'ap-northeast-2', // aws_region
      signatureVersion: 'v4',
    })

    const s3 = new aws.S3();
    const url = await s3.createPresignedPost({
      Bucket: process.env.BUCKET_NAME, // aws bucket name
      Fields: { key : 요청.query.file },
      Expires: 60, // seconds
      Conditions: [
        ['content-length-range', 0, 1048576], //파일용량 1MB 까지 제한
      ],
    })

    응답.status(200).json(url)
}  