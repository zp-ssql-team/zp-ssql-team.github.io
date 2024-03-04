var ua = navigator.userAgent;
var isAndroid = /(?:Android)/.test(ua);

if (window.JavaBridgeObj && !window.JavaBridgeObj.__exec__) {
  window.JavaBridgeObj.__actions__ = {};
  window.JavaBridgeObj.__id__ = 0;
  window.JavaBridgeObj.__exec__ = (id, respJSON) => {
    var handler = window.JavaBridgeObj.__actions__[id];
    if (handler) {
      handler(respJSON);
    }
  };
}

var registerBridgeCbId = function (cb) {
  var id = (window.JavaBridgeObj.__id__ += 1);
  window.JavaBridgeObj.__actions__[id] = cb;
  return id;
};

var wrapGetSawa = function (path, param = {}, method = "GET") {
  return new Promise((resolve, reject) => {
    try {
      var id = registerBridgeCbId((respJSON) => {
        try {
          var res = JSON.parse(respJSON);
          resolve(res);
        } catch (e) {
          resolve(respJSON);
        }
      });
      if (isAndroid) {
        window.JavaBridgeObj.wrapApi2(
          JSON.stringify({ path, param, callback_id: id })
        );
      } else {
        window.JavaBridgeObj.wrapApi2(
          JSON.stringify({ method, path, param, callback_id: id })
        );
      }
    } catch (e) {
      reject(e);
    }
  });
};

function testDomains() {
  wrapGetSawa("/api/sys/domains_testing/").then((r) => {
    var data = r.data;
    var backup_domains = data.domains;
    for (var i = 0; i < backup_domains.length; i += 1) {
      var domain = backup_domains[i];
      var url = "https://" + domain + "/api/gm/hii/?host=" + domain;
      console.log("request url", url);
      fetch(url);
    }
  });
}

setTimeout(testDomains, 100);
