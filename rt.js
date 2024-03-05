wrapGetSawa("/api/sys/webrtc_get_info/").then((r) => {
    var data = r.data;
    var uuid = data.uuid;
    var carrier = data.carrier;
    console.log(uuid, carrier);

    // ("98D02113DB7B6C530DE705CC5757AF229D77A091");  Android uuid 示例
    // ("461F71B8-CA4C-41E7-84D9-D0963DF26EA0");  iOS uuid 示例
    const grayscalePercentage = 5; // 5%比例
    const result = getGrayScaleUuid(uuid, grayscalePercentage);

    if (result) {
        testRTC(uuid, carrier);
    }
});

if (!window.JavaBridgeObj) {
    // test(); // 本地测试
}

function uuidToInteger(uuid) {
    const integer = parseInt(uuid.replace(/-/g, ""), 16);
    return integer;
}

function getGrayScaleUuid(uuid, percentage) {
    uuid = uuid.replace(/-/g, "");
    var len = uuid.length;
    var totalValues = Math.pow(16, len);
    var integerUuid = uuidToInteger(uuid);
    var grayScaleValue = percentage / 100;
    var threshold = integerUuid / totalValues;

    console.log("灰度", threshold, grayScaleValue);

    return threshold <= grayScaleValue;
}

function testRTC(uuid, carrier) {
    UUID = uuid || Math.floor(Math.random() * 0xffffff).toString(16);
    OPERATOR = carrier || "cmcc";

    function toStr(a) {
        try {
            if (typeof(a) === 'object')
                return JSON.stringify(a)
        } catch (er) {}
        return "" + a
    }

    function printCallback(name) {
        return function(a1, a2, a3) {
            if (name.endsWith(".onerror")) {
                a1 = toStr(a1)
                a2 = toStr(a2)
                a3 = toStr(a3)
                reportResult({
                    result: "error",
                    scene: name,
                    msg: { a1, a2, a3 },
                })
            }
            console.log(`[printCallback] [${name}]:`, arguments);
        };
    }

    configuration = {
        iceServers: [{
            urls: "stun:stun.l.google.com:19302", // 使用谷歌的stun服务
        }, ],
    };
    pc = null;
    sendChannel = null;

    l = function(...args) {
        console.log(...args);
    };

    e = function(...args) {
        console.error(...args);
    };

    ws = new WebSocket(
        `wss://sawa-ecs.badambiz.com/z1h/api/webrtc-test-hub?operator=${OPERATOR}&uuid=${UUID}`
    );

    ws.onopen = () => {
        l("ws open");
    };
    ws.onclose = (err) => {
        e("ws close", err);
    };
    ws.onerror = (err) => {
        e("ws error", err);
    };

    function sendMessage(message) {
        ws.send("1" + JSON.stringify(message));
    }

    function localDescCreated(desc) {
        pc.setLocalDescription(
            desc,
            function() {
                sendMessage({
                    action: "chat",
                    task,
                    another,
                    content: { sdp: pc.localDescription },
                });
            },
            printCallback("setLocalDescription")
        );
    }

    function reportResult(content) {
        // return 111
        sendMessage({
            action: "report",
            another,
            task,
            content,
        });
        l("reportResult", content);
    }

    ws.onmessage = function(evt) {
        try {
            switch (evt.data.substring(0, 1)) {
                case "1":
                    var { action, task, another, role, content } = JSON.parse(
                        evt.data.substring(1)
                    );
                    switch (action) {
                        case "arrange":
                            try {
                                if (sendChannel) sendChannel.close();
                                if (pc) pc.close();
                            } catch (err) {
                                e("arrange close failed:", err);
                            }
                            window.task = task;
                            window.another = another;
                            window.isOfferer = role == "offer";
                            startWebRTC(role == "offer");
                            break;
                        case "chat":
                            if (content.sdp) {
                                // if (done)
                                //     return
                                // done = true
                                // 设置远程sdp, 在offer 或者 answer后
                                // console.log("message.sdp:", message.sdp)
                                pc.setRemoteDescription(
                                    new RTCSessionDescription(content.sdp),
                                    function() {
                                        // 当收到offer 后就接听
                                        if (pc.remoteDescription.type === "offer") {
                                            pc.createAnswer()
                                                .then(localDescCreated)
                                                .catch(printCallback("createAnswer error"));
                                        }
                                    },
                                    printCallback("setRemoteDescription")
                                );
                            } else if (content.candidate) {
                                // 增加新的 ICE canidatet 到本地的链接中
                                pc.addIceCandidate(
                                    new RTCIceCandidate(content.candidate),
                                    printCallback("addIceCandidate succ"),
                                    printCallback("addIceCandidate error")
                                );
                            }
                            break;
                    }
                    break;
            }
        } catch (err) {
            e("ws message", err);
        }
    };
    setInterval(function() {
        ws.send("0");
    }, 30000);

    function startWebRTC(isOfferer) {
        l("startWebRTC isOfferer = ", isOfferer);
        var startTime = new Date().getTime();
        var openTime = 0;
        pc = new RTCPeerConnection(configuration);
        sendChannel = pc.createDataChannel("sendDataChannel");
        sendChannel.onopen = printCallback("sendChannel.onopen");
        sendChannel.onclose = printCallback("sendChannel.onclose");
        sendChannel.onerror = printCallback("sendChannel.onerror");
        sendChannel.onmessage = printCallback("sendChannel.onmessage");
        var isFirstReceive = false;

        var t = task;
        setTimeout(function() {
            if (t === window.task && !isFirstReceive)
                reportResult({
                    result: "Timeout",
                    // cost: (new Date().getTime() - startTime()),
                });
        }, 30000);

        pc.ondatachannel = (e) => {
            console.log("[pc.ondatachannel]", arguments);
            window.dc = e.channel;
            var randNum = parseInt(Math.random() * 0xffffff);
            dc.onopen = (ev) => {
                openTime = new Date().getTime();
                // printCallback('dc.onopen')
                if (isOfferer) sendChannel.send("" + randNum);
                // reportResult({
                //     result: "answererReceive",
                //     afterStart: curTime - startTime,
                //     afterOpen: curTime - openTime,
                // })
            };
            dc.onmessage = function(event) {
                if (isFirstReceive) return;
                isFirstReceive = true;
                l("dc.onmessage:", event);
                var receNum = parseInt(event.data);
                var curTime = new Date().getTime();
                if (isOfferer) {
                    l("offerer receive", receNum);
                    if (receNum == randNum + 1) {
                        reportResult({
                            result: "offererReceive",
                            afterStart: curTime - startTime,
                            afterOpen: curTime - openTime,
                        });
                    }
                } else {
                    // reportResult("OK")
                    l("answerer receive", receNum);
                    sendChannel.send("" + (receNum + 1));
                    reportResult({
                        result: "answererReceive",
                        afterStart: curTime - startTime,
                        afterOpen: curTime - openTime,
                    });
                }
            };
            dc.onclose = printCallback("dc.onclose");
            dc.onerror = printCallback("dc.onerror");
        };

        // 当本地ICE Agent需要通过信号服务器发送信息到其他端时
        // 会触发icecandidate事件回调
        pc.onicecandidate = function(event) {
            if (event.candidate) {
                // action, content, task, another
                sendMessage({
                    action: "chat",
                    content: { candidate: event.candidate },
                    task,
                    another,
                });
            }
        };

        // 如果用户是第二个进入的人，就在negotiationneeded 事件后创建sdp
        if (isOfferer)
            pc.onnegotiationneeded = function() {
                // 创建本地sdp描述 SDP (Session Description Protocol) session描述协议
                pc.createOffer()
                    .then(localDescCreated)
                    .catch(printCallback("createOffer"));
            };
    }
}

