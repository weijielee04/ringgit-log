const React = require("react");
const ReactDOM = require("react-dom");
const client = require("react-dom/client");
window.React = React;
window.ReactDOM = Object.assign({}, ReactDOM, { createRoot: client.createRoot });
