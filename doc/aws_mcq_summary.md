# AWS Multiple Choice Questions (MCQ) - Study Guide

This document summarizes the AWS-related MCQs discussed, including the questions, options, and technically correct answers.

---

### 1. Amazon S3 Request Limits
**Question:** Before shifting their offline storage to S3, a team manager wants to know the specifications of PUT and GET requests the service can handle. What are the maximum PUT and GET request limits?
*   A. 20,000 GET Requests and 2,000 PUT Requests
*   B. 2,000 GET Requests and 20,000 PUT Requests
*   C. 15,000 GET Requests and 15,000 PUT Requests
*   D. 20,000 GET Requests and 20,000 PUT Requests
**Correct Answer:** **A** (Note: Standard documentation lists 5,500 GET and 3,500 PUT per prefix/sec, but "20,000/2,000" is a common legacy exam answer).

### 2. ECS/EC2 First Run Wizard & Task Registration
**Question:** Ben completed the "first run wizard setup" for EC2 launch type but is unable to register task definitions in the console. How should he solve this?
*   A. Check the permissions specified in the AdministratorAccess
*   B. Check the permissions set in IAM User page
*   C. Setup the AWS CloudFormation stack
*   D. Check if there's any old ECS cluster
**Correct Answer:** **B** (Registering task definitions requires specific `ecs:RegisterTaskDefinition` IAM permissions).

### 3. AWS Lambda Debugging
**Question:** A Lambda function output is not as expected. Which service can resolve/debug the issue?
*   A. Check Cloudwatch logs
*   B. Check VPC Flow Logs
*   **C.** Check AWS Trusted Advisor
*   D. Check AWS Inspector
**Correct Answer:** **A** (CloudWatch Logs is the primary tool for Lambda execution debugging).

### 4. Scaling Custom Code with Event Triggers
**Question:** Which service executes code for custom functions, scales matchings data volume automatically, and enables custom event triggers?
*   A. AWS Lambda
*   B. Amazon Athena
*   C. AWS App Runner
*   D. AWS Auto Scaling
**Correct Answer:** **A** (Lambda is the serverless event-driven compute service).

### 5. Compiling Java for AWS Lambda
**Question:** Which tool is used to compile AWS Lambda functions in Java code?
*   A. Jenkins
*   B. Nagios
*   **C.** Junit
*   D. Gradle
**Correct Answer:** **D** (Gradle and Maven are the standard build tools for Java Lambda functions).

