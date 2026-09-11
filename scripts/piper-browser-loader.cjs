/** Force Piper's emscripten glue to use XHR/fetch instead of Node fs. */
module.exports = function piperBrowserLoader(source) {
  const text = typeof source === "string" ? source : source.toString();
  return text
    .replaceAll("typeof process.versions.node === \"string\"", "false")
    .replaceAll("typeof process.versions.node == \"string\"", "false");
};
