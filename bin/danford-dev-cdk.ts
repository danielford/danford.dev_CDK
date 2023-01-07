#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DanfordDevCdkStack } from '../lib/danford-dev-cdk-stack';

const app = new cdk.App();

new DanfordDevCdkStack(app, 'DanFordDevTestStack', {
  env: { account: '797251479904', region: 'us-west-2' },
  siteDomain: 'test.danford.dev',
  certificateArn: 'arn:aws:acm:us-east-1:797251479904:certificate/afabbae4-72b0-4161-a216-9417b0891c68',
});

new DanfordDevCdkStack(app, 'DanFordDevLiveStack', {
  env: { account:'480228180912', region: 'us-west-2' },
  siteDomain: 'danford.dev',
  certificateArn: 'arn:aws:acm:us-east-1:480228180912:certificate/6b5b3800-2f52-423b-a5be-a6270c4c97ad',
});