'use strict';

exports.handler = (event, context, callback) => {
  const request = event.Records[0].cf.request;
  let uri = request.uri ? request.uri : '/';
  
  if (request.querystring) {
    uri += '?' + request.querystring;
  }

  let host = request.headers.host[0].value;

  if (host.startsWith('www.')) {
    host = host.replace('www.', '');
  }
  
  const redirectTo = 'https://' + host + uri;

  callback(null, {
    status: '301',
    statusDescription: 'Moved Permanently',
    headers: {
      location: [{
        key: 'Location',
        value: redirectTo,
      }]
    }
  });
};
