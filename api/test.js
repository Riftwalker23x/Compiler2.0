const handler = require("./timetable");

// Mock req/res like Vercel would provide
const req = {
  method: "GET",
  query: {sheet: "Monday" }  // raw=1 to see grid preview
};

const res = {
  setHeader: () => {},
  status(code) { this._code = code; return this; },
  json(data) { console.log(JSON.stringify(data, null, 2)); },
  end() {}
};

handler(req, res);