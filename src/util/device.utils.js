const getDevice = (id) =>
  /^3A.{18}$/.test(id)
    ? "ios"
    : /^3E.{20}$/.test(id)
    ? "web"
    : /^(.{21}|.{32})$/.test(id)
    ? "android"
    : /^.{18}$/.test(id)
    ? "desktop"
    : "unknown";

module.exports = getDevice;