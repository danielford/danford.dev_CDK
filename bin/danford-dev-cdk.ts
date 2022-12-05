#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DanfordDevCdkStack } from '../lib/danford-dev-cdk-stack';

const app = new cdk.App();

new DanfordDevCdkStack(app, 'DanFordDevTestStack', {
  env: { account: '797251479904', region: 'us-west-2' },
  siteDomain: 'test.danford.dev',
  certificateArn: 'arn:aws:acm:us-east-1:797251479904:certificate/9b94bc2b-e0a5-4316-91b8-25c77ea01aef',
});
