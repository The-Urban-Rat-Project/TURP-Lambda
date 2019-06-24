
/**
 * Send a json response in the format expected by the AWS API Gateway Lambda Proxy.
 * @see https://aws.amazon.com/premiumsupport/knowledge-center/malformed-502-api-gateway/
 */
function sendAPIGatewayResponse( callback, iHttpStatusCode, sBody, oHeaders ) { 
  if ( typeof oHeaders == "undefined" ) {
    oHeaders = {};
  }
  oHeaders['Access-Control-Allow-Origin'] = '*';
  callback( null, {
    "statusCode": iHttpStatusCode,
    "headers": oHeaders,
    "body": sBody,
    "isBase64Encoded": false
  });
}


/* Command to echo back the parameter */
async function c_echo( callback, event, sText ) {
  sendAPIGatewayResponse(callback, 200, JSON.stringify(sText) );
}

/* Replace all occurances of {keys} in param sText with the oPathParams. */
function replacePathParams( sText, oPathParams ) {
  for ( var key in oPathParams ) {
    sText = sText.replace( "{"+key+"}", oPathParams[key] );
  }
  return sText;
}

/* Return some database rows from a provided SQL query.*/
async function getDatabaseRows( sSql ) {
  // set up the connection
  const { Pool } = require('pg');
  const pool = new Pool({"connectionTimeoutMillis":1000});
  console.log("Connecting to " + process.env.PGHOST + "...");
  const client = await pool.connect();
  console.log("Connected.");
  
  // Fix for parsing of big integer fields, instead of text, return as an integer
  var types = require('pg').types
  types.setTypeParser(20, parseInt);
  
  // execute the query
	console.log("Starting query ["+sSql+"]...");
  var res = await client.query(sSql);
  client.end(); // end the connection

  console.log("Query completed ["+ res.rows.length +" rows].");
  return res.rows;
}


/* Execute a SQL query and return multiple rows.*/
async function c_sql( callback, event, sSql ) {
  
  // Return some rows, encoded in the given content type, or throw an Error
  function encodeRowsAsContentType( sContentType, aRows ) {
    switch (sContentType.toLowerCase()) {
      case "*/*":
      case "application/json": 
        console.log("Creating JSON...");
        return JSON.stringify(aRows);
      case "text/csv":
        const json2csv = require('json2csv').parse;
        const opts = {};
        console.log("Creating CSV...");
        return json2csv(aRows, opts);
      default: 
        throw new Error("Unhandled content type "+sContentType);
    }
  }

  // default to JSON format for the response
  event.headers = event.headers || {};
  const sContentType = event.headers['Accept'] || "application/json";
  
  // replace path params in the SQL code, and execute the query
  const rows = await getDatabaseRows( replacePathParams(sSql, event.pathParameters) );
  
  // form up the response and send it back
  const sBody = encodeRowsAsContentType(sContentType, rows );
  sendAPIGatewayResponse(callback, 200, sBody, {"Content-Type":sContentType});
}


/* Execute a SQL query and return just one row.*/
async function c_sql1( callback, event, sSql ) {
  const rows = await getDatabaseRows( replacePathParams(sSql, event.pathParameters) );
  
  // grab the first row of the result and send it back
  sendAPIGatewayResponse(callback, 200, JSON.stringify(rows[0]));
}


// This is the entry point ************************************
exports.handler = async (event, context, callback) => {
  // console.log( "Received event:" );  console.log( event );

  const sPath = event.resource;

  // This maps the sPath to a command (function to execute) and the parameters to pass to it. The function also
  // receives the event object and the callback.
  const oCommandMap = {
    "/": {
      command: c_echo,
      params: ["Hello from The Urban Rat Project"]
    },    
    "/projects": {
      command: c_sql,
      params: ["SELECT * from public.projects_with_top_postcode;"]
    },
    "/project/{projectId}": {
      command: c_sql1,
      params: ["SELECT * from public.projects_with_top_postcode WHERE project_id = {projectId} LIMIT 1;"]
    },
    "/stories": {
      command: c_sql,
      params: ["SELECT * from public.latest_story_revisions;"]
    },
    "/story/{storyId}": {
      command: c_sql1,
      params: ["SELECT * from public.latest_story_revisions WHERE story_id = {storyId} LIMIT 1;"]
    },
    "/project/{projectId}/stats/by-month": {
      command: c_sql,
      params: ["SELECT * FROM stats_by_project_month WHERE project_id = {projectId}"]
    },
    "/project/{projectId}/stats/by-year": {
      command: c_sql,
      params: ["SELECT * FROM stats_by_project_year WHERE project_id = {projectId}"]
    },
    "/project/{projectId}/reports/{year}": {
      command: c_sql,
      params: ["SELECT id report_id, date, email_address, project, project_id, projects, street_number, street, postcode, minutes, trap_checked, trap_reset, trap_lure_added, trap_caught, bait_checked, bait_added, bait_taken, submission_id, created_at, ip_address FROM reports_with_project_id WHERE project_id = {projectId} AND date_part('YEAR', date) = {year} ORDER BY date ASC, email_address ASC, id ASC;"]
    },
    "/project/{projectId}/reports/{year}/{month}": {
      command: c_sql,
      params: ["SELECT id report_id, date, email_address, project, project_id, projects, street_number, street, postcode, minutes, trap_checked, trap_reset, trap_lure_added, trap_caught, bait_checked, bait_added, bait_taken, submission_id, created_at, ip_address FROM reports_with_project_id WHERE project_id = {projectId} AND date_part('YEAR', date) = {year} AND date_part('month', date) = {month} ORDER BY date ASC, email_address ASC, id ASC;"]
    },
    "/user/{emailAddress}/reports": {
      command: c_sql,
      params: ["SELECT * FROM public.reports WHERE email_address = '{emailAddress}' ORDER BY date ASC;"]
    },
    "/reports": {
      command: c_sql,
      params: ["SELECT * FROM public.reports;"]
    },
    "/reports-for-export": {
      command: c_sql,
      params: ["SELECT * FROM public.reports_for_export;"]
    },
    "/summary": {
      command: c_sql1,
      params: ["SELECT * FROM public.summary;"]
    },
    "/postcodes": {
      command: c_sql,
      params: ["SELECT * FROM public.postcodes;"]
    },
    "/stats": {
      command: c_sql,
      params: ["SELECT * FROM stats_latest"]
    },
    "/stats/postcodes": {
      command: c_sql,
      params: ["SELECT * FROM stats_by_postcode_latest"]
    },
    "/stats/streets": {
      command: c_sql,
      params: ["SELECT * FROM stats_by_street_latest"]
    },
    "/stats/projects/by-month": {
      command: c_sql,
      params: ["SELECT * FROM stats_by_project_month"]
    },
    "/stats/projects/by-year": {
      command: c_sql,
      params: ["SELECT * FROM stats_by_project_year"]
    }

  };
  
  
  var oCommand = oCommandMap[sPath];
  
  // did we find that command?
  if ( !oCommand ) {
    throw "Unrecognised request " + sPath;
  }
  
  console.log( "Command "+sPath );
  await (oCommand.command).apply(null, [callback, event].concat(oCommand.params));

  
  console.log("Completed.");
};