### 6. AWS Lambda Language Support
**Question:** Which of the following languages is supported by the AWS Lambda computing platform:
*   1. Java
*   2. Go
*   3. Python
**Options:**
*   A. 1
*   B. 2
*   C. 3
*   D. All of these
**Correct Answer:** **D** (Lambda supports Java, Go, Python, Node.js, C#, Ruby, and PowerShell).

### 7. Instance-level Traffic Control
**Question:** Which system acts as a firewall for EC2 instances, controlling traffic at the instance level?
*   A. Create security groups
*   B. Use Traffic Mirroring
*   **C.** AWS VPN
*   D. AWS Network Firewall
**Correct Answer:** **A** (Security Groups act as virtual firewalls at the instance level).

### 8. Auto Scaling Predictable Traffic Patterns
**Question:** Traffic is highest on Monday/Wednesday between 6-8 PM. What is the best solution for Auto-scaling?
*   A. A bigger RDS instance needs to be opted.
*   B. A policy in Auto-scaling should be configured to scale the predictable traffic.
*   C. An Auto-scaling group should be created to distribute traffic among instances so that it can be easily handled.
*   D. Manual scripts should be created to take RDS instances down.
**Correct Answer:** **B** (Scheduled scaling policies are used for predictable traffic patterns).

### 10. Database Encryption in Transit (SSL)
**Question:** In AWS, which of the following DB services supports the Secure Socket Layer (SSL) connections from applications to secure the data in transit?
*   A. AES10
*   B. AES192
*   **C.** AES128
*   D. AES 256
**Correct Answer:** **D** (Intended answer in some banks; AES-256 is the standard encryption strength used by SSL/TLS and RDS).

### 11. Security Group Rule Components
**Question:** Which options are used by a security group to allow network traffic?
*   A. IP protocol (TCP, UDP, ICMP)
*   B. Source or destination IP address
*   **C.** Direction (inbound or outbound)
*   D. All of these
**Correct Answer:** **D** (All these parameters define a standard SG rule).

### 12. Resizable Compute Capacity
**Question:** Which web service provides secure, resizable compute capacity in the cloud?
*   A. AWS EC1
*   B. AWS Elastic Beanstalk
*   C. AWS EC2
*   D. AWS Elastic Load Balancing
**Correct Answer:** **C** (Elastic Compute Cloud - EC2).

### 13. Managed Load Balancer Category
**Question:** AWS Elastic Load Balancing (ELB) is categorized as which cloud service model?
*   A. PaaS
*   B. IaaS
*   **C.** SaaS
*   D. All of these
**Correct Answer:** **A** (ELB is a managed platform-as-a-service feature).

### 14. S3 Redundancy & Multiple Facilities
**Question:** Which standard storage class stores data redundantly across multiple devices in multiple facilities (AZs)?
*   A. S3 Standard IA
*   B. S3 Standard
*   **C.** S3 One Zone-Infrequent Access
*   D. None of these
**Correct Answer:** **B** (S3 Standard is the default for multi-facility high durability).

### 15. Standard S3 Offered Services/Features
**Question:** Which of the following features are offered by Amazon S3?
*   1. scalability, 2. data availability, 3. security, 4. performance, 5. containerized
*   A. 1, 2, 3 and 4
*   B. 1, 2, 3 and 5
*   **C.** 2, 3, 4 and 5
*   D. 1, 3, 4 and 5
**Correct Answer:** **A** (S3 is not a containerized service).

### 16. API Gateway Multi-Stage Management
**Question:** How can you direct traffic to different backend endpoints (Dev, Test, Prod) without creating separate APIs?
*   A. Add a model to the API and add a schema.
*   B. Use stage variables and configure them in the HTTP integration request.
*   **C.** Use API Custom Authorizers for each stage.
*   D. Update the Integration Response.
**Correct Answer:** **B** (Stage variables allow dynamic endpoint routing based on the stage).

### 17. Subnet-level Traffic Control
**Question:** Which service provides a firewall for controlling traffic in and out of 3 subnets?
*   A. Network Access Control List (NACL)
*   B. Network Access Analyzer
*   **C.** Reachability Analyzer
*   D. Ingress Routing
**Correct Answer:** **A** (NACLs operate at the subnet boundary).

### 18. Visibility into Resource Utilization
**Question:** Which service provides visibility into CPU utilization, disk reads/writes, and network traffic?
*   A. Auto Scaling
*   B. Elastic LB
*   C. CloudWatch
*   D. Amazon RDS
**Correct Answer:** **C** (CloudWatch is the standard monitoring and metrics service).

### 19. Blocking Specific IPs in API Gateway
**Question:** Which mechanism can be used to deny a specific IP address from accessing the API gateway?
*   A. Lambda Authorizers
*   B. IAM Policy (Resource Policies)
*   **C.** AWS WAF
*   D. All of these
**Correct Answer:** **D** (All three can be used to filter traffic by IP).

### 20. CloudFormation Stack Best Practices
**Question:** Best way to manage CloudFormation stacks for different web and database teams?
*   A. CloudFormation is not the right fit, use OpsWork instead
*   B. Create one monolithic stack.
*   C. Create separate stacks according to application layers/teams.
*   D. Define manual EC2 instances.
**Correct Answer:** **C** (Modular design with separate stacks is the best practice).

### 21. Kubernetes Missing Memory Limits
**Question:** What happens in Kubernetes if you do not specify a memory limit for a container?
*   A. The Container could use all of the memory available on the Node.
*   B. Admins can use a LimitRange to apply default values.
*   **C.** The container has a lesser chance of being killed.
*   D. Both A and B.
**Correct Answer:** **D** (Containers without limits land in the "BestEffort" QoS class and are high-risk).

### 22. Stream Data Pre-processing
**Question:** How can you ensure data processing happens before it is analyzed by analytics tools?
*   A. Use Step Functions.
*   B. Use Kinesis with AWS Lambda.
*   **C.** Use API Gateway.
*   D. Use ELB.
**Correct Answer:** **B** (Kinesis-triggered Lambda is the standard preprocessing architecture).

### 23. CloudFormation JSON Syntax
**Question:** Create a JSON template for an EC2 instance with ami-0fm4t26587e27f967, t3.nano, prodkey, and EBS.
*   **A.** Option 1 (Uses AWSTemplateFormatVersion: "2010-09-09", ImageId, InstanceType, KeyName, and BlockDeviceMappings).
**Correct Answer:** **Option 1**.
