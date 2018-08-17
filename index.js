
/**
 * Send a json response in the format expected by the AWS API Gateway Lambda Proxy.
 * @see https://aws.amazon.com/premiumsupport/knowledge-center/malformed-502-api-gateway/
 */
function sendAPIGatewayResponse( callback, iHttpStatusCode, sBody, oHeaders ) { 
  if ( typeof oHeaders == "undefined" ) {
    oHeaders = {};
  }
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
      params: ["SELECT * from public.latest_project_revisions;"]
    },
    "/project/{projectId}": {
      command: c_sql1,
      params: ["SELECT * from public.latest_project_revisions WHERE project_id = {projectId} LIMIT 1;"]
    },
    "/stories": {
      command: c_sql,
      params: ["SELECT * from public.latest_story_revisions;"]
    },
    "/story/{storyId}": {
      command: c_sql1,
      params: ["SELECT * from public.latest_story_revisions WHERE story_id = {storyId} LIMIT 1;"]
    },
    "/project/{projectId}/reports/by-month": {
      command: c_sql,
      params: ["SELECT date_part('YEAR', date)::int AS year, date_part('month', date)::int AS month, COUNT(*) count FROM public.reports r LEFT JOIN latest_project_revisions p ON r.project = p.title WHERE p.project_id = {projectId} GROUP BY year, month ORDER BY	year DESC, month DESC"]
    },
    "/project/{projectId}/reports/{year}": {
      command: c_sql,
      params: ["SELECT r.id report_id, r.date, r.email_address, r.project, p.project_id project_id,r.street_number, r.street, r.postcode, r.minutes, r.trap_checked, r.trap_reset, r.trap_lure_added, r.trap_caught, r.bait_checked, r.bait_added, r.bait_taken, r.submission_id, r.created_at, r.ip_address FROM reports r LEFT JOIN latest_project_revisions p ON r.project = p.title WHERE project_id = {projectId}	AND date_part('YEAR', date) = {year} ORDER BY date ASC, email_address ASC, r.id ASC;"]
    },    
    "/project/{projectId}/reports/{year}/{month}": {
      command: c_sql,
      params: ["SELECT r.id report_id, r.date, r.email_address, r.project, p.project_id project_id,r.street_number, r.street, r.postcode, r.minutes, r.trap_checked, r.trap_reset, r.trap_lure_added, r.trap_caught, r.bait_checked, r.bait_added, r.bait_taken, r.submission_id, r.created_at, r.ip_address FROM reports r LEFT JOIN latest_project_revisions p ON r.project = p.title WHERE project_id = {projectId}	AND date_part('YEAR', date) = {year} AND date_part('month', date) = {month} ORDER BY date ASC, email_address ASC, r.id ASC;"]
    },
    "/user/{emailAddress}/reports": {
      command: c_sql,
      params: ["SELECT * FROM public.reports WHERE email_address = '{emailAddress}' ORDER BY date ASC;"]
    },
    "/reports-for-export": {
      command: c_sql,
      params: ["SELECT * FROM public.reports_for_export;"]
    },
    "/postcodes": {
      command: c_sql,
      params: ["SELECT * FROM public.postcodes;"]
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