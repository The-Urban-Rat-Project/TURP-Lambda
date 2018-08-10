# TURP-Lambda

The Urban Rat Project (see [ratproject.org](https://ratproject.org)) provides communities with a way to increase and maintain engagement in urban/suburban predator control activities as part of New Zealand's Predator Free 2050 initiative.

This repo contains the open source code for TURP's read-only API. The API is currently built to allow the website to show community project coordinators their users and reports - see Future below for the longer term goals. The repo can be packaged up to deploy to AWS Lambda using npm predeploy, with requests proxied by API Gateway.

Presently the code is somewhat functional, but it would be hard to use it due to the requirements below.

## Requirements

- PostgreSQL database in exactly the right schema. Settings for this are provided in the environment variables per the requirements of the nodejs postgres module.
- API Gateway set up in exactly the right way.

## Future

- Will probably migrate this to Serverless framework and Express.js so that the API Gateway definition is also included in the repo.
- May include the database schema SQL.
- Possibly migrate everything to DynamoDB to cut out the AWS RDS PostgreSQL costs.
- Needs a rethink about the whole database schema, to better support multiple traps per person (this was never a design goal in the beginning, but turns out to be required by many users).
- Add the ability to update data (currently it's read-only).
- Add authentication options for end users, to enable the API to be used to view and edit their own data.
 
## Contributing

Contact me if you'd like to help build this conservation tool!


