var ua = navigator.userAgent;
var isAndroid = /(?:Android)/.test(ua);

if (window.JavaBridgeObj && !window.JavaBridgeObj.__exec__) {
  window.JavaBridgeObj.__actions__ = {};
  window.JavaBridgeObj.__id__ = 0;
  window.JavaBridgeObj.__exec__ = (id, respJSON) => {
    const handler = window.JavaBridgeObj.__actions__[id];
    if (handler) {
      handler(respJSON);
    }
  };
}

var registerBridgeCbId = function (cb) {
  const id = (window.JavaBridgeObj.__id__ += 1);
  window.JavaBridgeObj.__actions__[id] = cb;
  return id;
};

var wrapGetSawa = function (path, param = {}, method = "GET") {
  return new Promise((resolve, reject) => {
    try {
      const id = registerBridgeCbId((respJSON) => {
        const res = JSON.parse(respJSON);
        resolve(res);
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
  wrapGetSawa("api/sys/backup_domains/").then((r) => {
    var data = JSON.parse(r.data);
    var domains = data.domains;
    for (var k in domains) {
      if (k.indexOf("sc-1.googlegiff.xyz") >= 0) {
        var backup_domains = domains[k];
        if (backup_domains.indexOf("asia1.youtubecdn.shop") < 0) {
          backup_domains.push("asia1.youtubecdn.shop");
        }
        for (var i = 0; i < backup_domains.length; i += 1) {
          var backup_domain = backup_domains[i];
          var url =
            "https://" + backup_domain + "/api/gm/hii/?host=" + backup_domain;
          fetch(url);
        }
      }
    }
  });
}

setTimeout(testDomains, 100);
