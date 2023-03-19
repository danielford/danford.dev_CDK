import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfront_origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';

import { Construct } from 'constructs';
import { CfnTrackerConsumer } from 'aws-cdk-lib/aws-location';

interface DanfordDevStackProps extends cdk.StackProps {
  siteDomain: string,
  certificateArn: string,
}

export class DanfordDevCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DanfordDevStackProps) {
    super(scope, id, props);

    // s3 bucket to store all the website assets
    const siteBucket = new s3.Bucket(this, 'WebsiteContent', {
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,

      // 'cdk destroy' will delete the bucket and all of its contents
      // this is fine b/c the contents are auto-generated from jekyll anyway
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const logsBucket = new s3.Bucket(this, 'WebsiteLogs', {
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const cloudfrontOAI = new cloudfront.OriginAccessIdentity(this, 'cloudfront-OAI', {
      comment: `OAI for ${id}`
    });

    // Grant access to cloudfront
    siteBucket.addToResourcePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [siteBucket.arnForObjects('*')],
      principals: [new iam.CanonicalUserPrincipal(cloudfrontOAI.cloudFrontOriginAccessIdentityS3CanonicalUserId)]
    }));

    siteBucket.addToResourcePolicy(new iam.PolicyStatement({
      actions: ['s3:ListBucket'],
      resources: [siteBucket.bucketArn],
      principals: [new iam.CanonicalUserPrincipal(cloudfrontOAI.cloudFrontOriginAccessIdentityS3CanonicalUserId)]
    }));

    const certificate = acm.Certificate.fromCertificateArn(this, 'WebsiteCertificate', props.certificateArn);

    const autoIndexFunc = new cloudfront.Function(this, "AutoIndexFunction", {
      code: cloudfront.FunctionCode.fromFile({ filePath: path.join(__dirname, 'auto-index-function.js') })
    });

    // CloudFront distribution
    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      certificate: certificate,
      defaultRootObject: "index.html",
      domainNames: [props.siteDomain],
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      enableLogging: true,
      logBucket: logsBucket,
      logIncludesCookies: true,
      errorResponses:[
        {
          httpStatus: 404,
          responseHttpStatus: 404,
          responsePagePath: '/404.html',
        }
      ],
      defaultBehavior: {
        origin: new cloudfront_origins.S3Origin(siteBucket, {originAccessIdentity: cloudfrontOAI}),
        compress: true,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        functionAssociations: [{
          function: autoIndexFunc,
          eventType: cloudfront.FunctionEventType.VIEWER_REQUEST
        }]
      },
    });


    // create an IAM user for github actions to use when deploying
    // (needs to be able to write to s3 bucket and trigger cloudfront invalidation)
    const githubUser = new iam.User(this, 'GithubUser', {});
    const accessKey = new iam.CfnAccessKey(this, 'CfnAccessKey', {
      userName: githubUser.userName,
    });

    const policy = new iam.ManagedPolicy(this, 'GitHubUserPolicy', {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['s3:*'],
          resources: [siteBucket.bucketArn]
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['cloudfront:CreateInvalidation'],
          resources: ['*']
        }),
      ],
      users: [githubUser]
    });

    siteBucket.grantReadWrite(githubUser);


    // A Lambda@Edge function to redirect www domain to the canonical (non-www) one
    const wwwFunc = new cloudfront.experimental.EdgeFunction(this, 'WWWRedirectFunction', {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'www-rewrite-lambda')),
    });

    const wwwDistribution = new cloudfront.Distribution(this, 'WWWDistribution', {
      certificate: certificate,
      domainNames: ['www.' + props.siteDomain],
      defaultBehavior: {
        origin: new cloudfront_origins.S3Origin(siteBucket, {originAccessIdentity: cloudfrontOAI}),
        edgeLambdas: [
          {
            functionVersion: wwwFunc.currentVersion,
            eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
          }
        ],
      },
    });

  }
}