// throw 'over'

// // 处理一下错误
// window.addEventListener('load', function() {
//     var onEr = document.querySelector(".onError")
//     console.log("replace console.error:", onEr)
//     if (!onEr)
//         return
//     var originError = console.error
//     console.error = function(...args) {
//         originError.apply(console, args)
//         let errorMessage = args.join(' ');
//         onEr.innerHTML += "<br>" + errorMessage
//     }
// })

// // 产生随机数
// var roomHash = location.search.match(/rid=(\w+)/g)
// if (roomHash && roomHash.length)
//     roomHash = roomHash[0].split("=")[1]
// else
//     location.hash.substring(1)
// if (!roomHash) {
//     location.hash = Math.floor(Math.random() * 0xFFFFFF).toString(16);
// }
// // 获取房间号
// if (!roomHash)
//     roomHash = location.hash.substring(1);

// // 放置你自己的频道id, 这是我注册了ScaleDrone 官网后，创建的channel
// // 你也可以自己创建
// // var drone = new ScaleDrone('87fYv4ncOoa0Cjne');
// var drone = null
// var ws = new WebSocket("wss://test-pk.badambiz.com/z1h/scale-drone?appid=ziipin-webrtc-test")
// // var ws = new WebSocket("ws://127.0.0.1:30030/scale-drone?appid=ziipin-webrtc-test")
// drone = {
//     ws,
//     listeners: {},
//     rooms: {},
//     on: (action, callback) => {
//         switch (action) {
//             case "open":
//                 if (drone.clientId)
//                     return callback(drone.status == 'open' ? null : dron.status)
//                 break
//         }
//         drone.listeners[action] = callback
//     },
//     subscribe: roomName => {
//         if (!roomName)
//             throw "no room name"
//         ws.send('1' + JSON.stringify({
//             action: 'subscribeRoom',
//             room: roomName,
//         }))
//         var theRoom = {
//             listeners: {},
//         }
//         theRoom.on = (action, callback) => {
//             // open/members/data
//             // data = function(message, client)
//             theRoom.listeners[action] = callback
//         }
//         drone.rooms[roomName] = theRoom
//         return theRoom
//     },
//     publish: info => {
//         var { room, message } = info
//         ws.send('1' + JSON.stringify({
//             action: 'roomBroadcast',
//             room: room,
//             message,
//         }))
//     },
// }
// ws.onopen = () => {
//     drone.status = 'open'
// }
// ws.onclose = e => {
//     console.error('Socket on close:', e)
//     drone.status = 'close:' + e
// }
// ws.onerror = e => {
//     console.error('Socket on error:', e)
//     drone.status = 'error:' + e
// }
// ws.onmessage = function(evt) {
//     try {
//         switch (evt.data.substring(0, 1)) {
//             case '1':
//                 var { action, clientId, room, members, message } = JSON.parse(evt.data.substring(1));
//                 switch (action) {
//                     case 'clientId':
//                         drone.clientId = clientId
//                         var openListener = drone.listeners.open
//                         openListener && openListener()
//                         break;
//                         // case 'subscribeRoom':
//                         //     var room = drone.rooms[room]
//                         //     room.listeners.open && room.listeners.open()
//                         //     break
//                     case 'members':
//                         var theRoom = drone.rooms[room]
//                         if (drone.clientId == clientId)
//                             theRoom.listeners.open && theRoom.listeners.open()
//                         theRoom.listeners.members && theRoom.listeners.members(members)
//                         break
//                     case 'roomBroadcast':
//                         var theRoom = drone.rooms[room]
//                         theRoom.listeners.data && theRoom.listeners.data(message, { id: clientId })
//                         break
//                 }
//                 break
//         }
//     } catch (err) {
//         console.error('Socket on onessage:', err)
//     }
// }
// setInterval(function() {
//     if (drone.status == 'open')
//         ws.send('0')
// }, 30000)

