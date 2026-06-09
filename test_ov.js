const { URLSearchParams } = require('url');
const params = new URLSearchParams();
params.append('or', 'tags.ov.{"Joined Community","joined community"}');
console.log(params.toString());
