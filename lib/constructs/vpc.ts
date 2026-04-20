import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class VpcNetwork {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct) {
    this.vpc = new ec2.Vpc(scope, 'LarkBotVpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
    });

    // VPC Endpoints for AWS services (avoid NAT costs)
    this.vpc.addGatewayEndpoint('DynamoDBEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
    });

    this.vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
    });

    // Output the NAT Gateway EIP (fixed outbound IP)
    const natEip = this.vpc.publicSubnets[0].node.findAll()
      .find(c => c.node.id === 'EIP') as ec2.CfnEIP;

    if (natEip) {
      new cdk.CfnOutput(scope, 'NatGatewayEIP', {
        value: natEip.ref,
        description: 'Fixed outbound IP (NAT Gateway Elastic IP)',
      });
    }
  }
}
