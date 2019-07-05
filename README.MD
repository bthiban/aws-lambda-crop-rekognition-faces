### Trigger
    s3: s3bucketname /
    Event type: ObjectCreated
    Prefix: images/
    
### Permissions
    Allow: logs:CreateLogStream
    Allow: logs:PutLogEvents
    Allow: logs:CreateLogGroup
    Allow: rekognition:DetectFaces
    Allow: s3:GetObject
    Allow: s3:PutObject
    
### Runtime
    Node.js 8.10 / 30s / 

### Environment Variables
    SG_BUCKET=s3bucketname
    REKOG_REGION=ap-southeast-1