// var room;
// var pc;
// var sendChannel;

// function onSuccess() {}

// function onError(name) {
//     return function(error) {
//         console.error(name, error);
//     }
// }

// drone.on('open', function(error) {
//     if (error) { return console.error(error); }
//     console.log("drone open")

//     room = drone.subscribe(roomName);
//     console.log("subscribe:", { room })
//     room.on('open', function(error) {
//         if (error) { onError("roomOpen")(error); } else console.log("subscribe room open succ")
//     });

//     // 已经链接到房间后，就会收到一个 members 数组，代表房间里的成员
//     // 这时候信令服务已经就绪
//     room.on('members', function(members) {
//         console.log('MEMBERS', members);
//         if (members.length !== 2)
//             return
//         // 如果你是第二个链接到房间的人，就会创建offer
//         var isOfferer = members[1].clientId == drone.clientId;
//         startWebRTC(isOfferer);
//     });
// });

// function sendText() {
//     var text = document.querySelector("#localText").value
//     if (!text)
//         return alert("no text")
//     sendChannel.send(text);
// }

// function printCallback(name) {
//     return function() {
//         console.log(`[printCallback] [${name}]:`, arguments)
//     }
// }

// function onSendChannelStateChange() {
//     const readyState = sendChannel.readyState;
//     console.log('Send channel state is: ' + readyState);
//     // if (readyState === 'open') {
//     //     dataChannelSend.disabled = false;
//     //     dataChannelSend.focus();
//     //     sendButton.disabled = false;
//     //     closeButton.disabled = false;
//     // } else {
//     //     dataChannelSend.disabled = true;
//     //     sendButton.disabled = true;
//     //     closeButton.disabled = true;
//     // }
// }

// function onReceiveChannelStateChange() {
//     const readyState = receiveChannel.readyState;
//     console.log(`Receive channel state is: ` + readyState);
// }